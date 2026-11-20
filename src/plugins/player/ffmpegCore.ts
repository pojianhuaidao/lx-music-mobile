/**
 * FFmpeg 内核播放衔接层
 *
 * 职责：把原生 FFmpegAudioPlayer 的生命周期、事件与时间单位（毫秒）
 * 翻译成洛雪既有的 app_event（秒）+ store 语义，使各皮肤播放页、
 * 歌词滚动、迷你播放条完全无需感知内核差异。
 *
 * 设计要点：
 * 1. 内核切换只发生在「资源落位」时刻（setResource），切歌与暂停/继续不重建内核；
 * 2. FFmpeg 就绪前一律按系统内核状态对外呈现，避免半初始化状态污染 app_event；
 * 3. 原生异常一律降级为 app_event.error / playerError，不向上抛，保证界面不崩溃；
 * 4. 播放结束发 playerEnded，交由既有 handleEnded 链路完成自动下一首；
 * 5. 卸载时只 stop 不 destroy，原生模块保留给下一首歌复用，避免重复初始化。
 */
import TrackPlayer from 'react-native-track-player'

import { setMaxplayTime, setNowPlayTime } from '@/core/player/progress'
import { setStatusText } from '@/core/player/playStatus'
import {
  FFMPEG_EVENT_COMPLETED,
  FFMPEG_EVENT_ERROR,
  FFMPEG_EVENT_PROGRESS,
  FFMPEG_EVENT_STATE,
  addFFmpegListener,
  ffmpegGetStatus,
  ffmpegLoad,
  ffmpegPause,
  ffmpegPlay,
  ffmpegSeek,
  ffmpegSetVolume,
  ffmpegStop,
  getActivePlaybackCore,
  isFFmpegAvailableSync,
  isFFmpegPlatformSupported,
  setActivePlaybackCore,
  type FFmpegEventPayload,
} from '@/core/localFFmpeg'

/** 原生时长/位置为毫秒，store 与 app_event 使用秒 */
const MS_TO_SECONDS = 1 / 1000
/** 加载超时保护：超时按加载失败处理，避免界面卡在「正在加载」 */
const LOAD_TIMEOUT = 20_000
/** 进度事件写 store 的最小间隔，防止高频 setNowPlayTime 触发过量重渲染 */
const PROGRESS_THROTTLE = 350
/** 原生可能对同一次失败同时 reject 并派发 Error 事件，此窗口内只上报一次 */
const ERROR_THROTTLE = 1_500

type FFmpegRuntime = {
  /** 本次请求加载的路径 */
  path: string
  /** 已加载成功、可响应控制指令的路径 */
  loadedPath: string
  positionMs: number
  durationMs: number
  hasDuration: boolean
  isPlaying: boolean
  volume: number
  /** 加载序号，用于丢弃切歌后才迟到的加载结果 */
  loadToken: number
  lastProgressAt: number
  lastErrorAt: number
}

const runtime: FFmpegRuntime = {
  path: '',
  loadedPath: '',
  positionMs: 0,
  durationMs: 0,
  hasDuration: false,
  isPlaying: false,
  volume: 1,
  loadToken: 0,
  lastProgressAt: 0,
  lastErrorAt: 0,
}

let unlisteners: Array<() => void> = []

const safeEmit = (fn: () => void) => {
  try {
    fn()
  } catch (err) {
    console.log('[ffmpegCore] emit event failed', err)
  }
}

/** 是否为上一首迟到的原生事件 */
const isStalePayload = (payload: FFmpegEventPayload | null | undefined) => {
  if (!payload) return true
  if (payload.path && runtime.loadedPath && payload.path != runtime.loadedPath) return true
  return false
}

const syncDuration = (durationMs: number) => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return
  if (runtime.hasDuration && Math.abs(runtime.durationMs - durationMs) < 500) return
  runtime.durationMs = durationMs
  runtime.hasDuration = true
  setMaxplayTime(durationMs * MS_TO_SECONDS)
}

