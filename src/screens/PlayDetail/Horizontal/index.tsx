import { memo } from 'react'
import { useSkin } from '@/skin'
import Default from './Default'

export default memo(({ componentId }: { componentId: string }) => {
  const skin = useSkin()
  const SkinPlayDetail = skin.PlayDetailHorizontal
  return SkinPlayDetail ? <SkinPlayDetail componentId={componentId} /> : <Default componentId={componentId} />
})
