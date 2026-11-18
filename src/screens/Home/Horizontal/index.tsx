import { useSkin } from '@/skin'
import Default from './Default'

export default () => {
  const skin = useSkin()
  const SkinHome = skin.HomeHorizontal
  return SkinHome ? <SkinHome /> : <Default />
}
