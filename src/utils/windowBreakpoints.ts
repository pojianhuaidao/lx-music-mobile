/**
 * 窗口形态断点定义
 *
 * 车机双形态实测数据（E:\适配车机数据 交接单/配置）：
 * - 全屏态 display 0：物理 2400x896 px，density 1.5，app_bounds 2270x896 px
 *   → dp 约 1513x597，宽高比 2.68，横屏
 * - 小窗态 display 13：物理 726x856 px，density 1.0
 *   → dp 726x856，宽高比 0.85，竖屏
 * - 两个小窗并存时可用宽度进一步收窄（约 363dp 或高度折半）
 *
 * 因此布局形态不能只看宽高比，还要看是否有足够的宽度/高度承载左右分栏。
 */

/** 采用左右分栏（横屏）布局所需的最小窗口宽度（dp） */
export const HORIZONTAL_MIN_WIDTH = 640
/** 采用左右分栏（横屏）布局所需的最小窗口高度（dp） */
export const HORIZONTAL_MIN_HEIGHT = 360
/** 播放页使用左右分栏所需的最小宽度（dp），低于该值回退上下布局（小窗 726dp 走上下布局） */
export const PLAY_DETAIL_HORIZONTAL_MIN_WIDTH = 800
/** 播放页使用左右分栏所需的最小高度（dp） */
export const PLAY_DETAIL_HORIZONTAL_MIN_HEIGHT = 360
/** 紧凑宽度上限（dp）：双小窗并存、三分离小窗等场景可用宽度会明显变小 */
export const COMPACT_WIDTH = 420
/** 紧凑高度上限（dp）：上下排列的双小窗可用高度会明显变小 */
export const COMPACT_HEIGHT = 520

export interface WindowMetrics {
  width: number
  height: number
  /** 宽高比 */
  ratio: number
  /** 是否为左右分栏布局 */
  isHorizontalMode: boolean
  /** 是否为窄窗口（双小窗并存等） */
  isCompactWidth: boolean
  /** 是否为矮窗口（上下排列的双小窗等） */
  isCompactHeight: boolean
  /** 是否需要压缩内边距/尺寸 */
  isCompact: boolean
}

export const getWindowMetrics = (width: number, height: number): WindowMetrics => {
  const safeWidth = width > 0 ? width : 0
  const safeHeight = height > 0 ? height : 0
  const ratio = safeHeight > 0 ? safeWidth / safeHeight : 0
  const isCompactWidth = safeWidth > 0 && safeWidth < COMPACT_WIDTH
  const isCompactHeight = safeHeight > 0 && safeHeight < COMPACT_HEIGHT
  return {
    width: safeWidth,
    height: safeHeight,
    ratio,
    isHorizontalMode: ratio > 1.2 && safeWidth >= HORIZONTAL_MIN_WIDTH && safeHeight >= HORIZONTAL_MIN_HEIGHT,
    isCompactWidth,
    isCompactHeight,
    isCompact: isCompactWidth || isCompactHeight,
  }
}
