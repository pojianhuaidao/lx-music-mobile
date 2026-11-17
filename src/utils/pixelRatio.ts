/**
 * Created by qianxin on 17/6/1.
 * 屏幕工具类
 * ui设计基准,iphone 6
 * width:375
 * height:667
 *
 * 注意：车机小窗态（display 13，density 1.0）与全屏态（density 1.5）之间
 * 窗口尺寸与 density 会同时变化，因此缩放基准不能在模块加载时一次性冻结，
 * 必须在每次调用时按当前窗口尺寸重新计算，否则小窗下字号/内边距偏大导致溢出。
 * 模块级常量（如各页面 HEADER_HEIGHT）仍为启动时的取值，属已知取舍；
 * 需要随窗口实时变化的尺寸请在组件内用 useWindowSize 计算。
 */
import { Dimensions, PixelRatio } from 'react-native'
import { windowSizeTools } from './windowSizeTools'

// 高保真的宽度和高度
const designWidth = 375.0
const designHeight = 667.0

// 获取屏幕的dp
const getSize = () => {
  const size = windowSizeTools.getSize()
  if (size.width && size.height) return size
  const window = Dimensions.get('window')
  return {
    width: window.width,
    height: window.height,
  }
}

let sizeKey = ''
let screenW = 375
let screenH = 667
let fontScale = 1
let pixelRatio = 3
let screenPxW = 1125
let screenPxH = 2001
let scaleW = 3
let scaleH = 3
let scale = 1

const updateScale = () => {
  const size = getSize()
  const key = `${Math.round(size.width)}x${Math.round(size.height)}`
  if (key === sizeKey) return
  sizeKey = key
  screenW = size.width
  screenH = size.height
  if (screenW > screenH) {
    const temp = screenW
    screenW = screenH
    screenH = temp
  }
  fontScale = PixelRatio.getFontScale()
  pixelRatio = PixelRatio.get()
  // 根据dp获取屏幕的px
  screenPxW = PixelRatio.getPixelSizeForLayoutSize(screenW)
  screenPxH = PixelRatio.getPixelSizeForLayoutSize(screenH)
  scaleW = screenPxW / designWidth
  scaleH = screenPxH / designHeight
  scale = Math.min(scaleW, scaleH, 3.1)
}
updateScale()

/**
 * 设置text
 * @param size  px
 * @returns dp
 */
export function getTextSize(size: number) {
  updateScale()
  const currentScaleWidth = screenW / designWidth
  const currentScaleHeight = screenH / designHeight
  const currentScale = Math.min(currentScaleWidth, currentScaleHeight, 1.3)
  size = Math.floor(size * currentScale / fontScale)
  return size
}
export function setSpText(size: number) {
  return getTextSize(size) * global.lx.fontSize
}

/**
 * 设置高度
 * @param size  px
 * @returns dp
 */
export function scaleSizeH(size: number) {
  updateScale()
  const scaleHeight = size * scale
  size = Math.floor(scaleHeight / pixelRatio)
  return size * global.lx.fontSize
}

/**
 * 设置宽度
 * @param size  px
 * @returns dp
 */
export function scaleSizeW(size: number) {
  updateScale()
  const scaleWidth = size * scale
  size = Math.floor(scaleWidth / pixelRatio)
  return size * global.lx.fontSize
}


export const scaleSizeWR = (size: number) => {
  return size * 2 - scaleSizeW(size)
}

export const scaleSizeAbsHR = (size: number) => {
  updateScale()
  const scaleHeight = size * scale
  return size * 2 - Math.floor(scaleHeight / pixelRatio)
}
