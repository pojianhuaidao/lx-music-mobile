import type { SkinDefinition } from '../types'
import { neteasePalettes } from './palette'
import HomeHorizontal from './HomeHorizontal'
import HomeVertical from './HomeVertical'
import PlayDetailHorizontal from './playDetail/Horizontal'
import PlayDetailVertical from './playDetail/Vertical'

/**
 * 网易云音乐车机版皮肤
 *
 * 已接管：横屏首页、竖屏首页、横屏播放页、竖屏播放页四套版式。
 * - 配色取网易云车机版基线（红三档 + 深蓝黑底 + 卡片深蓝灰 + 次级蓝）；
 * - 昼夜两套色板，跟随系统主题自动切换；
 * - 播放控制、歌词滚动、进度、列表弹层全部复用洛雪既有能力，不改播放器内核。
 */
const neteaseSkin: SkinDefinition = {
  id: 'netease',
  name: '网易云音乐车机版',
  description: '首页与播放页采用网易云音乐车机版版式（红白与深蓝黑双态），支持昼夜自动切换',
  palettes: neteasePalettes,
  HomeHorizontal,
  HomeVertical,
  PlayDetailHorizontal,
  PlayDetailVertical,
}

export default neteaseSkin
