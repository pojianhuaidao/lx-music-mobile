import type { SkinDefinition } from '../types'
import { kuwoPalettes } from './palette'
import HomeHorizontal from './HomeHorizontal'
import PlayDetailHorizontal from './playDetail/Horizontal'
import PlayDetailVertical from './playDetail/Vertical'

/**
 * 酷我车机版皮肤
 *
 * 已接管：横屏首页骨架、横屏播放页、竖屏播放页。
 * - 竖屏首页不提供，走洛雪原生实现；
 * - 播放页只替换版式与配色，歌词滚动、进度、播放控制全部复用洛雪既有能力；
 * - 昼夜两套色板随机系统主题自动切换；
 * - 播放器内核、状态管理与业务页面均复用洛雪既有实现，不做改动。
 */
const kuwoSkin: SkinDefinition = {
  id: 'kuwo',
  name: '酷我车机版',
  description: '首页与播放页采用酷我车机版版式，支持昼夜自动切换',
  palettes: kuwoPalettes,
  HomeHorizontal,
  PlayDetailHorizontal,
  PlayDetailVertical,
}

export default kuwoSkin
