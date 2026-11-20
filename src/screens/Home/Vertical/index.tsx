import { useSkin } from '@/skin'
import Default from './Default'

export default () => {
  const skin = useSkin()
  const SkinHome = skin.HomeVertical
  return SkinHome ? <SkinHome /> : <Default />
}
