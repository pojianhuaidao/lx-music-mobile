import { useEffect, useState } from 'react'
import themeState from '@/store/theme/state'

/**
 * 读取当前主题昼夜状态
 *
 * 取值来源为全局主题的 isDark（theme/themes 依据 shouldUseDarkColors 选定的主题），
 * 与 ThemeProvider 下发 c-* 语义色的时机完全一致：
 * 系统昼夜变化 + 开启「跟随系统主题」时，core/init/theme 会重新 applyTheme，
 * 随后派发 themeUpdated，本 hook 随之刷新，皮肤色板即可自动切换。
 *
 * 该模块不依赖 src/skin/registry，避免皮肤组件与注册表形成循环引用。
 */
export const useIsDark = (): boolean => {
  const [isDark, setIsDark] = useState(themeState.theme.isDark ?? false)

  useEffect(() => {
    const handleThemeUpdated = (theme: LX.ActiveTheme) => {
      setIsDark(!!theme.isDark)
    }
    global.state_event.on('themeUpdated', handleThemeUpdated)
    return () => {
      global.state_event.off('themeUpdated', handleThemeUpdated)
    }
  }, [])

  return isDark
}

export default useIsDark
