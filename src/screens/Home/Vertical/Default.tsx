import Content from './Content'
import PlayerBar from '@/components/player/PlayerBar'

/**
 * 洛雪原生竖屏首页
 *
 * 与改造前 screens/Home/Vertical/index.tsx 的渲染结果逐字节等价，
 * 仅作为未提供 HomeVertical 插槽的皮肤（含 default）的回落实现。
 */
export default () => {
  return (
    <>
      <Content />
      <PlayerBar isHome />
    </>
  )
}
