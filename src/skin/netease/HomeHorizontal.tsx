import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import StatusBar from '@/components/common/StatusBar'
import Main from '@/screens/Home/Horizontal/Main'
import commonState from '@/store/common/state'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { setNavActiveId } from '@/core/common'
import { navigations } from '@/navigation'
import { createStyle } from '@/utils/tools'
import { scaleSizeH } from '@/utils/pixelRatio'
import BrandBar, { type NeteaseNavId } from './parts/BrandBar'
import MiniPlayerBar from './parts/MiniPlayerBar'
import { useNeteaseTheme } from './theme'
import type { NeteaseOnColor, NeteasePalette } from './palette'

/**
 * 网易云音乐车机版横屏首页骨架
 *
 * 版式对齐 网易云 车机版：顶部品牌栏 + 胶囊分类 tab + 搜索入口，
 * 中部是横向内容区（复用洛雪原生 Main 页面，保留真实数据与交互），
 * 底部悬浮圆角迷你播放条（封面 + 歌名 + 上一首/播放/下一首 + 进度）。
 */
export default memo(() => {
  const { palette: skinPalette, on: skinOn } = useNeteaseTheme()
  const styles = useMemo(() => createStyles(skinPalette, skinOn), [skinPalette, skinOn])
  const navActiveId = useNavActiveId()
  const statusBarHeight = useStatusbarHeight()
  const [activeId, setActiveId] = useState<NeteaseNavId>(navActiveId)

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

  const handleOpen = useCallback((id: NeteaseNavId) => {
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
        <BrandBar activeId={activeId} onOpen={handleOpen} />
        <View style={styles.body}>
          <Main />
        </View>
        <MiniPlayerBar onOpenPlayDetail={handleOpenPlayDetail} />
      </View>
    </>
  )
})

const createStyles = (skinPalette: NeteasePalette, skinOn: NeteaseOnColor) => createStyle({
  container: {
    flex: 1,
    backgroundColor: skinPalette.background,
  },
  body: {
    flex: 1,
    backgroundColor: skinPalette.background,
  },
})
