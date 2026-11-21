import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import StatusBar from '@/components/common/StatusBar'
import Main from '@/screens/Home/Vertical/Main'
import commonState from '@/store/common/state'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { setNavActiveId } from '@/core/common'
import { navigations } from '@/navigation'
import useWindowSize from '@/utils/hooks/useWindowSize'
import { createStyle } from '@/utils/tools'
import { scaleSizeH } from '@/utils/pixelRatio'
import BrandBar, { type KugouNavId } from './parts/BrandBar'
import MiniPlayerBar from './parts/MiniPlayerBar'
import { useKugouTheme } from './theme'
import type { KugouOnColor, SkinPalette } from './palette'

/**
 * 酷狗音乐车机版竖屏首页骨架
 *
 * 版式对齐 酷狗 车机版竖屏：顶部品牌标题 + 搜索入口、吸顶胶囊分类 tab、
 * 中部纵向内容区（复用洛雪原生竖屏 Main）、底部悬浮迷你播放条。
 */
export default memo(() => {
  const { palette: skinPalette, on: skinOn } = useKugouTheme()
  // 订阅窗口尺寸：改分辨率 / 旋屏 / 进出小窗后立即用新的缩放基准重算样式
  const winSize = useWindowSize()
  const winW = winSize.width
  const winH = winSize.height
  const styles = useMemo(() => createStyles(skinPalette, skinOn), [skinPalette, skinOn, winW, winH])
  const navActiveId = useNavActiveId()
  const statusBarHeight = useStatusbarHeight()
  const [activeId, setActiveId] = useState<KugouNavId>(navActiveId)

  useEffect(() => {
    const handleUpdate = () => {
      requestAnimationFrame(() => {
        setActiveId(navActiveId)
      })
    }
    global.state_event.on('navActiveIdUpdated', handleUpdate)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleUpdate)
    }
  }, [navActiveId])

  const handleOpen = useCallback((id: KugouNavId) => {
    setActiveId(id)
    setNavActiveId(id)
  }, [])

  const handleOpenPlayDetail = useCallback(() => {
    navigations.pushPlayDetailScreen(commonState.componentIds.home!)
  }, [])

  return (
    <>
      <StatusBar />
      <View style={{ ...styles.container, paddingTop: statusBarHeight + scaleSizeH(4) }}>
        <BrandBar activeId={activeId} compact onOpen={handleOpen} />
        <View style={styles.body}>
          <Main />
        </View>
        <MiniPlayerBar onOpenPlayDetail={handleOpenPlayDetail} />
      </View>
    </>
  )
})

const createStyles = (skinPalette: SkinPalette, skinOn: KugouOnColor) => createStyle({
  container: {
    flex: 1,
    backgroundColor: skinPalette.background,
  },
  body: {
    flex: 1,
    backgroundColor: skinPalette.background,
  },
})
