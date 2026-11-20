import type { SkinDefinition } from './types'
import defaultSkin, { defaultSkinPalettes, defaultSkinPalette } from './default'
import kuwoSkin from './kuwo'
import qqSkin from './qq'
import kugouSkin from './kugou'
import neteaseSkin from './netease'

/** 缺省皮肤 id，与 defaultSetting['theme.skinId'] 保持一致 */
export const DEFAULT_SKIN_ID = 'default'

/**
 * 皮肤注册表
 *
 * 扩展新皮肤只需两步：
 * 1. 新建 src/skin/<vendor>/ 目录并导出 SkinDefinition；
 * 2. 在本文件顶部追加一行 import，并把定义追加到 skins 数组。
 * 不允许改动 screens / store / 接线文件。
 */
export const skins: SkinDefinition[] = [
  defaultSkin,
  kuwoSkin,
  qqSkin,
  kugouSkin,
  neteaseSkin,
]

/** 按 id 查找皮肤，未命中时回落到 default 皮肤 */
export const getSkin = (id?: string | null): SkinDefinition => {
  if (id) {
    const skin = skins.find(s => s.id === id)
    if (skin) return skin
  }
  return defaultSkin
}

export { defaultSkinPalettes, defaultSkinPalette }
