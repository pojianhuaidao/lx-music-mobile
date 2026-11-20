import type { SkinDefinition, SkinPalettes } from '../types'

/**
 * 洛雪原版昼夜基线色板
 *
 * 该色板仅作为皮肤取色兜底（第三方皮肤未覆盖的字段回落到同昼夜的此值），
 * default 皮肤本身不渲染任何自定义版式，因此不会影响原版外观。
 */
export const defaultSkinPalettes: SkinPalettes = {
  light: {
    background: '#F7F8FA',
    card: '#FFFFFF',
    brand: '#4DAF7C',
    brandAlt: '#7FC4A0',
    nowPlayingBg: '#3A3F4A',
    selectedBg: '#4DAF7C',
    textPrimary: '#22262B',
    textSecondary: '#8B9099',
    divider: '#E5E7EB',
    radius: 6,
  },
  dark: {
    background: '#121317',
    card: '#1C1E24',
    brand: '#4DAF7C',
    brandAlt: '#7FC4A0',
    nowPlayingBg: '#262A33',
    selectedBg: '#2F6F52',
    textPrimary: '#EDEFF3',
    textSecondary: '#9AA1AC',
    divider: '#2B2E36',
    radius: 6,
  },
}

/** 浅色基线色板（兼容既有引用） */
export const defaultSkinPalette = defaultSkinPalettes.light

/**
 * 洛雪原版皮肤
 *
 * 不提供 HomeHorizontal / HomeVertical / PlayDetailHorizontal / PlayDetailVertical，
 * 所有页面走洛雪原生实现，保证切回原版时渲染路径逐字节等价。
 */
const defaultSkin: SkinDefinition = {
  id: 'default',
  name: '洛雪原版',
  description: '洛雪原生外观',
  palettes: defaultSkinPalettes,
}

export default defaultSkin
