import { useEffect } from 'react'
// import { View, StyleSheet } from 'react-native'
import { useWindowSize } from '@/utils/hooks'
import { getPlayDetailLayout } from '@/utils/windowBreakpoints'

import Vertical from './Vertical'
import Horizontal from './Horizontal'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'

export default ({ componentId }: { componentId: string }) => {
  const winSize = useWindowSize()

  // 车机小窗态宽度约 726dp、双小窗并存时更窄，左右分栏会把歌词区压到不可读，
  // 因此宽度不足时回退为上下布局（竖屏播放页）。
  // 2400x896 / 2270x896 / 2224x856 / 1475x856 / 726x856 这几种已适配分辨率
  // 由 windowBreakpoints 的分辨率画像直接给出布局，避免宽高比推断在边界值上漂移。
  const useHorizontalLayout = getPlayDetailLayout(winSize.width, winSize.height) === 'horizontal'

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
