/**
 * 本地音乐解码能力判定与播放 URI 构造
 *
 * 播放内核说明（已核对 android 原生与 node_modules）：
 * - 底层为 react-native-track-player + AndroidX Media3（ExoPlayer 1.5.1）
 * - Track.java 中本地文件走 DefaultDataSource + ProgressiveMediaSource +
 *   DefaultExtractorsFactory，与在线流走的是同一套 Extractor 与平台解码器
 * - 因此本地音乐的可用格式 = Media3 默认 Extractor 集合 + 设备平台解码器
 *   主流格式（mp3/flac/m4a/aac/ogg/opus/wav/wma 之外的绝大多数）无需额外解码器
 *   ape / wma / dsf 等小众容器没有对应 Extractor，必须由原生扩展补
 *
 * 解码后端三态：
 * - system：系统内核（Media3 ExoPlayer）可直接解码
 * - ffmpeg：系统内核无法解码，交由内置 FFmpeg 内核（FFmpegAudioPlayer）解码
 * - unsupported：两个内核都解不了（如加密 m4p），或 FFmpeg 内核不可用/被关闭
 */

import settingState from '@/store/setting/state'
import { isFFmpegAvailableSync, isFFmpegPlatformSupported } from './localFFmpeg'

/** 本地音乐当前的解码后端（三态） */
export type LocalDecodeBackend = 'system' | 'ffmpeg' | 'unsupported'

/** 本地音乐解码内核偏好：auto = 系统内核优先、不足时用 FFmpeg；system = 只用系统内核 */
export type LocalDecodeKernel = 'auto' | 'system'

/** Media3 默认 Extractor 覆盖、确定可解码的扩展名 */
const KNOWN_DECODABLE_EXTS = new Set([
  'mp3', 'mp2', 'mpga',
  'flac',
  'm4a', 'm4b', 'mp4', 'aac', '3gp',
  'ogg', 'oga', 'opus',
  'wav', 'wave',
  'mka', 'mkv', 'webm', 'weba',
  'amr', 'awb',
  'ac3', 'eac3', 'ec3',
  'aif', 'aiff', 'aifc',
  'ts', 'mts', 'm2ts',
  'flv',
  'mid', 'midi', 'xmf', 'mxmf', 'rtttl', 'rtx', 'ota', 'imy',
])

/** Media3 默认 Extractor 不支持、直连系统内核必然加载失败的扩展名 */
const KNOWN_UNDECODABLE_EXTS = new Set([
  'ape', 'wma', 'asf', 'dsf', 'dff', 'tak', 'wv', 'mpc', 'tta', 'rm', 'ra', 'ram', 'm4p',
])

/**
 * 内置 FFmpeg 内核可解码的扩展名（系统内核无 Extractor 的容器）
 * m4p 为加密 AAC，FFmpeg 同样无法解码，故不在其中
 */
const FFMPEG_DECODABLE_EXTS = new Set([
  'ape', 'wma', 'asf', 'dsf', 'dff', 'tak', 'wv', 'mpc', 'tta', 'rm', 'ra', 'ram',
])

/** FFmpeg 内核播放 URI 前缀，携带该前缀的资源由播放层切换到 FFmpegAudioPlayer 播放 */
const FFMPEG_PLAY_URI_PREFIX = 'ffmpeg-local://'

/** 取文件扩展名（小写，不含点） */
export const getLocalFileExt = (filePath: string): string => {
  const fileName = filePath.split(/[/\\]/).pop() ?? ''
  const index = fileName.lastIndexOf('.')
  return index < 0 ? '' : fileName.slice(index + 1).toLowerCase()
}

/** 扩展名是否属于「系统内核解不了、需要 FFmpeg 内核」的集合 */
export const isFFmpegExt = (filePath: string): boolean => {
  return FFMPEG_DECODABLE_EXTS.has(getLocalFileExt(filePath))
}

/** 当前设置下的解码内核偏好 */
export const getLocalDecodeKernel = (): LocalDecodeKernel => {
  return settingState.setting['local.decodeKernel'] == 'system' ? 'system' : 'auto'
}

/**
 * FFmpeg 内核当前是否可用（平台支持 + 未被设置关闭 + 原生库加载成功）
 * 三者任一不满足时，需要 FFmpeg 的格式一律降级为 unsupported，走明确报错/在线兜底
 */
export const isFFmpegKernelAllowed = (): boolean => {
  if (getLocalDecodeKernel() != 'auto') return false
  if (!isFFmpegPlatformSupported()) return false
  return isFFmpegAvailableSync()
}

/**
 * 内核是否具备解码该文件的能力（系统内核或 FFmpeg 内核任一可解）
 * 未识别的扩展名按「交给系统内核试播」处理，避免误伤
 */
export const isLocalExtDecodable = (filePath: string): boolean => {
  const ext = getLocalFileExt(filePath)
  if (!ext) return true
  if (KNOWN_DECODABLE_EXTS.has(ext)) return true
  if (FFMPEG_DECODABLE_EXTS.has(ext)) return isFFmpegKernelAllowed()
  if (KNOWN_UNDECODABLE_EXTS.has(ext)) return false
  return true
}

/** 判定本地音乐由哪个后端解码 */
export const getLocalDecodeBackend = (filePath: string): LocalDecodeBackend => {
  const ext = getLocalFileExt(filePath)
  if (!ext) return 'system'
  if (KNOWN_DECODABLE_EXTS.has(ext)) return 'system'
  if (FFMPEG_DECODABLE_EXTS.has(ext)) return isFFmpegKernelAllowed() ? 'ffmpeg' : 'unsupported'
  if (KNOWN_UNDECODABLE_EXTS.has(ext)) return 'unsupported'
  return 'system'
}

/**
 * 把本地文件路径转成播放内核可识别的 URI
 * - content:// 、file:// 等已带 scheme 的路径原样返回
 * - 绝对/相对路径补 file:// 前缀并转义，避免路径含空格、#、? 时被内核当成流地址解析
 */
export const toLocalPlayUri = (filePath: string): string => {
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(filePath)) return filePath
  const encoded = encodeURI(filePath).replace(/#/g, '%23').replace(/\?/g, '%3F')
  return encoded.startsWith('/') ? `file://${encoded}` : encoded
}

/**
 * 构造 FFmpeg 内核播放 URI
 * 保留原始路径（含 content:// 形式），由播放层解析后直接交给原生 FFmpeg 内核读取
 */
export const toFFmpegPlayUri = (filePath: string): string => {
  return `${FFMPEG_PLAY_URI_PREFIX}${encodeURIComponent(filePath)}`
}

/** 是否为 FFmpeg 内核播放 URI */
export const isFFmpegPlayUri = (url?: string | null): boolean => {
  return typeof url == 'string' && url.startsWith(FFMPEG_PLAY_URI_PREFIX)
}

/** 从 FFmpeg 内核播放 URI 还原原始文件路径 */
export const parseFFmpegPlayUri = (url: string): string => {
  if (!isFFmpegPlayUri(url)) return url
  try {
    return decodeURIComponent(url.slice(FFMPEG_PLAY_URI_PREFIX.length))
  } catch {
    return url.slice(FFMPEG_PLAY_URI_PREFIX.length)
  }
}

/**
 * 是否为「仅本地播放」模式
 * localOnly（默认）：本地音乐只播本地文件，解码不了就报错，绝不静默换成在线源
 * autoFallback：保留洛雪原本的在线换源行为
 */
export const isLocalOnlyPlayback = (): boolean => {
  return settingState.setting['local.playbackMode'] != 'autoFallback'
}
