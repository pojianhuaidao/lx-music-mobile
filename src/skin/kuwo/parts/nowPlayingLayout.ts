/**
 * 酷我左栏「正在播放」卡的尺寸换算（纯函数，无 RN 依赖）。
 *
 * 第九版尺寸策略（本文件是卡片所有纵向尺寸的唯一来源）：
 * 1. 所有纵向尺寸都有**硬上限**（三键 28dp、歌名行 18dp、歌手 14dp、进度条 4dp、时长 12dp、
 *    段间距 4dp、卡片内边距 6dp）。尺寸按「视口高」线性缩放（vf ∈ [0.55, 1]）但永不超过上限，
 *    杜绝第八版「各元素按 scaleSize 放大后无上限累计、总高超出视口」的问题；
 * 2. 先算信息区总高 infoH（含内边距与各段间距），再定封面：
 *    封面 = min(内容宽, 视口高 − infoH − SAFE_MARGIN)，封面 ≥ 48dp 才渲染，优先级低于信息区与控制区；
 * 3. checkCardFit 供运行时自检与离线数值表复用，断言 总高 ≤ 视口高（一屏完整，无需上滑）；
 * 4. 本文件不依赖 RN，可单独用 tsc 编译后用 node 跑数值表。
 */

/** 左栏在 body 中占的 flex 比例（与 HomeHorizontal 的 leftCol flex:18 保持一致） */
export const LEFT_COL_RATIO = 0.18

/** 控制三键高度上限（dp） */
export const MAX_BTN_H = 28
/** 歌名行高上限（dp） */
export const MAX_TITLE_H = 18
/** 歌手上限（dp） */
export const MAX_SINGER_H = 14
/** 进度条高度上限（dp） */
export const MAX_TRACK_H = 5
// 进度条最小高度：低于 4dp 在高 dpi 车机屏上几乎不可见（r4 曾实测仅 3px）
export const MIN_TRACK_H = 4
/** 时长行高上限（dp） */
export const MAX_TIME_H = 12
/** 段间距上限（dp） */
export const MAX_GAP = 4
/** 卡片内边距上限（dp） */
export const MAX_PAD = 6
/** 控制三键高度上限（保留旧导出名，语义等同 MAX_BTN_H） */
export const CTRL_H = MAX_BTN_H
/** 封面渲染所需的最小内容宽（dp）：低于该值只渲染信息区 */
export const COVER_MIN_CONTENT_W = 72
/** 封面最小边长（dp）：剩余高不足该值时不渲染封面，保证信息区与控制区优先 */
export const COVER_MIN_SIZE = 48
/** 歌名最小字号（dp），保证至少一行可读 */
export const MIN_TITLE_FONT = 10
/** 视口高基准（dp）：以此高度为 1.0 缩放，视口更矮时整体收紧 */
export const VP_BASE = 400
/** 视口高缩放系数下限（再矮也不小于该系数，避免小到不可读） */
export const VP_SCALE_MIN = 0.55
/** 卡片总高与视口高之间必须保留的安全余量（dp） */
export const SAFE_MARGIN = 8

/** 由组件按当前窗口缩放基准换算好的输入值，单位均为 dp */
export interface CardMetricsInput {
  /** 左栏可用宽度（已扣除外层内边距与左栏右间距） */
  columnWidth: number
  /** 左栏视口可用高度（dp）：0 表示尚未测量到 */
  availableHeight: number
  padH: number
  padV: number
  loveGap: number
  titleFontBase: number
  singerHeightBase: number
  trackHeightBase: number
  timeHeightBase: number
  infoGap: number
  progGap: number
  timeGap: number
  singerGap: number
  ctrlGap: number
}

/** 换算结果，字段直接对应样式数值 */
export interface CardMetrics {
  padH: number
  padV: number
  /** 卡片内容宽（左栏宽 − 左右内边距） */
  contentW: number
  /** 是否渲染封面：内容宽够 + 剩余高度放得下最小封面 */
  showCover: boolean
  /** 封面边长（dp，宽=高，显式数字，不用 aspectRatio） */
  coverSize: number
  titleFont: number
  titleH: number
  loveIcon: number
  loveGap: number
  singerFont: number
  singerH: number
  singerGap: number
  trackH: number
  timeFont: number
  timeH: number
  progGap: number
  timeGap: number
  infoGap: number
  btnH: number
  ctrlGap: number
  ctrlIcon: number
  playIcon: number
  /** 信息区总高（含上下内边距与全部段间距），不含封面 */
  infoH: number
}

/** 一屏适配校验结果 */
export interface CardFitResult {
  /** 视口高（dp）；0 表示尚未测量到，不参与断言 */
  viewportH: number
  infoH: number
  coverSize: number
  totalH: number
  fits: boolean
}

