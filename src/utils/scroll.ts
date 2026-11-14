import { type NativeScrollEvent, type FlatList, type NativeSyntheticEvent } from 'react-native'

const easeInOutQuad = (t: number, b: number, c: number, d: number): number => {
  t /= d / 2
  if (t < 1) return (c / 2) * t * t + b
  t--
  return (-c / 2) * (t * (t - 2) - 1) + b
}

type Noop = () => void
const noop: Noop = () => {}

type ScrollElement<T> = {
  lx_scrollLockKey?: number
  lx_scrollNextParams?: [ScrollElement<FlatList<any>>, NativeSyntheticEvent<NativeScrollEvent>['nativeEvent'], number, number, Noop]
  lx_scrollTimeout?: NodeJS.Timeout
  lx_scrollDelayTimeout?: NodeJS.Timeout
} & T

const handleScrollY = (element: ScrollElement<FlatList<any>>, info: NativeSyntheticEvent<NativeScrollEvent>['nativeEvent'], to: number, duration = 300, fn = noop): Noop => {
  if (element == null) {
    fn()
    return noop
  }

  const clean = () => {
    element.lx_scrollLockKey = undefined
    element.lx_scrollNextParams = undefined
    if (element.lx_scrollTimeout) clearTimeout(element.lx_scrollTimeout)
    element.lx_scrollTimeout = undefined
  }

  // 入口防御：目标位置或当前偏移不是有效数字时直接放弃，并把完成回调交给调用方，
  // 避免 NaN 一路传到 scrollToOffset 后表现为「静默不滚动」
  if (!Number.isFinite(to)) {
    console.warn('[scroll] invalid scroll target, ignored:', to)
    fn()
    return noop
  }
  let start = info.contentOffset.y
  if (!Number.isFinite(start)) {
    console.warn('[scroll] invalid contentOffset.y, ignored:', start)
    fn()
    return noop
  }

  if (element.lx_scrollLockKey) {
    // 锁冲突：说明上一个动画还在跑。旧逻辑只把新目标塞进 lx_scrollNextParams 并返回 clean，
    // 而 clean 会清掉正在运行的动画定时器，导致旧动画被中断、新目标也没人消费，
    // 现象就是「该滚的时候不滚」。这里改为先 clean 结束旧动画，再让本次调用重新排队执行。
    clean()
  }

  if (to > start) {
    const maxScrollTop = info.contentSize.height - info.layoutMeasurement.height
    if (Number.isFinite(maxScrollTop)) {
      if (to > maxScrollTop) to = maxScrollTop
    }
  } else if (to < start) {
    if (to < 0) to = 0
  } else {
    fn()
    return noop
  }
  let change = to - start
  const increment = 10
  if (!change) {
    fn()
    return noop
  }

  let currentTime = 0
  let val: number
  let key = Math.random()

  const animateScroll = () => {
    element.lx_scrollTimeout = undefined
    // if (element.lx_scrollNextParams && currentTime > duration * 0.75) {
    //   const [_element, info, _to, duration, fn] = element.lx_scrollNextParams
    //   if (to > _to && info.contentOffset.y < val) info.contentOffset.y = val
    //   clean()
    //   handleScrollY(_element, info, _to, duration, fn)
    //   return
    // }
    // if (element.lx_scrollLockKey != key) {
    //   if (element.lx_scrollNextParams) {
    //     // element.lx_scrollNextParams[1].contentOffset.y = val
    //     // handleScrollY(element.lx_scrollNextParams[0], element.lx_scrollNextParams[1], element.lx_scrollNextParams[2], element.lx_scrollNextParams[3], element.lx_scrollNextParams[4])
    //     start = val
    //     info = element.lx_scrollNextParams[1]
    //     to = element.lx_scrollNextParams[2]
    //     fn = element.lx_scrollNextParams[4]
    //     if (to > start) {
    //       let maxScrollTop = info.contentSize.height - info.layoutMeasurement.height
    //       if (to > maxScrollTop) to = maxScrollTop
    //     } else if (to < start) {
    //       if (to < 0) to = 0
    //     } else {
    //       clean()
    //       fn()
    //       return
    //     }
    //     change = to - val

    //     element.lx_scrollLockKey = key
    //   } else {
    //     fn()
    //     return
    //   }
    // }
    currentTime += increment
    val = Math.trunc(easeInOutQuad(currentTime, start, change, duration))
    element.scrollToOffset({ offset: val, animated: false })
    if (currentTime < duration) {
      element.lx_scrollTimeout = setTimeout(animateScroll, increment)
    } else {
      if (element.lx_scrollNextParams) {
        const [_element, info, _to, duration, fn] = element.lx_scrollNextParams
        if (to > _to && info.contentOffset.y < val) info.contentOffset.y = val
        info.contentOffset.y = val
        clean()
        handleScrollY(_element, info, _to, duration, fn)
      } else {
        clean()
        fn()
      }
    }
  }

  element.lx_scrollLockKey = key
  animateScroll()

  return clean
}
/**
  * 设置滚动条位置
  * @param element 要设置滚动的容器 dom
  * @param to 滚动的目标位置
  * @param duration 滚动完成时间 ms
  * @param fn 滚动完成后的回调
  * @param delay 延迟执行时间
  */
export const scrollTo = (element: ScrollElement<FlatList<any>>, info: NativeSyntheticEvent<NativeScrollEvent>['nativeEvent'], to: number, duration = 300, fn = () => {}, delay = 0): () => void => {
  let cancelFn: () => void
  if (element.lx_scrollDelayTimeout != null) {
    clearTimeout(element.lx_scrollDelayTimeout)
    element.lx_scrollDelayTimeout = undefined
  }
  if (delay) {
    let scrollCancelFn: Noop
    cancelFn = () => {
      if (element.lx_scrollDelayTimeout == null) {
        scrollCancelFn?.()
      } else {
        clearTimeout(element.lx_scrollDelayTimeout)
        element.lx_scrollDelayTimeout = undefined
      }
    }
    element.lx_scrollDelayTimeout = setTimeout(() => {
      element.lx_scrollDelayTimeout = undefined
      scrollCancelFn = handleScrollY(element, info, to, duration, fn)
    }, delay)
  } else {
    cancelFn = handleScrollY(element, info, to, duration, fn) ?? noop
  }
  return cancelFn
}

