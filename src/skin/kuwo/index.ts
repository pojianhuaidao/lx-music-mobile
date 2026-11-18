import type { SkinDefinition } from '../types'
import { kuwoPalette } from './palette'
import HomeHorizontal from './HomeHorizontal'

/**
 * 酷我车机版皮肤
 *
 * 第一阶段仅接管横屏首页骨架：
 * - HomeVertical / PlayDetailHorizontal 不提供，竖屏首页与播放页走洛雪原生实现；
 * - 播放器内核、状态管理、业务页面均复用洛雪既有实现。
 */
const kuwoSkin: SkinDefinition = {
  id: 'kuwo',
  name: '酷我车机版',
  description: '横屏首页采用酷我车机版版式，其他页面保持洛雪原版',
  palette: kuwoPalette,
  HomeHorizontal,
}

export default kuwoSkin
