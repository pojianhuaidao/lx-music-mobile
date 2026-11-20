import { useEffect, useMemo, useState } from 'react'
import settingState from '@/store/setting/state'
import { DEFAULT_SKIN_ID, defaultSkinPalettes, getSkin } from './registry'
import useIsDark from './useSkinMode'
import type { ResolvedSkinDefinition, SkinPalette, SkinPalettes } from './types'

const getSkinId = (): string => settingState.setting['theme.skinId'] ?? DEFAULT_SKIN_ID

const resolvePalettes = (id: string): SkinPalettes => {
  const skin = getSkin(id)
  const base = skin.palette
  return {
    light: { ...defaultSkinPalettes.light, ...base, ...skin.palettes?.light },
    dark: { ...defaultSkinPalettes.dark, ...base, ...skin.palettes?.dark },
  }
}

const resolveSkin = (id: string, isDark: boolean): ResolvedSkinDefinition => {
  const skin = getSkin(id)
  const palettes = resolvePalettes(id)
  return {
    ...skin,
    palettes,
    palette: isDark ? palettes.dark : palettes.light,
    isDark,
  }
}

/**
 * 读取当前皮肤定义
 *
 * 与 src/store/theme/hook.ts 的 useTextShadow 保持一致：
 * 初值直接取 setting state，随后监听 configUpdated 中的 theme.skinId，
 * 设置变化时实时重渲染，无需重启应用。
 *
 * 同时监听全局主题昼夜状态（useIsDark），太阳/月亮切换时自动输出对应的
 * light / dark 色板，皮肤组件无需各自处理昼夜逻辑。
 */
export const useSkin = (): ResolvedSkinDefinition => {
  const [skinId, setSkinId] = useState(getSkinId)
  const isDark = useIsDark()

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

  return useMemo(() => resolveSkin(skinId, isDark), [skinId, isDark])
}

/** 只取当前昼夜色板，供只关心颜色的组件使用 */
export const useSkinPalette = (): SkinPalette => useSkin().palette

export default useSkin
