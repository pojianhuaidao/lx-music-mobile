import { useEffect } from 'react'
// import { View, StyleSheet } from 'react-native'
import { useHorizontalMode, useWindowSize } from '@/utils/hooks'
import { PLAY_DETAIL_HORIZONTAL_MIN_HEIGHT, PLAY_DETAIL_HORIZONTAL_MIN_WIDTH } from '@/utils/windowBreakpoints'

import Vertical from './Vertical'
import Horizontal from './Horizontal'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'

export default ({ componentId }: { componentId: string }) => {
  const isHorizontalMode = useHorizontalMode()
  const winSize = useWindowSize()

  // 车机小窗态宽度约 726dp、双小窗并存时更窄，左右分栏会把歌词区压到不可读，
  // 因此宽度不足时回退为上下布局（竖屏播放页）
  const useHorizontalLayout = isHorizontalMode &&
    winSize.width >= PLAY_DETAIL_HORIZONTAL_MIN_WIDTH &&
    winSize.height >= PLAY_DETAIL_HORIZONTAL_MIN_HEIGHT

  useEffect(() => {
    setComponentId(COMPONENT_IDS.playDetail, componentId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <PageContent>
      <StatusBar />
      {
        useHorizontalLayout
          ? <Horizontal componentId={componentId} />
          : <Vertical componentId={componentId} />
      }
    </PageContent>
  )
}
