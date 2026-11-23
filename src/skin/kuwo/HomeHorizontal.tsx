import { useMemo, memo, useCallback, useEffect, useState } from 'react'
import { ScrollView, View, PixelRatio, type LayoutChangeEvent } from 'react-native'
import StatusBar from '@/components/common/StatusBar'
import Main from '@/screens/Home/Horizontal/Main'
import commonState from '@/store/common/state'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { setNavActiveId } from '@/core/common'
import { navigations } from '@/navigation'
import useWindowSize from '@/utils/hooks/useWindowSize'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { useKuwoTheme } from './theme'
import type { KuwoOnColor, SkinPalette } from './palette'
import TopBar, { type KuwoNavId } from './parts/TopBar'
import NavRail from './parts/NavRail'
import NowPlayingCard from './parts/NowPlayingCard'
import ContentGrid from './parts/ContentGrid'

/**
 * 酷我车机版横屏首页骨架
 *
 * 版式：左栏正在播放（18%）｜中部推荐（35%）｜精选（31%）｜右侧快捷入口（16%）。
 * 进入任一导航分组后，中部 + 精选区域让位给洛雪原生分组页面，
 * 以保证皮肤只改骨架、不重写业务页面。
 */
export default memo(() => {
  const { palette: skinPalette, on: skinOn } = useKuwoTheme()
  // 订阅窗口尺寸：改分辨率 / 旋屏 / 进出小窗后立即用新的缩放基准重算样式
  const winSize = useWindowSize()
  const winW = winSize.width
  const winH = winSize.height
  const styles = useMemo(() => createStyles(skinPalette, skinOn), [skinPalette, skinOn, winW, winH])
  const navActiveId = useNavActiveId()
  const statusBarHeight = useStatusbarHeight()
  // true = 处于酷我推荐首页；false = 已进入某个导航分组页
  const [isHome, setIsHome] = useState(true)
  // 左栏滚动视口高度（dp）：供播放卡决定封面能占多高，保证进度/时长/三键不被挤出
  const [cardViewportH, setCardViewportH] = useState(0)

  const handleCardViewportLayout = useCallback((e: LayoutChangeEvent) => {
    const px = e.nativeEvent.layout.height
    if (!Number.isFinite(px) || px <= 0) return
    // 卡片内部尺寸已全部按「物理 dp + 硬上限」给出（不再乘 fontSize），故此处只折算屏幕密度，
    // 与 NowPlayingCard 中实测卡宽（px / PixelRatio）保持同一口径
    const dp = Math.round(px / PixelRatio.get())
    if (dp <= 0) return
    setCardViewportH(prev => (Math.abs(prev - dp) > 1 ? dp : prev))
  }, [])

  useEffect(() => {
    const handleUpdate = () => {
      requestAnimationFrame(() => {
        setIsHome(false)
      })
    }
    global.state_event.on('navActiveIdUpdated', handleUpdate)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleUpdate)
    }
  }, [])

  const handleHome = useCallback(() => {
    setIsHome(true)
  }, [])

  const handleOpen = useCallback((id: KuwoNavId) => {
    setIsHome(false)
    setNavActiveId(id)
  }, [])

  const handleOpenLove = useCallback(() => {
    handleOpen('nav_love')
  }, [handleOpen])

  const handleOpenPlayDetail = useCallback(() => {
    navigations.pushPlayDetailScreen(commonState.componentIds.home!)
  }, [])

  return (
    <>
      <StatusBar />
      <View style={{ ...styles.container, paddingTop: statusBarHeight + scaleSizeH(6) }}>
        <TopBar activeId={navActiveId} isHome={isHome} onOpen={handleOpen} onHome={handleHome} />
        <View style={styles.body}>
          <View style={styles.leftCol}>
            {/* 左栏用纵向 ScrollView 承载播放卡：卡片高度由内容自然撑开，
                内容超出左栏视口时上下滚动，绝不裁切、不隐藏任何一行。
                onLayout 只测「视口」高度（由 flex:1 决定，与内容高度无关，
                不会形成 内容高→视口高→内容高 的测量闭环），传给卡片约束封面尺寸 */}
            <ScrollView
              style={styles.cardScroll}
              contentContainerStyle={styles.cardScrollContent}
              showsVerticalScrollIndicator={false}
              onLayout={handleCardViewportLayout}
            >
              <NowPlayingCard
                onOpenPlayDetail={handleOpenPlayDetail}
                onOpenLove={handleOpenLove}
                availableHeight={cardViewportH}
              />
            </ScrollView>
          </View>
          {
            isHome
              ? (
                  <>
                    <View style={styles.centerCol}>
                      <ContentGrid variant="recommend" onOpen={handleOpen} />
                    </View>
                    <View style={styles.featuredCol}>
                      <ContentGrid variant="featured" onOpen={handleOpen} />
                    </View>
                  </>
                )
              : (
                  <View style={styles.pageCol}>
                    <Main />
                  </View>
                )
          }
          <View style={styles.rightCol}>
            <NavRail activeId={isHome ? null : navActiveId} onOpen={handleOpen} onHome={handleHome} />
          </View>
        </View>
      </View>
    </>
  )
})

const createStyles = (skinPalette: SkinPalette, skinOn: KuwoOnColor) => createStyle({
  container: {
    flex: 1,
    backgroundColor: skinPalette.background,
    paddingHorizontal: scaleSizeW(8),
    paddingBottom: scaleSizeH(8),
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  leftCol: {
    flex: 18,
    paddingRight: scaleSizeW(6),
  },
  // 左栏滚动容器：只负责视口，不限制内容高度、不做 flexGrow
  cardScroll: {
    flex: 1,
  },
  cardScrollContent: {
    flexGrow: 0,
    flexShrink: 0,
    // 固定 2dp：卡片内已在 SAFE_MARGIN(8dp) 中预留余量，此处不得再用 scaleSizeH 放大
    paddingBottom: 2,
  },
  centerCol: {
    flex: 35,
    paddingRight: scaleSizeW(6),
  },
  featuredCol: {
    flex: 31,
    paddingRight: scaleSizeW(6),
  },
  pageCol: {
    flex: 66,
    paddingRight: scaleSizeW(6),
    backgroundColor: skinPalette.card,
    borderRadius: skinPalette.radius,
    overflow: 'hidden',
  },
  rightCol: {
    flex: 16,
  },
})
