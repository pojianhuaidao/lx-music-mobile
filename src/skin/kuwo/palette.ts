import type { SkinPalette, SkinPalettes } from '../types'

export type { SkinPalette }

/**
 * 酷我车机版视觉基线（昼夜双色板）
 *
 * 取值来源：酷我车机版横屏首页 / 播放页取色（详见皮肤实施规格「酷我皮肤视觉基线」）。
 * 仅用于 src/skin/kuwo 内部组件，不注入 Theme 体系。
 *
 * 早期版本只有一套浅色硬编码色值，导致系统切到深色时皮肤仍保持浅色外观；
 * 现拆为 light / dark 两套，由 useKuwoTheme 依据全局主题 isDark 自动选择。
 */
export const kuwoPalettes: SkinPalettes = {
  light: {
    // 页面底色
    background: '#F5F7FA',
    // 卡片底色
    card: '#FFFFFF',
    // 品牌强调（酷我黄）
    brand: '#F5D34E',
    // 次强调（酷我蓝）
    brandAlt: '#6677FF',
    // 正在播放区底色（深蓝）
    nowPlayingBg: '#1E3474',
    // 选中底色
    selectedBg: '#F5E527',
    // 主要文字
    textPrimary: '#1F2430',
    // 次要文字
    textSecondary: '#8A9099',
    // 分割线
    divider: '#E6EAF0',
    // 圆角：原图 16px / density 1.4 约 11dp
    radius: 11,
  },
  dark: {
    // 页面底色（深色底，接近酷我夜间形态）
    background: '#0E1014',
    // 卡片底色
    card: '#181B22',
    // 品牌强调（酷我黄在深色下略微降亮，避免刺眼）
    brand: '#E8C846',
    // 次强调（酷我蓝在深色下提亮）
    brandAlt: '#8091FF',
    // 正在播放区底色（更深一档的深蓝）
    nowPlayingBg: '#111A38',
    // 选中底色（低明度暖黄，保证浅色文字可读）
    selectedBg: '#3C3618',
    // 主要文字
    textPrimary: '#EDF1F7',
    // 次要文字
    textSecondary: '#8D95A3',
    // 分割线
    divider: '#262A33',
    radius: 11,
  },
}

/** 浅色色板（兼容既有引用） */
export const kuwoPalette = kuwoPalettes.light

/** 正在播放区内的辅助前景色（深底上的文字与图标，昼夜一致） */
export const kuwoOnDark = {
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.65)',
  track: 'rgba(255, 255, 255, 0.22)',
  divider: 'rgba(255, 255, 255, 0.16)',
} as const

export type KuwoOnColor = typeof kuwoOnDark

export default kuwoPalettes
