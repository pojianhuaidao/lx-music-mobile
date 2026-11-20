import { useMemo } from 'react'
import useIsDark from '../useSkinMode'
import { qqOnDark, qqPalettes } from './palette'
import type { QqOnColor, QqPalette } from './palette'

export interface QqTheme {
  /** 当前昼夜色板 */
  palette: QqPalette
  /** 深底上的前景色（播放页、迷你播放条） */
  on: QqOnColor
  /** 当前是否深色 */
  isDark: boolean
}

/**
 * QQ音乐皮肤取色入口
 *
 * 跟随全局主题昼夜状态：系统切换白天/黑夜后自动在 qqPalettes.light / dark 间切换。
 */
export const useQqTheme = (): QqTheme => {
  const isDark = useIsDark()
  return useMemo(() => ({
    palette: isDark ? qqPalettes.dark : qqPalettes.light,
    on: qqOnDark,
    isDark,
  }), [isDark])
}

export default useQqTheme
