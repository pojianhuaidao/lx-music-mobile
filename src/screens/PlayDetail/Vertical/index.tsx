import { memo } from 'react'
import { useSkin } from '@/skin'
import Default from './Default'

/**
 * 竖屏播放页入口
 *
 * 与横屏入口保持一致：皮肤提供 PlayDetailVertical 时优先渲染皮肤实现，
 * 未提供时（default 皮肤）走洛雪原生实现，渲染结果与改造前完全等价。
 */
export default memo(({ componentId }: { componentId: string }) => {
  const skin = useSkin()
  const SkinPlayDetail = skin.PlayDetailVertical
  return SkinPlayDetail ? <SkinPlayDetail componentId={componentId} /> : <Default componentId={componentId} />
})
