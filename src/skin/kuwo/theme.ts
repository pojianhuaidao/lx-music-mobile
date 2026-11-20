import { useMemo } from 'react'
import useIsDark from '../useSkinMode'
import { kuwoOnDark, kuwoPalettes } from './palette'
import type { KuwoOnColor } from './palette'
import type { SkinPalette } from '../types'

export interface KuwoTheme {
  /** 当前昼夜色板 */
  palette: SkinPalette
  /** 深底上的前景色（正在播放区、播放页） */
  on: KuwoOnColor
  /** 当前是否深色 */
  isDark: boolean
}

/**
 * 酷我皮肤取色入口
 *
 * 直接跟随全局主题昼夜状态，切到深色时返回 kuwoPalettes.dark，
 * 修复早期 kuwoPalette 硬编码浅色导致昼夜不切换的问题。
 */
export const useKuwoTheme = (): KuwoTheme => {
  const isDark = useIsDark()
  return useMemo(() => ({
    palette: isDark ? kuwoPalettes.dark : kuwoPalettes.light,
    on: kuwoOnDark,
    isDark,
  }), [isDark])
}

export default useKuwoTheme
