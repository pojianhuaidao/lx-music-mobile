import type { ComponentType } from 'react'

/**
 * 皮肤色板
 *
 * 独立于既有 Theme 体系（src/theme/themes），仅用于皮肤内部版式骨架取色，
 * 不参与 c-* 语义色映射，避免影响原版组件的表现。
 */
export interface SkinPalette {
  /** 页面底色 */
  background: string
  /** 卡片底色 */
  card: string
  /** 品牌强调色 */
  brand: string
  /** 次强调色 */
  brandAlt: string
  /** 正在播放区底色 */
  nowPlayingBg: string
  /** 选中态底色 */
  selectedBg: string
  /** 主要文字 */
  textPrimary: string
  /** 次要文字 */
  textSecondary: string
  /** 分割线 */
  divider: string
  /** 圆角（dp） */
  radius: number
}

/** 横屏首页皮肤组件，替换横屏首页整体骨架 */
export type SkinHomeHorizontal = ComponentType

/** 竖屏首页皮肤组件，替换竖屏首页整体骨架 */
export type SkinHomeVertical = ComponentType

/** 横屏播放详情页皮肤组件 */
export type SkinPlayDetailHorizontal = ComponentType<{ componentId: string }>

/**
 * 皮肤定义
 *
 * 所有版式组件均为可选：
 * - 未提供时该页面走洛雪原生实现，保证皮肤可以只接管部分页面；
 * - default 皮肤不提供任何版式组件，渲染路径与改造前完全一致。
 */
export interface SkinDefinition {
  id: string
  /** 设置页展示名称 */
  name: string
  /** 设置页展示描述 */
  description: string
  /** 皮肤色板，未提供的字段回落到 defaultSkinPalette */
  palette?: Partial<SkinPalette>
  HomeHorizontal?: SkinHomeHorizontal
  HomeVertical?: SkinHomeVertical
  PlayDetailHorizontal?: SkinPlayDetailHorizontal
}

/** 补全色板后的皮肤定义 */
export interface ResolvedSkinDefinition extends SkinDefinition {
  palette: SkinPalette
}
