import { Dimensions } from 'react-native'
import { getWindowSize as getWindowSizeRaw } from './nativeModules/utils'
// import { log } from './log'

export type SizeHandler = (size: { width: number, height: number }) => void
export const getWindowSize = async() => {
  return getWindowSizeRaw().then((size) => {
    const scale = Dimensions.get('window').scale
    size.width = size.width / scale
    size.height = size.height / scale
    return size
  })
}

/**
 * 直接从 Dimensions 同步读取当前窗口尺寸（dp）。
 * 车机进出小窗时 ROM 会直接改 configuration（density 1.5 ↔ 1.0、可用区变化），
 * Dimensions.get('window') 每次读取都会反映当前 configuration，不依赖是否派发
 * 'change' 事件；其语义与根视图 layout 尺寸一致（不含状态栏），
 * 因此作为刷新基准，避免与 SizeView 的写入互相覆盖。
 */
export const getWindowSizeFromDimensions = () => {
  const window = Dimensions.get('window')
  return {
    width: Math.round(window.width),
    height: Math.round(window.height),
  }
}

export const windowSizeTools = {
  size: {
    width: 0,
    height: 0,
  },
  listeners: [] as SizeHandler[],
  getSize() {
    return this.size
  },
  onSizeChanged(handler: SizeHandler) {
    this.listeners.push(handler)

    return () => {
      this.listeners.splice(this.listeners.indexOf(handler), 1)
    }
  },
  /**
   * 应用一次尺寸，尺寸未变化时不做任何广播。
   * @returns 是否发生了实际更新
   */
  applySize(size: { width: number, height: number }) {
    const width = Math.round(size.width)
    const height = Math.round(size.height)
    if (!width || !height) return false
    if (this.size.width === width && this.size.height === height) return false
    this.size = { width, height }
    for (const handler of [...this.listeners]) {
      try {
        handler(this.size)
      } catch (err) {
        console.error('[windowSizeTools] size handler error', err)
      }
    }
    return true
  },
  /**
   * 重新读取窗口尺寸并广播。
   * 用于进出小窗 / 双小窗并存 / ROM recreate 后刷新布局基准。
   * 使用 Dimensions 同步取值：它直接反映当前 configuration，
   * 不存在异步桥延迟，也不会因 ROM 未派发 change 事件而取到旧值。
   */
  async refresh() {
    this.applySize(getWindowSizeFromDimensions())
    return this.size
  },
  async init() {
    const size = await getWindowSize()
    // log.info('win size', size)
    if (size.width) {
      this.applySize(size)
    } else {
      this.applySize(getWindowSizeFromDimensions())
    }
    // 监听 configuration 变化（车机小窗切换会改变 density 与可用区），
    // 原来的监听被整段注释导致小窗下尺寸永远停留在全屏值
    let timer: ReturnType<typeof setTimeout> | null = null
    Dimensions.addEventListener('change', () => {
      // 合并短时间内的多次 change，避免布局抖动
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void this.refresh()
      }, 100)
    })
    // console.log('init windowSizeTools')
    return size
  },
  setWindowSize(width: number, height: number) {
    this.applySize({ width, height })
  },
}
