import { memo, useCallback, useRef, useEffect } from 'react'
import { type LayoutChangeEvent, StyleSheet, View, StatusBar, Dimensions } from 'react-native'
import commonState from '@/store/common/state'
import settingState from '@/store/setting/state'
import { setStatusbarHeight } from '@/core/common'
import { windowSizeTools, getWindowSize } from '@/utils/windowSizeTools'

const getStatusbarHeight = (winHeight: number, layoutHeight: number) => {
  const height = (!settingState.setting['common.alwaysKeepStatusbarHeight'] &&
          parseFloat(winHeight.toFixed(2)) >= parseFloat(layoutHeight.toFixed(2)))
    ? 0
    : (StatusBar.currentHeight ?? 0)

  return height
}

export default memo(() => {
  const currentHeightRef = useRef(commonState.statusbarHeight)
  const sizeRef = useRef([0, 0])
  const MeasureViewRef = useRef<View>(null)

  const applySize = useCallback((width: number, height: number) => {
    if (!width || !height) return
    // 先立即用根视图实测尺寸更新布局基准：
    // 全屏切系统虚拟 PiP 时，原生尺寸查询是异步桥调用，过渡期间会滞后，
    // 原来只在异步回调里 setWindowSize，导致小窗里仍按全屏尺寸布局
    windowSizeTools.setWindowSize(width, height)
    void getWindowSize().then(size => {
      sizeRef.current = [size.height, height]
      const statusbarHeight = getStatusbarHeight(size.height, height)

      if (currentHeightRef.current != statusbarHeight) {
        currentHeightRef.current = statusbarHeight
        setStatusbarHeight(statusbarHeight)
      }
    }).catch(() => {
      sizeRef.current = [height, height]
    })
  }, [])

  const handleLayout = useCallback(({ nativeEvent: { layout } }: LayoutChangeEvent | { nativeEvent: { layout: { width: number, height: number } } }) => {
    // 车机进出小窗时根视图会重新 layout，必须每次都应用新尺寸，
    // 原来的一次性闸门（dimensionsChangedRef）会让后续尺寸变化被丢弃
    applySize(layout.width, layout.height)
  }, [applySize])

  useEffect(() => {
    // Dimensions change 时根视图不一定触发 onLayout（例如仅 density 变化、
    // ROM 直接改 configuration 的场景），这里主动重新测量兜底
    let timer: ReturnType<typeof setTimeout> | null = null
    const subscription = Dimensions.addEventListener('change', () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        MeasureViewRef.current?.measureInWindow((x, y, width, height) => {
          if (width && height) {
            applySize(width, height)
          } else {
            const window = Dimensions.get('window')
            applySize(window.width, window.height)
          }
        })
      }, 100)
    })
    void windowSizeTools.refresh()

    const handleSettingUpdate = (keys: Array<keyof LX.AppSetting>) => {
      if (!keys.includes('common.alwaysKeepStatusbarHeight') || !sizeRef.current[1]) return
      const height = getStatusbarHeight(sizeRef.current[0], sizeRef.current[1])

      if (currentHeightRef.current != height) {
        currentHeightRef.current = height
        setStatusbarHeight(height)
      }
    }
    global.state_event.on('configUpdated', handleSettingUpdate)

    return () => {
      if (timer) clearTimeout(timer)
      subscription.remove()
      global.state_event.off('configUpdated', handleSettingUpdate)
    }
  }, [applySize])
  return (<View ref={MeasureViewRef} style={StyleSheet.absoluteFill} onLayout={handleLayout} />)
}, () => true)
