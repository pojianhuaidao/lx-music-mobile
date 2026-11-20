/**
 * 内置 FFmpeg 本地解码内核（TS 侧封装）
 *
 * 原生模块：android/app/src/main/java/cn/toside/music/mobile/ffmpeg/FFmpegAudioPlayerModule
 * - 名称：FFmpegAudioPlayer
 * - 方法：isAvailable / load / play / pause / seekTo / setVolume / stop / destroy / getStatus
 * - 事件：FFmpegAudioPlayerState / Progress / Completed / Error
 * - 单位：位置与时长均为毫秒
 *
 * 本文件只做「能力探测 + 方法调用 + 事件订阅 + 内核标记」，
 * 不含任何与 store / app_event 的耦合，播放链路的状态同步放在 plugins/player/ffmpegCore.ts
 */

import { NativeEventEmitter, NativeModules, Platform } from 'react-native'

export const FFMPEG_EVENT_STATE = 'FFmpegAudioPlayerState'
export const FFMPEG_EVENT_PROGRESS = 'FFmpegAudioPlayerProgress'
export const FFMPEG_EVENT_COMPLETED = 'FFmpegAudioPlayerCompleted'
export const FFMPEG_EVENT_ERROR = 'FFmpegAudioPlayerError'

export type FFmpegStateName = 'idle' | 'preparing' | 'ready' | 'playing' | 'paused' | 'completed' | 'error' | 'unknown'

export interface FFmpegStatusPayload {
  state?: number
  stateName?: FFmpegStateName
  /** 当前播放位置（毫秒） */
  position?: number
  /** 总时长（毫秒） */
  duration?: number
  path?: string
  codec?: string
  sampleRate?: number
  channels?: number
  bitRate?: number
}

export interface FFmpegEventPayload extends FFmpegStatusPayload {
  message?: string
}

export interface FFmpegAvailability {
  available: boolean
  version?: string
  error?: string
}

interface FFmpegAudioPlayerNative {
  isAvailable: () => Promise<FFmpegAvailability>
  load: (path: string) => Promise<FFmpegStatusPayload>
  play: () => void
  pause: () => void
  seekTo: (positionMs: number) => void
  setVolume: (value: number) => void
  stop: () => void
  destroy: () => void
  getStatus: () => Promise<FFmpegStatusPayload>
}

/** 当前负责出声的播放内核 */
export type PlaybackCore = 'system' | 'ffmpeg'

let activeCore: PlaybackCore = 'system'

export const getActivePlaybackCore = (): PlaybackCore => activeCore
export const setActivePlaybackCore = (core: PlaybackCore) => {
  activeCore = core
}
/** 当前是否由 FFmpeg 内核接管播放 */
export const isFFmpegCoreActive = (): boolean => activeCore == 'ffmpeg'

const nativeModule = (NativeModules as Record<string, unknown>).FFmpegAudioPlayer as FFmpegAudioPlayerNative | undefined

let available: boolean | null = null
let availabilityError: string | null = null
let probePromise: Promise<boolean> | null = null

/** 探测失败原因（so 未编入、加载失败等），用于日志与提示 */
export const getFFmpegAvailabilityError = (): string | null => availabilityError

/** 同步读取探测结果，未探测完成时按不可用处理（保守降级） */
export const isFFmpegAvailableSync = (): boolean => available === true

/** 当前平台是否可能具备 FFmpeg 内核（原生实现仅 Android） */
export const isFFmpegPlatformSupported = (): boolean => Platform.OS == 'android'

/**
 * 探测 FFmpeg 内核是否可用（带缓存）
 * 探测失败不会抛异常，只返回 false，保证播放链路可以安全降级
 */
export const probeFFmpeg = (force = false): Promise<boolean> => {
  if (!force && available != null) return Promise.resolve(available)
  if (probePromise) return probePromise
  if (!isFFmpegPlatformSupported() || !nativeModule) {
    available = false
    availabilityError = nativeModule ? 'unsupported_platform' : 'module_not_found'
    return Promise.resolve(false)
  }
  probePromise = nativeModule.isAvailable().then((res) => {
    available = !!res?.available
    availabilityError = res?.error ?? null
    if (!available) console.log('[ffmpeg] unavailable', availabilityError)
    return available
  }).catch((err: unknown) => {
    available = false
    availabilityError = err instanceof Error ? err.message : 'probe_failed'
    console.log('[ffmpeg] probe failed', err)
    return false
  }).then((result) => {
    probePromise = null
    return result
  })
  return probePromise
}

// 模块加载即发起一次探测，保证 localCodec 的同步判定在启动后不久就能拿到结果
void probeFFmpeg()

let emitter: NativeEventEmitter | null = null
const getEmitter = (): NativeEventEmitter | null => {
  if (emitter) return emitter
  if (!nativeModule) return null
  try {
    // 原生模块已实现 addListener / removeListeners
    emitter = new NativeEventEmitter(nativeModule as never)
    return emitter
  } catch (err) {
    console.log('[ffmpeg] create emitter failed', err)
    return null
  }
}

/**
 * 订阅原生事件，返回取消订阅函数
 * 模块不存在时返回空函数，调用方无需额外判空
 */
export const addFFmpegListener = <T = FFmpegEventPayload>(event: string, listener: (payload: T) => void): (() => void) => {
  const bus = getEmitter()
  if (!bus) return () => {}
  const sub = bus.addListener(event, listener as (payload: unknown) => void)
  return () => {
    sub.remove()
  }
}

/** 加载本地文件，resolve 时代表已就绪（含时长），失败抛异常 */
export const ffmpegLoad = async(path: string): Promise<FFmpegStatusPayload> => {
  if (!nativeModule) throw new Error('E_FFMPEG_UNAVAILABLE')
  return nativeModule.load(path)
}

export const ffmpegPlay = async(): Promise<void> => {
  try {
    nativeModule?.play()
  } catch (err) {
    console.log('[ffmpeg] play failed', err)
  }
}

export const ffmpegPause = async(): Promise<void> => {
  try {
    nativeModule?.pause()
  } catch (err) {
    console.log('[ffmpeg] pause failed', err)
  }
}

/** seek，单位毫秒 */
export const ffmpegSeek = async(positionMs: number): Promise<void> => {
  try {
    nativeModule?.seekTo(Math.max(0, Math.round(positionMs)))
  } catch (err) {
    console.log('[ffmpeg] seek failed', err)
  }
}

export const ffmpegSetVolume = async(volume: number): Promise<void> => {
  try {
    nativeModule?.setVolume(Math.min(1, Math.max(0, volume)))
  } catch (err) {
    console.log('[ffmpeg] setVolume failed', err)
  }
}

export const ffmpegStop = async(): Promise<void> => {
  try {
    nativeModule?.stop()
  } catch (err) {
    console.log('[ffmpeg] stop failed', err)
  }
}

export const ffmpegDestroy = async(): Promise<void> => {
  try {
    nativeModule?.destroy()
  } catch (err) {
    console.log('[ffmpeg] destroy failed', err)
  }
}

/** 读取原生侧当前状态，失败或模块缺失时返回 null */
export const ffmpegGetStatus = async(): Promise<FFmpegStatusPayload | null> => {
  if (!nativeModule) return null
  try {
    return await nativeModule.getStatus()
  } catch (err) {
    console.log('[ffmpeg] getStatus failed', err)
    return null
  }
}