const handleStateEvent = (payload: FFmpegEventPayload) => {
  if (isStalePayload(payload)) return
  const position = payload.position
  if (typeof position == 'number' && Number.isFinite(position) && position >= 0) runtime.positionMs = position
  const duration = payload.duration
  if (typeof duration == 'number') syncDuration(duration)

  switch (payload.stateName) {
    case 'playing':
      if (runtime.isPlaying) return
      runtime.isPlaying = true
      safeEmit(() => { global.app_event.play() })
      break
    case 'paused':
    case 'completed':
      if (!runtime.isPlaying) return
      runtime.isPlaying = false
      safeEmit(() => { global.app_event.pause() })
      break
    case 'ready':
    case 'preparing':
    case 'idle':
    case 'error':
    case 'unknown':
    default:
      break
  }
}

const handleProgressEvent = (payload: FFmpegEventPayload) => {
  if (isStalePayload(payload)) return
  const position = payload.position
  if (typeof position == 'number' && Number.isFinite(position) && position >= 0) runtime.positionMs = position
  const duration = payload.duration
  if (typeof duration == 'number') syncDuration(duration)

  const now = Date.now()
  if (now - runtime.lastProgressAt < PROGRESS_THROTTLE) return
  runtime.lastProgressAt = now
  // 只推进时间轴，不调用 setProgress：seek 语义由播放层显式触发，
  // 这里若走 setProgress 会周期性重建歌词时钟，导致歌词抖动
  setNowPlayTime(runtime.positionMs * MS_TO_SECONDS)
}

const handleCompletedEvent = (payload: FFmpegEventPayload) => {
  if (isStalePayload(payload)) return
  runtime.isPlaying = false
  if (runtime.hasDuration) {
    runtime.positionMs = runtime.durationMs
    setNowPlayTime(runtime.durationMs * MS_TO_SECONDS)
  }
  safeEmit(() => { global.app_event.playerEnded() })
}

const getUnavailableReason = () => {
  if (!isFFmpegPlatformSupported()) return global.i18n.t('local_ffmpeg_unsupported_platform')
  return global.i18n.t('local_ffmpeg_unavailable')
}

const reportPlayError = (reason: string, detail?: unknown) => {
  const now = Date.now()
  if (now - runtime.lastErrorAt < ERROR_THROTTLE) return
  runtime.lastErrorAt = now
  runtime.isPlaying = false
  console.log('[ffmpegCore] play error', reason, detail)
  setStatusText(reason)
  safeEmit(() => { global.app_event.error() })
  safeEmit(() => { global.app_event.playerError() })
}

const handleErrorEvent = (payload: FFmpegEventPayload) => {
  if (isStalePayload(payload)) return
  reportPlayError(global.i18n.t('local_ffmpeg_load_failed'), payload.message)
}

const ensureListeners = () => {
  if (unlisteners.length) return
  unlisteners = [
    addFFmpegListener<FFmpegEventPayload>(FFMPEG_EVENT_STATE, handleStateEvent),
    addFFmpegListener<FFmpegEventPayload>(FFMPEG_EVENT_PROGRESS, handleProgressEvent),
    addFFmpegListener<FFmpegEventPayload>(FFMPEG_EVENT_COMPLETED, handleCompletedEvent),
    addFFmpegListener<FFmpegEventPayload>(FFMPEG_EVENT_ERROR, handleErrorEvent),
  ]
}

const releaseListeners = () => {
  unlisteners.forEach((off) => {
    try {
      off()
    } catch (err) {
      console.log('[ffmpegCore] release listener failed', err)
    }
  })
  unlisteners = []
}

