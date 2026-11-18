import { memo, useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import StatusBar from '@/components/common/StatusBar'
import Main from '@/screens/Home/Horizontal/Main'
import commonState from '@/store/common/state'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { setNavActiveId } from '@/core/common'
import { navigations } from '@/navigation'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { kuwoPalette } from './palette'
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
  const navActiveId = useNavActiveId()
  const statusBarHeight = useStatusbarHeight()
  // true = 处于酷我推荐首页；false = 已进入某个导航分组页
  const [isHome, setIsHome] = useState(true)

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
            <NowPlayingCard onOpenPlayDetail={handleOpenPlayDetail} onOpenLove={handleOpenLove} />
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

const styles = createStyle({
  container: {
    flex: 1,
    backgroundColor: kuwoPalette.background,
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
    backgroundColor: kuwoPalette.card,
    borderRadius: kuwoPalette.radius,
    overflow: 'hidden',
  },
  rightCol: {
    flex: 16,
  },
})
