import { useMemo } from 'react'
import useIsDark from '../useSkinMode'
import { neteaseOnDark, neteasePalettes } from './palette'
import type { NeteaseOnColor, NeteasePalette } from './palette'

export interface NeteaseTheme {
  /** 当前昼夜色板 */
  palette: NeteasePalette
  /** 深底上的前景色（播放页、迷你播放条） */
  on: NeteaseOnColor
  /** 当前是否深色 */
  isDark: boolean
}

/**
 * 网易云音乐皮肤取色入口
 *
 * 跟随全局主题昼夜状态：系统切换白天/黑夜后自动在 neteasePalettes.light / dark 间切换。
 */
export const useNeteaseTheme = (): NeteaseTheme => {
  const isDark = useIsDark()
  return useMemo(() => ({
    palette: isDark ? neteasePalettes.dark : neteasePalettes.light,
    on: neteaseOnDark,
    isDark,
  }), [isDark])
}

export default useNeteaseTheme
