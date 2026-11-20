import type { SkinDefinition } from '../types'
import { kugouPalettes } from './palette'
import HomeHorizontal from './HomeHorizontal'
import HomeVertical from './HomeVertical'
import PlayDetailHorizontal from './playDetail/Horizontal'
import PlayDetailVertical from './playDetail/Vertical'

/**
 * 酷狗音乐车机版皮肤
 *
 * 已接管：横屏首页、竖屏首页、横屏播放页、竖屏播放页四套版式。
 * - 配色取酷狗车机版基线（蓝三档渐变 + 深棕底 + 金色强调 + 粉色次强调）；
 * - 昼夜两套色板，跟随系统主题自动切换；
 * - 播放控制、歌词滚动、进度、列表弹层全部复用洛雪既有能力，不改播放器内核。
 */
const kugouSkin: SkinDefinition = {
  id: 'kugou',
  name: '酷狗音乐车机版',
  description: '首页与播放页采用酷狗音乐车机版版式（蓝金深棕），支持昼夜自动切换',
  palettes: kugouPalettes,
  HomeHorizontal,
  HomeVertical,
  PlayDetailHorizontal,
  PlayDetailVertical,
}

export default kugouSkin
