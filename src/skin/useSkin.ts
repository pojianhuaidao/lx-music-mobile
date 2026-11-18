import { useEffect, useMemo, useState } from 'react'
import settingState from '@/store/setting/state'
import { DEFAULT_SKIN_ID, defaultSkinPalette, getSkin } from './registry'
import type { ResolvedSkinDefinition } from './types'

const getSkinId = (): string => settingState.setting['theme.skinId'] ?? DEFAULT_SKIN_ID

const resolveSkin = (id: string): ResolvedSkinDefinition => {
  const skin = getSkin(id)
  return {
    ...skin,
    palette: { ...defaultSkinPalette, ...skin.palette },
  }
}

/**
 * 读取当前皮肤定义
 *
 * 与 src/store/theme/hook.ts 的 useTextShadow 保持一致：
 * 初值直接取 setting state，随后监听 configUpdated 中的 theme.skinId，
 * 设置变化时实时重渲染，无需重启应用。
 */
export const useSkin = (): ResolvedSkinDefinition => {
  const [skinId, setSkinId] = useState(getSkinId)

  useEffect(() => {
    const handleUpdate = (keys: Array<keyof LX.AppSetting>, setting: Partial<LX.AppSetting>) => {
      if (!keys.includes('theme.skinId')) return
      requestAnimationFrame(() => {
        setSkinId(setting['theme.skinId'] ?? DEFAULT_SKIN_ID)
      })
    }
    global.state_event.on('configUpdated', handleUpdate)
    return () => {
      global.state_event.off('configUpdated', handleUpdate)
    }
  }, [])

  return useMemo(() => resolveSkin(skinId), [skinId])
}

export default useSkin
