/**
 * 本地音乐过滤规则
 *
 * 设计原则：
 * - 只在展示 / 播放队列选取阶段过滤，绝不修改扫描入库的原始列表，
 *   关闭过滤即可完整还原，避免用户数据被"整理"掉
 * - 过滤条件统一走 app setting 持久化（local.filter.*），
 *   任何皮肤、任何入口读到的都是同一份规则
 */

import settingState from '@/store/setting/state'
import { getLocalFileExt, isLocalExtDecodable } from '@/core/localCodec'
import type { LocalMusicInfo } from '@/store/local'

/** 内置可选扩展名（与扫描支持的音频类型对齐） */
export const LOCAL_FILTER_EXTS = [
  'mp3', 'flac', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'ape', 'wma', 'aiff', 'aif', 'mka', 'wv',
] as const

export interface LocalFilterOptions {
  /** 是否启用过滤 */
  enabled: boolean
  /** 最短时长（秒），0 表示不限 */
  minDuration: number
  /** 最长时长（秒），0 表示不限 */
  maxDuration: number
  /** 只显示指定扩展名，空数组表示不限 */
  exts: string[]
  /** 只显示播放内核可解码的文件 */
  onlyDecodable: boolean
}

export const getLocalFilterOptions = (): LocalFilterOptions => {
  const setting = settingState.setting
  return {
    enabled: setting['local.filter.enabled'] ?? false,
    minDuration: Number(setting['local.filter.minDuration']) || 0,
    maxDuration: Number(setting['local.filter.maxDuration']) || 0,
    exts: (setting['local.filter.exts'] ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
    onlyDecodable: setting['local.filter.onlyDecodable'] ?? false,
  }
}

/**
 * 把 mm:ss / hh:mm:ss / 纯秒数解析成秒
 * 无法解析返回 null（视为时长未知）
 */
export const parseDurationToSeconds = (interval?: string | number | null): number | null => {
  if (interval == null || interval === '') return null
  if (typeof interval == 'number') return Number.isFinite(interval) ? Math.round(interval) : null
  const parts = interval.split(':').map(part => Number(part))
  if (!parts.length || parts.some(part => !Number.isFinite(part))) return null
  return parts.reduce((total, part) => total * 60 + part, 0)
}

const getMusicExt = (musicInfo: LocalMusicInfo): string => {
  return (musicInfo.meta.ext || getLocalFileExt(musicInfo.meta.filePath || '')).toLowerCase()
}

/** 判断单首歌是否通过过滤条件 */
export const isMusicMatchedFilter = (musicInfo: LocalMusicInfo, options: LocalFilterOptions): boolean => {
  if (!options.enabled) return true
  const ext = getMusicExt(musicInfo)
  if (options.exts.length && !options.exts.includes(ext)) return false
  if (options.onlyDecodable && !isLocalExtDecodable(musicInfo.meta.filePath || '')) return false
  if (options.minDuration > 0 || options.maxDuration > 0) {
    const duration = parseDurationToSeconds(musicInfo.interval)
    if (duration == null) {
      // 时长未知的曲目在设置时长过滤时保留，避免因元数据缺失被静默隐藏
      return true
    }
    if (options.minDuration > 0 && duration < options.minDuration) return false
    if (options.maxDuration > 0 && duration > options.maxDuration) return false
  }
  return true
}

/** 按过滤条件筛选本地列表，返回新数组（不改动原列表） */
export const filterLocalMusics = (list: LocalMusicInfo[], options: LocalFilterOptions): LocalMusicInfo[] => {
  if (!options.enabled) return list
  return list.filter(item => isMusicMatchedFilter(item, options))
}

/** 过滤条件是否处于生效状态（用于界面提示） */
export const hasActiveFilter = (options: LocalFilterOptions): boolean => {
  if (!options.enabled) return false
  return options.exts.length > 0 || options.onlyDecodable || options.minDuration > 0 || options.maxDuration > 0
}

/** 时长输入单位：秒 / 分钟 */
export type LocalFilterDurationUnit = 'second' | 'minute'

/** 过滤条件默认值（界面重置用，与 config/defaultSetting.ts 保持一致） */
export const LOCAL_FILTER_DEFAULTS = {
  enabled: false,
  minDuration: 0,
  maxDuration: 0,
  exts: '',
  onlyDecodable: false,
} as const

/**
 * 把用户输入的时长文本换算成秒
 *
 * 支持任意一种写法，均"分钟或秒"皆可：
 * - 纯数字：`90` 按 unit 换算（秒 / 分钟）
 * - 冒号：`1:30`、`01:02:03`
 * - 带单位：`90s`、`1.5分`、`2分钟`、`1m30s`、`1小时2分30秒`
 *
 * @returns 秒数；空字符串返回 0（表示不限）；无法解析返回 null
 */
export const parseDurationInput = (text: string, unit: LocalFilterDurationUnit = 'second'): number | null => {
  const raw = `${text ?? ''}`.trim().toLowerCase().replace(/\s+/g, '')
  if (!raw) return 0
  if (/^\d+(:\d{1,2}){1,2}$/.test(raw)) {
    const seconds = parseDurationToSeconds(raw)
    return seconds == null ? null : Math.round(seconds)
  }
  const unitMatch = raw.match(/^(?:(\d+(?:\.\d+)?)(?:h|hour|小时|时))?(?:(\d+(?:\.\d+)?)(?:min|m|minutes|分钟|分))?(?:(\d+(?:\.\d+)?)(?:sec|s|seconds|秒))?$/)
  if (unitMatch && (unitMatch[1] || unitMatch[2] || unitMatch[3])) {
    return Math.round(
      Number(unitMatch[1] ?? 0) * 3600 +
      Number(unitMatch[2] ?? 0) * 60 +
      Number(unitMatch[3] ?? 0),
    )
  }
  const numberMatch = raw.match(/^(\d+(?:\.\d+)?)$/)
  if (!numberMatch) return null
  const value = Number(numberMatch[1])
  if (!Number.isFinite(value)) return null
  return Math.round(unit == 'minute' ? value * 60 : value)
}

/** 把秒数回填到输入框（0 显示为空，表示不限） */
export const formatDurationInput = (seconds: number, unit: LocalFilterDurationUnit = 'second'): string => {
  if (!seconds || seconds <= 0) return ''
  if (unit == 'second') return `${Math.round(seconds)}`
  const minutes = seconds / 60
  return `${Number.isInteger(minutes) ? minutes : Math.round(minutes * 100) / 100}`
}

/** 把秒数格式化成易读文本（如 1分30秒），用于界面说明 */
export const formatDurationReadable = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0'
  const h = Math.trunc(seconds / 3600)
  const m = Math.trunc((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  let text = ''
  if (h) text += `${h}小时`
  if (m) text += `${m}分`
  if (s) text += `${s}秒`
  return text || '0'
}
