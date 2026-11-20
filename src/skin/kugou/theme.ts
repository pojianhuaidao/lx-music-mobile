import { useMemo } from 'react'
import useIsDark from '../useSkinMode'
import { kugouOnDark, kugouPalettes } from './palette'
import type { KugouOnColor, KugouPalette } from './palette'

export interface KugouTheme {
  /** 当前昼夜色板 */
  palette: KugouPalette
  /** 深底上的前景色（播放页、迷你播放条） */
  on: KugouOnColor
  /** 当前是否深色 */
  isDark: boolean
}

/**
 * 酷狗音乐皮肤取色入口
 *
 * 跟随全局主题昼夜状态：系统切换白天/黑夜后自动在 kugouPalettes.light / dark 间切换。
 */
export const useKugouTheme = (): KugouTheme => {
  const isDark = useIsDark()
  return useMemo(() => ({
    palette: isDark ? kugouPalettes.dark : kugouPalettes.light,
    on: kugouOnDark,
    isDark,
  }), [isDark])
}

export default useKugouTheme
