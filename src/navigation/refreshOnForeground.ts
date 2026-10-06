import { AppState, DeviceEventEmitter } from 'react-native'
import { Navigation } from 'react-native-navigation'
import commonState from '@/store/common/state'
import { COMPONENT_IDS } from '@/config/constant'

let refreshTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 刷新当前 RNN 界面：向已注册的屏幕下发 refreshTick 触发组件重渲染，
 * 修复系统强制小窗/后台恢复时界面停留在空白或旧状态的问题。
 */
const refreshCurrentScreen = () => {
  // 短时间内的多次触发合并为一次，避免频繁重渲染
  if (refreshTimer) return
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    // 优先刷新当前可见的栈顶组件，避免刷新栈底引发布局/重绘竞争导致界面横跳
    const componentId = commonState.componentIds[COMPONENT_IDS.playDetail]
      ?? commonState.componentIds[COMPONENT_IDS.songlistDetail]
      ?? commonState.componentIds[COMPONENT_IDS.comment]
      ?? commonState.componentIds[COMPONENT_IDS.home]
    if (componentId) Navigation.updateProps(componentId, { refreshTick: Date.now() })
  }, 400)
}

/**
 * 监听前台恢复刷新事件：
 * - native 事件：MainActivity 在 onNewIntent / 退出多窗口小窗时发送 lxMusicRefresh
 * - AppState 兜底：回到前台 active 时同样触发刷新
 */
export const listenRefreshEvent = () => {
  DeviceEventEmitter.addListener('lxMusicRefresh', refreshCurrentScreen)
  AppState.addEventListener('change', (state) => {
    if (state === 'active') refreshCurrentScreen()
  })
}
