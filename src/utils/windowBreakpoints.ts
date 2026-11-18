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

/**
 * 播放页布局形态
 * - horizontal：左右分栏（封面 + 歌词）
 * - vertical：上下布局（竖屏播放页）
 */
export type PlayDetailLayoutMode = 'horizontal' | 'vertical'

/**
 * 已适配的窗口分辨率画像
 *
 * 车机 ROM 会同时给出多种窗口尺寸，仅靠宽高比推断容易在这些“宽扁”窗口上误判：
 * 例如 2270x896（dp 1513x597，比例 2.53）与 726x856（dp 726x856，比例 0.85）
 * 的判定结果稳定，但 2224x856、1475x856 这类介于两者之间的窗口一旦 density
 * 上报与预期不一致，比例判定就会漂移到错误分支（宽度够却回退成上下布局，
 * 或高度不足却强行左右分栏导致歌词区被压扁）。
 *
 * 因此把实测分辨率与期望布局显式绑定，命中画像时以画像为准，未命中再回退到
 * 宽高比 + 最小宽高的启发式判定。
 */
export interface WindowResolutionProfile {
  /** 画像 id，取物理分辨率字符串，便于日志定位 */
  id: string
  /** 物理分辨率（px） */
  physicalWidth: number
  physicalHeight: number
  /** 该形态下 ROM 上报的 density */
  density: number
  /** 换算后的 dp 尺寸（四舍五入），用于与运行时窗口尺寸比对 */
  dpWidth: number
  dpHeight: number
  /** 播放页期望布局 */
  playDetailLayout: PlayDetailLayoutMode
  /** 是否需要压缩 NoData/控制栏等内边距 */
  compact: boolean
  /** 形态说明 */
  desc: string
}

export const WINDOW_RESOLUTION_PROFILES: WindowResolutionProfile[] = [
  {
    id: '2400x896',
    physicalWidth: 2400,
    physicalHeight: 896,
    density: 1.5,
    dpWidth: 1600,
    dpHeight: 597,
    playDetailLayout: 'horizontal',
    compact: false,
    desc: '全屏态物理分辨率（display 0 原始尺寸），左右分栏',
  },
  {
    id: '2270x896',
    physicalHeight: 896,
    physicalWidth: 2270,
    density: 1.5,
    dpWidth: 1513,
    dpHeight: 597,
    playDetailLayout: 'horizontal',
    compact: false,
    desc: '全屏态可用区（扣除状态栏/侧边），左右分栏',
  },
  {
    id: '2224x856',
    physicalWidth: 2224,
    physicalHeight: 856,
    density: 1.5,
    dpWidth: 1483,
    dpHeight: 571,
    playDetailLayout: 'horizontal',
    compact: false,
    desc: '全屏态可用区（扣除上下装饰条），左右分栏',
  },
  {
    id: '1475x856',
    physicalWidth: 1475,
    physicalHeight: 856,
    density: 1.0,
    dpWidth: 1475,
    dpHeight: 856,
    playDetailLayout: 'horizontal',
    compact: false,
    desc: '半屏/分栏窗口（左右分屏或应用分栏），宽高比 1.72，仍走左右分栏但收窄封面区',
  },
  {
    id: '726x856',
    physicalWidth: 726,
    physicalHeight: 856,
    density: 1.0,
    dpWidth: 726,
    dpHeight: 856,
    playDetailLayout: 'vertical',
    compact: false,
    desc: '竖直小窗（display 13），宽高比 0.85，回退上下布局',
  },
]

/** 画像匹配容差（dp）：ROM 上报的可用区常与物理尺寸相差几十 dp */
const PROFILE_WIDTH_TOLERANCE = 60
const PROFILE_HEIGHT_TOLERANCE = 60

/**
 * 按当前窗口尺寸（dp）匹配已适配的分辨率画像。
 * 多个候选同时命中时取尺寸偏差最小的一个。
 */
export const matchWindowProfile = (width: number, height: number): WindowResolutionProfile | null => {
  if (!(width > 0) || !(height > 0)) return null
  let matched: WindowResolutionProfile | null = null
  let matchedDistance = Number.POSITIVE_INFINITY
  for (const profile of WINDOW_RESOLUTION_PROFILES) {
    const widthDelta = Math.abs(profile.dpWidth - width)
    const heightDelta = Math.abs(profile.dpHeight - height)
    if (widthDelta > PROFILE_WIDTH_TOLERANCE || heightDelta > PROFILE_HEIGHT_TOLERANCE) continue
    const distance = widthDelta + heightDelta
    if (distance >= matchedDistance) continue
    matched = profile
    matchedDistance = distance
  }
  return matched
}

/**
 * 解析播放页应采用的布局形态。
 * 优先使用分辨率画像，未命中时回退到宽高比 + 最小宽高判定。
 */
export const getPlayDetailLayout = (width: number, height: number): PlayDetailLayoutMode => {
  const profile = matchWindowProfile(width, height)
  if (profile) return profile.playDetailLayout
  const metrics = getWindowMetrics(width, height)
  return metrics.isHorizontalMode &&
    metrics.width >= PLAY_DETAIL_HORIZONTAL_MIN_WIDTH &&
    metrics.height >= PLAY_DETAIL_HORIZONTAL_MIN_HEIGHT
    ? 'horizontal'
    : 'vertical'
}
