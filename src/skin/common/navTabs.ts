/**
 * 皮肤顶部导航条的项尺寸参数（纯函数，无 RN 依赖）。
 *
 * 背景（第七版实测根因）：
 *   1280x720 / 1024x600 / 800x480 等真横屏下，导航条外面确实是横向 ScrollView，
 *   但导航项宽度仍由「文字自然宽度」决定时，Android 端 ScrollView 的
 *   contentContainer 被 Yoga 按「视口宽度」测量（AT_MOST），子项随后参与宽度分配，
 *   flexShrink: 0 也挡不住这种由父级测量导致的挤压：
 *     netease_r2 实测内容容器 319px、四项 102/102/75/-47，末项「本地」宽为负；
 *     kugou_r2 末项 -48、kugou_r3 34、netease_r3 5。
 *   因为内容容器宽度等于视口宽度，横向滚动范围为零，所以「横滑无变化」。
 *
 * 现在的策略（显式固定宽度，不再依赖内容测量）：
 *   1. 每个导航项按「文字长度 + 字号」显式算出固定 width（含最小宽度兜底），
 *      并同时设 flexShrink: 0 / flexGrow: 0，宽度不再参与任何分配；
 *   2. 把各项宽度求和，作为 contentContainerStyle 的显式 width，
 *      内容容器必然宽于视口，横向滚动范围成立，窄档也能滑到末项；
 *   3. 内边距 / 间距 / 字号只做「保底」约束，保证窄屏下点击热区不缩到不可点。
 */

/** 导航项水平内边距下限（dp），低于此值胶囊背景过窄、热区不可靠 */
export const MIN_NAV_PAD_H = 10
/** 导航项间距下限（dp） */
export const MIN_NAV_GAP = 4
/** 导航文字字号下限（dp） */
export const MIN_NAV_FONT = 11
/** 单个导航项最小宽度下限（dp），保证 1 个字也能点中 */
export const MIN_NAV_TAB_W = 44

/** 全角字符（CJK、假名、谚文、全角标点）宽度系数，相对实际渲染字号 */
const WIDE_CHAR_RATIO = 1.34
/** 半角字符（拉丁、数字、半角标点）宽度系数，相对实际渲染字号 */
const NARROW_CHAR_RATIO = 0.72
/** 测量冗余（dp），抵消字体 hinting / includeFontPadding 带来的 1~3dp 误差 */
const TEXT_WIDTH_FUZZ = 4

export interface NavTabMetricsInput {
  /** 基准水平内边距（dp，已按屏幕缩放） */
  padH: number
  /** 基准间距（dp，已按屏幕缩放） */
  gap: number
  /** 基准字号（dp） */
  font: number
}

export interface NavTabMetrics {
  /** 导航项水平内边距（dp） */
  padH: number
  /** 导航项间距（dp） */
  gap: number
  /** 导航文字字号（dp） */
  fontSize: number
}

export const getNavTabMetrics = (input: NavTabMetricsInput): NavTabMetrics => ({
  padH: Math.max(MIN_NAV_PAD_H, Math.round(input.padH) || MIN_NAV_PAD_H),
  gap: Math.max(MIN_NAV_GAP, Math.round(input.gap) || MIN_NAV_GAP),
  fontSize: Math.max(MIN_NAV_FONT, Math.round(input.font) || MIN_NAV_FONT),
})

const isWideChar = (code: number) => (
  (code >= 0x1100 && code <= 0x115F) || // 谚文字母
  (code >= 0x2E80 && code <= 0xA4CF) || // CJK 部首 / 汉字 / 注音 / 假名等
  (code >= 0xAC00 && code <= 0xD7A3) || // 谚文音节
  (code >= 0xF900 && code <= 0xFAFF) || // CJK 兼容汉字
  (code >= 0xFE30 && code <= 0xFE4F) || // CJK 兼容标点
  (code >= 0xFF00 && code <= 0xFF60) || // 全角 ASCII / 全角标点
  (code >= 0xFFE0 && code <= 0xFFE6) // 全角符号
)

/**
 * 按「字符宽度分类 × 实际渲染字号」估算文字宽度（dp）
 * @param label 导航项文字
 * @param renderedFontSize 实际渲染字号（dp，已含字号缩放，即 setSpText 之后的值）
 */
export const estimateNavTextWidth = (label: string, renderedFontSize: number): number => {
  let width = 0
  for (const ch of label) {
    width += isWideChar(ch.codePointAt(0) ?? 0) ? renderedFontSize * WIDE_CHAR_RATIO : renderedFontSize * NARROW_CHAR_RATIO
  }
  return Math.ceil(width)
}

/**
 * 单个导航项的固定宽度（dp）＝ 文字宽度 + 左右内边距 + 测量冗余，并受最小宽度兜底
 */
export const getNavTabWidth = (label: string, renderedFontSize: number, padH: number): number => (
  Math.max(
    MIN_NAV_TAB_W,
    estimateNavTextWidth(label, renderedFontSize) + padH * 2 + TEXT_WIDTH_FUZZ,
  )
)

/**
 * 导航条内容容器的固定宽度（dp）＝ Σ(项宽 + 项间距)
 *
 * 必须显式设置到 contentContainerStyle 上，否则 Android 会把内容容器按视口宽度
 * 测量，子项被挤压且横向滚动范围为零。
 */
export const getNavTabsContentWidth = (tabWidths: number[], gap: number): number => (
  tabWidths.reduce((total, w) => total + w + gap, 0)
)
