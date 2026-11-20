import type { SkinPalette } from '../types'

export type { SkinPalette }

/**
 * QQ音乐车机版专属色板
 *
 * 在主色板基础上补充 QQ 车机版特有的功能色：
 * - highlight 亮绿 #57FF5B：深底上的高亮进度与强调
 * - danger 红 #FF5E5E：喜欢/错误
 * - beige 暖米 #F5EADA：次级底色（浅色模式即页面底色）
 */
export interface QqPalette extends SkinPalette {
  highlight: string
  danger: string
  beige: string
  /** 播放页整页底色（承载白色文字与歌词，两套模式下都需足够深） */
  playBg: string
}

export interface QqPalettes {
  light: QqPalette
  dark: QqPalette
}

/**
 * QQ音乐车机版视觉基线（昼夜双色板）
 *
 * 色值来源：D:/apk_work/palette/baseline.md 与 qq_colors.txt 实测频次清单
 * 主色 #5BC78C（品牌薄荷绿）、强调 #0EC712、亮绿 #57FF5B、红 #FF5E5E、暖米 #F5EADA、
 * 分隔线 #D8D8D8。
 */
export const qqPalettes: QqPalettes = {
  light: {
    // 页面底色：暖米
    background: '#F5EADA',
    // 卡片底色
    card: '#FFFFFF',
    // 品牌薄荷绿（主按钮/选中态）
    brand: '#5BC78C',
    // 高饱和绿（进度/强调）
    brandAlt: '#0EC712',
    // 迷你播放条底色
    nowPlayingBg: '#5BC78C',
    // 选中态底色（浅绿）
    selectedBg: '#E3F5EA',
    // 主要文字
    textPrimary: '#22302A',
    // 次要文字
    textSecondary: '#6F7F76',
    // 分割线
    divider: '#D8D8D8',
    radius: 12,
    // 亮绿高亮
    highlight: '#57FF5B',
    // 喜欢/错误红
    danger: '#FF5E5E',
    // 暖米次级底色
    beige: '#F5EADA',
    // 浅色模式播放页底色：压深一档的薄荷绿，保证白色歌词可读
    playBg: '#2F8F63',
  },
  dark: {
    // 页面底色：近黑墨绿
    background: '#0B0F0C',
    // 卡片底色
    card: '#151B17',
    // 品牌薄荷绿（深色下保持原色，作为主强调）
    brand: '#5BC78C',
    // 高饱和绿
    brandAlt: '#0EC712',
    // 迷你播放条底色（深绿压暗）
    nowPlayingBg: '#12301F',
    // 选中态底色
    selectedBg: '#1E3A28',
    // 主要文字
    textPrimary: '#EDF5EF',
    // 次要文字
    textSecondary: '#90A297',
    // 分割线
    divider: '#232C27',
    radius: 12,
    // 亮绿在深底下承担高亮职责
    highlight: '#57FF5B',
    danger: '#FF5E5E',
    // 深色下的暖米更沉，避免刺眼
    beige: '#2A2520',
    // 深色模式播放页底色
    playBg: '#0B0F0C',
  },
}

/** 浅色色板（兼容既有引用） */
export const qqPalette = qqPalettes.light

/** 深底上的前景色（播放页、迷你播放条） */
export const qqOnDark = {
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.72)',
  track: 'rgba(255, 255, 255, 0.24)',
  divider: 'rgba(255, 255, 255, 0.16)',
} as const

export type QqOnColor = typeof qqOnDark

export default qqPalettes
