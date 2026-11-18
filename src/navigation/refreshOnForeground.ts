import { AppState, DeviceEventEmitter } from 'react-native'
import { Navigation } from 'react-native-navigation'
import commonState from '@/store/common/state'
import { windowSizeTools } from '@/utils/windowSizeTools'

let refreshTimer: ReturnType<typeof setTimeout> | null = null
let sampleTimers: Array<ReturnType<typeof setTimeout>> = []

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
 * 小窗 Surface 的尺寸是分阶段收敛的：系统先给一个过渡尺寸，过渡动画结束后才稳定。
 * 只在某一个时间点采样，经常取到过渡值，小窗里就会保持按全屏尺寸布局的旧画面。
 * 因此在多个时间点重复采样，检测到尺寸真正变化后再补一次重渲染。
 */
const REFRESH_SAMPLE_DELAYS = [120, 320, 700, 1400]

const clearSampleTimers = () => {
  for (const timer of sampleTimers) clearTimeout(timer)
  sampleTimers = []
}

const runSample = (force: boolean) => {
  void windowSizeTools.refresh(force).then(({ changed }) => {
    if (force || changed) dispatchTick(Date.now())
  }).catch(() => {
    if (force) dispatchTick(Date.now())
  })
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
  if (refreshTimer) clearTimeout(refreshTimer)
  clearSampleTimers()
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    // 第一次强制广播：全屏与 PiP 的窗口尺寸数值有可能完全相同（只换了 Surface），
    // 若按「尺寸未变化就不广播」处理，订阅者（useWindowSize）收不到事件，
    // 界面就不会按当前窗口重新布局，表现为画面没有被刷新
    runSample(true)
    for (const delay of REFRESH_SAMPLE_DELAYS) {
      sampleTimers.push(setTimeout(() => { runSample(false) }, delay))
    }
  }, 250)
}

let refreshEventSub: ReturnType<typeof DeviceEventEmitter.addListener> | null = null
let appStateSub: ReturnType<typeof AppState.addEventListener> | null = null

/**
 * 解除刷新监听（重复调用 listenRefreshEvent 时也会先解除，避免监听叠加）。
 */
export const removeRefreshListener = () => {
  if (refreshEventSub) {
    refreshEventSub.remove()
    refreshEventSub = null
  }
  if (appStateSub) {
    appStateSub.remove()
    appStateSub = null
  }
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
  clearSampleTimers()
}

/**
 * 监听前台恢复刷新事件：
 * - native 事件：MainActivity 在 onNewIntent / 进出多窗口小窗时发送 lxMusicRefresh
 * - AppState 兜底：回到前台 active 时同样触发刷新
 */
export const listenRefreshEvent = () => {
  removeRefreshListener()
  refreshEventSub = DeviceEventEmitter.addListener('lxMusicRefresh', refreshCurrentScreen)
  appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') refreshCurrentScreen()
  })
}

export { refreshCurrentScreen }
