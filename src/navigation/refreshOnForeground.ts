import { AppState, DeviceEventEmitter } from 'react-native'
import { Navigation } from 'react-native-navigation'
import commonState from '@/store/common/state'
import { windowSizeTools } from '@/utils/windowSizeTools'

let refreshTimer: ReturnType<typeof setTimeout> | null = null

const dispatchTick = (tick: number) => {
  const ids = Object.values(commonState.componentIds).filter(Boolean)
  if (!ids.length) return
  for (const componentId of ids) {
    try {
      Navigation.updateProps(componentId, { refreshTick: tick })
    } catch {
      // 组件可能已销毁，忽略
    }
  }
  // 兜底：通知需要自行刷新数据的列表页（歌单/排行榜等）
  DeviceEventEmitter.emit('lxMusicUiRefresh', tick)
}

/**
 * 刷新当前 RNN 界面：向所有已挂载的屏幕下发 refreshTick 触发组件重渲染，
 * 修复系统强制小窗/画中画恢复时界面停留在旧画面（画面不跟随）的问题。
 *
 * 注意：必须遍历所有已注册的屏幕，而不是只取第一个命中的。
 * RNN 栈里 home 通常常驻，只刷它会导致用户当前真正在看的
 * 播放详情页/歌单详情页/设置页得不到刷新，画面停留在小窗里的旧帧。
 *
 * 车机进出小窗时 configuration（density、可用区）会同时变化，
 * 因此刷新前必须先重新取一次窗口尺寸，否则组件会沿用全屏尺寸渲染，
 * 出现小窗内仍走横屏分栏、控件被裁切的问题。
 */
const refreshCurrentScreen = () => {
  // 短时间内的多次触发合并为一次，避免频繁重渲染
  if (refreshTimer) return
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    void windowSizeTools.refresh().then(() => {
      dispatchTick(Date.now())
    }).catch(() => {
      dispatchTick(Date.now())
    })
  }, 400)
}

/**
 * 监听前台恢复刷新事件：
 * - native 事件：MainActivity 在 onNewIntent / 进出多窗口小窗时发送 lxMusicRefresh
 * - AppState 兜底：回到前台 active 时同样触发刷新
 */
export const listenRefreshEvent = () => {
  DeviceEventEmitter.addListener('lxMusicRefresh', refreshCurrentScreen)
  AppState.addEventListener('change', (state) => {
    if (state === 'active') refreshCurrentScreen()
  })
}

export { refreshCurrentScreen }
