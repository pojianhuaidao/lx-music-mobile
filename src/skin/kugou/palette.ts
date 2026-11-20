import type { SkinPalette } from '../types'

export type { SkinPalette }

/**
 * 酷狗音乐车机版专属色板
 *
 * 在主色板基础上补充酷狗车机版特有的功能色：
 * - highlight 金 #F9D383：进度、选中文字与强调
 * - danger 粉 #F86A76：喜欢/角标
 * - beige 次级暖棕底色
 * - playBg 播放页整页底色（深棕，承载白色歌词）
 */
export interface KugouPalette extends SkinPalette {
  highlight: string
  danger: string
  beige: string
  playBg: string
}

export interface KugouPalettes {
  light: KugouPalette
  dark: KugouPalette
}

/**
 * 酷狗音乐车机版视觉基线（昼夜双色板）
 *
 * 色值来源：D:/apk_work/palette/baseline.md 第 2 节
 * 蓝三档 #00BAFF / #0090FF / #0077FF（渐变层次）、深棕底 #472B17、金 #F9D383、粉 #F86A76，
 * 文字层级按白 / #4DFFFFFF / #1AFFFFFF 分层。
 */
export const kugouPalettes: KugouPalettes = {
  light: {
    // 页面底色：奶油暖棕（浅色模式）
    background: '#FBF0DD',
    // 卡片底色
    card: '#FFFFFF',
    // 主蓝（选中 pill / 品牌字）
    brand: '#0090FF',
    // 亮蓝（渐变上层 / 次级强调）
    brandAlt: '#00BAFF',
    // 迷你播放条底色：深蓝档
    nowPlayingBg: '#0077FF',
    // 选中态底色：浅金
    selectedBg: '#FFE9BF',
    // 主要文字：深棕
    textPrimary: '#472B17',
    // 次要文字
    textSecondary: '#8A6A4E',
    // 分割线
    divider: '#E3D0B4',
    radius: 12,
    // 金：进度/选中文字
    highlight: '#F9D383',
    // 粉：喜欢/角标
    danger: '#F86A76',
    // 暖棕次级底色
    beige: '#F3E2C9',
    // 播放页：沿用品牌深棕底，保证白色歌词可读
    playBg: '#472B17',
  },
  dark: {
    // 页面底色：品牌深棕 #472B17
    background: '#472B17',
    // 卡片底色：提亮一档的深棕
    card: '#5A3720',
    // 主蓝在深棕底上保持高对比
    brand: '#00BAFF',
    // 深蓝作为次层
    brandAlt: '#0090FF',
    // 迷你播放条底色：压暗蓝棕
    nowPlayingBg: '#3A2211',
    // 选中态底色
    selectedBg: '#6B431F',
    // 主要文字
    textPrimary: '#FFFFFF',
    // 次要文字（对应 #4DFFFFFF 一层）
    textSecondary: 'rgba(255, 255, 255, 0.76)',
    // 分割线（对应 #1AFFFFFF 一层）
    divider: 'rgba(255, 255, 255, 0.14)',
    radius: 12,
    // 金在深棕底上承担高亮职责
    highlight: '#F9D383',
    danger: '#F86A76',
    beige: '#5A3720',
    // 播放页：比主页更深一档，昼夜可辨
    playBg: '#241407',
  },
}

/** 浅色色板（兼容既有引用） */
export const kugouPalette = kugouPalettes.light

/** 深底上的前景色（播放页、迷你播放条） */
export const kugouOnDark = {
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.72)',
  track: 'rgba(255, 255, 255, 0.24)',
  divider: 'rgba(255, 255, 255, 0.16)',
} as const

export type KugouOnColor = typeof kugouOnDark

export default kugouPalettes
