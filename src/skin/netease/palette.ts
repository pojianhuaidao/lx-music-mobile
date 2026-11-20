import type { SkinPalette } from '../types'

export type { SkinPalette }

/**
 * 网易云音乐车机版专属色板
 *
 * 在主色板基础上补充网易云车机版特有的功能色：
 * - highlight 红 #FF1168：进度、选中强调
 * - danger 红 #FF3A3A：喜欢/错误
 * - spot 次级蓝 #3AB6FF：品牌标识、次级强调与角标
 * - beige 深蓝灰次级底色
 * - playBg 播放页整页底色（深蓝黑，承载白色歌词）
 */
export interface NeteasePalette extends SkinPalette {
  highlight: string
  danger: string
  spot: string
  beige: string
  playBg: string
}

export interface NeteasePalettes {
  light: NeteasePalette
  dark: NeteasePalette
}

/**
 * 网易云音乐车机版视觉基线（昼夜双色板）
 *
 * 色值来源：D:/apk_work/palette/baseline.md 第 3 节
 * 红三档 #FF3A3A / #FC3D49 / #FF1168、深蓝黑底 #12162D、卡片底 #283248、
 * 次级蓝 #3AB6FF、灰阶 #333333 / #666666 / #C4C4C4。
 */
export const neteasePalettes: NeteasePalettes = {
  light: {
    // 页面底色：浅冷灰
    background: '#F7F8FC',
    // 卡片底色
    card: '#FFFFFF',
    // 主红（选中 pill / 品牌字）
    brand: '#FF3A3A',
    // 红二档（渐变下层 / 次级强调）
    brandAlt: '#FC3D49',
    // 迷你播放条底色：主红
    nowPlayingBg: '#FF3A3A',
    // 选中态底色：浅红
    selectedBg: '#FFE8EC',
    // 主要文字
    textPrimary: '#1B1D2B',
    // 次要文字（灰阶 #666666）
    textSecondary: '#666666',
    // 分割线
    divider: '#E3E5EE',
    radius: 12,
    // 红三档：进度与强调
    highlight: '#FF1168',
    // 喜欢/错误
    danger: '#FF3A3A',
    // 次级蓝
    spot: '#3AB6FF',
    // 次级底色（浅冷灰蓝）
    beige: '#EEF1F7',
    // 播放页：品牌深蓝黑底，保证白色歌词可读
    playBg: '#12162D',
  },
  dark: {
    // 页面底色：深蓝黑 #12162D
    background: '#12162D',
    // 卡片底色 #283248
    card: '#283248',
    // 主红在深蓝黑底上保持高对比
    brand: '#FF3A3A',
    // 红二档
    brandAlt: '#FC3D49',
    // 迷你播放条底色：比页面深一档
    nowPlayingBg: '#1A1F38',
    // 选中态底色
    selectedBg: '#333D5C',
    // 主要文字
    textPrimary: '#FFFFFF',
    // 次要文字（灰阶 #C4C4C4）
    textSecondary: '#C4C4C4',
    // 分割线（灰阶 #333333）
    divider: '#333333',
    radius: 12,
    // 红三档：进度与高亮
    highlight: '#FF1168',
    danger: '#FF3A3A',
    // 次级蓝在深底上做辨识色
    spot: '#3AB6FF',
    beige: '#283248',
    // 播放页：比主页更深一档，昼夜可辨
    playBg: '#0E1124',
  },
}

/** 浅色色板（兼容既有引用） */
export const neteasePalette = neteasePalettes.light

/** 深底上的前景色（播放页、迷你播放条） */
export const neteaseOnDark = {
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.72)',
  track: 'rgba(255, 255, 255, 0.24)',
  divider: 'rgba(255, 255, 255, 0.16)',
} as const

export type NeteaseOnColor = typeof neteaseOnDark

export default neteasePalettes