const withTimeout = async<T>(promise: Promise<T>, timeout: number): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('E_FFMPEG_LOAD_TIMEOUT'))
    }, timeout)
    promise.then((value) => {
      clearTimeout(timer)
      resolve(value)
    }, (err: unknown) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

const resetRuntime = () => {
  runtime.loadedPath = ''
  runtime.durationMs = 0
  runtime.hasDuration = false
  runtime.isPlaying = false
  runtime.positionMs = 0
  runtime.lastProgressAt = 0
}

/** 暂停系统内核，避免两个内核同时出声 */
const pauseSystemKernel = async() => {
  try {
    await TrackPlayer.pause()
  } catch (err) {
    console.log('[ffmpegCore] pause system kernel failed', err)
  }
}

/**
 * 把本地文件交给 FFmpeg 内核播放（内核切换入口）
 * @param path 本地文件路径（含 content:// 形式）
 * @param startSeconds 起播进度（秒）
 * @returns 是否成功接管播放
 */
export const ffmpegRenderResource = async(path: string, startSeconds = 0): Promise<boolean> => {
  const token = ++runtime.loadToken
  runtime.path = path
  runtime.loadedPath = ''
  runtime.durationMs = 0
  runtime.hasDuration = false
  runtime.isPlaying = false
  runtime.positionMs = Math.max(0, startSeconds) * 1000

  // 先标记内核归属，使加载期间的 play/pause 指令路由到 FFmpeg 内核
  setActivePlaybackCore('ffmpeg')
  ensureListeners()
  await pauseSystemKernel()

  if (!isFFmpegAvailableSync()) {
    if (token == runtime.loadToken) {
      resetRuntime()
      setActivePlaybackCore('system')
    }
    reportPlayError(getUnavailableReason())
    return false
  }

  try {
    const status = await withTimeout(ffmpegLoad(path), LOAD_TIMEOUT)
    if (token != runtime.loadToken) {
      // 加载期间已切到别的歌，本次结果作废并静默停住
      void ffmpegStop()
      return false
    }
    runtime.loadedPath = path
    runtime.isPlaying = false
    const loadedDuration = status?.duration
    if (typeof loadedDuration == 'number' && loadedDuration > 0) {
      syncDuration(loadedDuration)
    } else {
      const latest = await ffmpegGetStatus()
      const latestDuration = latest?.duration
      if (typeof latestDuration == 'number' && latestDuration > 0) syncDuration(latestDuration)
    }

    if (runtime.positionMs > 0) {
      await ffmpegSeek(runtime.positionMs)
      setNowPlayTime(runtime.positionMs * MS_TO_SECONDS)
    } else {
      setNowPlayTime(0)
    }
    await ffmpegSetVolume(runtime.volume)
    await ffmpegPlay()
    return true
  } catch (err) {
    if (token != runtime.loadToken) return false
    resetRuntime()
    setActivePlaybackCore('system')
    reportPlayError(global.i18n.t('local_ffmpeg_load_failed'), err)
    return false
  }
}

/** 继续播放（FFmpeg 内核） */
export const ffmpegResume = async() => {
  if (getActivePlaybackCore() != 'ffmpeg') return
  await ffmpegPlay()
}

/** 暂停播放（FFmpeg 内核） */
export const ffmpegPauseCore = async() => {
  if (getActivePlaybackCore() != 'ffmpeg') return
  runtime.isPlaying = false
  await ffmpegPause()
}

/** seek（入参秒，原生毫秒） */
export const ffmpegSeekTo = async(seconds: number) => {
  if (getActivePlaybackCore() != 'ffmpeg') return
  if (!Number.isFinite(seconds)) return
  const positionMs = Math.max(0, Math.round(seconds * 1000))
  runtime.positionMs = positionMs
  await ffmpegSeek(positionMs)
}

/** 设置音量，同时记录以便后续加载的歌曲沿用 */
export const ffmpegSetVolumeCore = async(volume: number) => {
  runtime.volume = Math.min(1, Math.max(0, volume))
  if (getActivePlaybackCore() != 'ffmpeg') return
  await ffmpegSetVolume(runtime.volume)
}

/** 读取当前进度（秒），由原生进度事件持续刷新，无需每次跨桥查询 */
export const ffmpegGetPosition = async(): Promise<number> => {
  return runtime.positionMs * MS_TO_SECONDS
}

/** 读取当前时长（秒） */
export const ffmpegGetDuration = async(): Promise<number> => {
  return runtime.durationMs * MS_TO_SECONDS
}

/**
 * 停止 FFmpeg 内核播放并交还内核归属
 * 注意：不触发 playerEnded，也不驱动系统内核队列，避免「停止」被误判为「播放结束」
 */
export const ffmpegStopCore = async() => {
  const isActive = getActivePlaybackCore() == 'ffmpeg'
  runtime.loadToken += 1
  resetRuntime()
  setActivePlaybackCore('system')
  if (!isActive) return
  await ffmpegStop()
}

/**
 * 卸载内核（切回系统内核前调用）
 * 只 stop 不 destroy，保证原生模块可被下一首歌直接复用
 */
export const ffmpegTeardown = async() => {
  const isActive = getActivePlaybackCore() == 'ffmpeg'
  runtime.loadToken += 1
  resetRuntime()
  runtime.path = ''
  setActivePlaybackCore('system')
  if (isActive) await ffmpegStop()
  releaseListeners()
}
