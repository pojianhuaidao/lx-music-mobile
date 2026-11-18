import type { SkinPalette } from '../types'

/**
 * 酷我车机版视觉基线
 *
 * 取值来源：酷我车机版横屏首页取色（详见皮肤实施规格「酷我皮肤视觉基线」）。
 * 仅用于 src/skin/kuwo 内部组件，不注入 Theme 体系。
 */
export const kuwoPalette: SkinPalette = {
  // 页面底色
  background: '#F5F7FA',
  // 卡片底色
  card: '#FFFFFF',
  // 品牌强调（酷我黄）
  brand: '#F5D34E',
  // 次强调（酷我蓝）
  brandAlt: '#6677FF',
  // 正在播放区底色
  nowPlayingBg: '#1E3474',
  // 选中底色
  selectedBg: '#F5E527',
  // 主要文字
  textPrimary: '#1F2430',
  // 次要文字
  textSecondary: '#8A9099',
  // 分割线
  divider: '#E6EAF0',
  // 圆角：原图 16px / density 1.4 ≈ 11dp
  radius: 11,
}

/** 正在播放区内的辅助前景色（深底上的文字与图标） */
export const kuwoOnDark = {
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.65)',
  track: 'rgba(255, 255, 255, 0.22)',
  divider: 'rgba(255, 255, 255, 0.16)',
} as const

export default kuwoPalette