const positiveInt = (value: number, fallback: number) => {
  const n = Math.round(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const clampInt = (value: number, min: number, max: number) => {
  const n = Math.round(value)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

/** 视口高缩放系数：视口越矮整体越紧，范围 [VP_SCALE_MIN, 1]；未测量到时按 1 处理 */
export const getViewportScale = (availableHeight: number) => {
  if (!(availableHeight > 0)) return 1
  return Math.min(1, Math.max(VP_SCALE_MIN, availableHeight / VP_BASE))
}

/**
 * 换算卡片尺寸。第九版策略：
 * - 每个纵向尺寸 = clamp(上限 × 视口高系数, 下限, 上限)，外部传入值只能让尺寸更小、不能突破上限；
 * - 先算 infoH，再由 infoH 反推封面边长，保证 总高 = infoH + 封面 ≤ 视口高。
 */
export const getCardMetrics = (input: CardMetricsInput): CardMetrics => {
  const availableHeight = Math.max(0, Math.round(input.availableHeight))
  const vf = getViewportScale(availableHeight)
  /** 按视口高缩放，并强制落在 [min, cap] 区间（cap 即硬上限） */
  const scaled = (base: number, min: number, cap: number) => clampInt(base * vf, min, cap)
  /** 外部传入值只允许更小，不允许超过上限 */
  const capped = (value: number, cap: number) => Math.min(cap, positiveInt(value, cap))

  const padH = scaled(capped(input.padH, MAX_PAD), 3, MAX_PAD)
  const padV = scaled(capped(input.padV, MAX_PAD), 3, MAX_PAD)
  const loveGap = scaled(MAX_GAP, 2, MAX_GAP)
  const infoGap = scaled(MAX_GAP, 2, MAX_GAP)
  const progGap = scaled(3, 2, 3)
  const timeGap = scaled(2, 1, 2)
  const singerGap = scaled(2, 1, 2)
  const ctrlGap = scaled(MAX_GAP, 2, MAX_GAP)
  const trackH = scaled(MAX_TRACK_H, MIN_TRACK_H, MAX_TRACK_H)
  const singerH = scaled(MAX_SINGER_H, 10, MAX_SINGER_H)
  const timeH = scaled(MAX_TIME_H, 9, MAX_TIME_H)
  const titleH = scaled(MAX_TITLE_H, 12, MAX_TITLE_H)
  const btnH = scaled(MAX_BTN_H, 20, MAX_BTN_H)

  const columnWidth = Math.max(0, Math.round(input.columnWidth))
  const contentW = Math.max(0, columnWidth - padH * 2)

  // 字号同时受行高与内容宽约束：不小于可读下限、且至少比行高小 4dp，避免文本撑破行高
  const titleFontCap = Math.min(
    titleH - 4,
    contentW > 0 ? Math.floor(contentW / 7) : MIN_TITLE_FONT,
  )
  const titleFont = Math.max(
    MIN_TITLE_FONT,
    Math.min(capped(input.titleFontBase, MAX_TITLE_H), Math.max(MIN_TITLE_FONT, titleFontCap)),
  )
  const singerFont = clampInt(Math.min(singerH - 3, 12), 8, 12)
  const timeFont = clampInt(Math.min(timeH - 2, 11), 8, 11)
  const loveIcon = clampInt(titleH - 6, 8, 12)
  const ctrlIcon = clampInt(btnH - 10, 10, 14)
  const playIcon = clampInt(btnH - 8, 11, 16)

  // 信息区固定总高：上下内边距 + 歌名/歌手 + 进度/时长 + 控制三键 + 全部段间距
  const infoH = padV * 2 + infoGap + titleH + singerGap + singerH
    + progGap + trackH + timeGap + timeH + ctrlGap + btnH

  // 封面边长：先看视口高扣掉 infoH 与安全余量后还能剩多少，再与内容宽取小
  // 视口尚未测量到时按内容宽 0.6 兜底，避免首帧封面过大再跳变
  const coverLimit = availableHeight > 0
    ? availableHeight - infoH - SAFE_MARGIN
    : Math.floor(contentW * 0.6)
  const coverSize = contentW >= COVER_MIN_CONTENT_W && coverLimit >= COVER_MIN_SIZE
    ? Math.min(contentW, coverLimit)
    : 0
  const showCover = coverSize >= COVER_MIN_SIZE

  return {
    padH,
    padV,
    contentW,
    showCover,
    coverSize: showCover ? coverSize : 0,
    titleFont,
    titleH,
    loveIcon,
    loveGap,
    singerFont,
    singerH,
    singerGap,
    trackH,
    timeFont,
    timeH,
    progGap,
    timeGap,
    infoGap,
    btnH,
    ctrlGap,
    ctrlIcon,
    playIcon,
    infoH,
  }
}

/**
 * 一屏适配自检：总高 = infoH + 封面 ≤ 视口高。
 * 视口高未测量到（0）时视为通过（不做断言）。
 */
export const checkCardFit = (metrics: CardMetrics, availableHeight: number): CardFitResult => {
  const viewportH = Math.max(0, Math.round(availableHeight))
  const coverSize = metrics.showCover ? metrics.coverSize : 0
  const totalH = metrics.infoH + coverSize
  return {
    viewportH,
    infoH: metrics.infoH,
    coverSize,
    totalH,
    fits: viewportH <= 0 || totalH <= viewportH,
  }
}

/** 离线自检用的四档参数（视口高/列宽取实测值，dp） */
export const CARD_SELF_CHECK_CASES: Array<{ name: string, viewportH: number, columnWidth: number }> = [
  { name: 'r1 2270x896@224dpi', viewportH: 326, columnWidth: 266 },
  { name: 'r2 1280x720@160dpi', viewportH: 356, columnWidth: 215 },
  { name: 'r3 1024x600@160dpi', viewportH: 440, columnWidth: 171 },
  { name: 'r4 800x480@160dpi', viewportH: 344, columnWidth: 134 },
]
