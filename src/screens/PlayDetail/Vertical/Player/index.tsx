import { memo, useMemo } from 'react'
import { View } from 'react-native'

// import Title from './components/Title'
import MoreBtn from './components/MoreBtn'
import PlayInfo from './components/PlayInfo'
import ControlBtn from './components/ControlBtn'
import { createStyle } from '@/utils/tools'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useWindowSize } from '@/utils/hooks'
import { COMPACT_HEIGHT, COMPACT_WIDTH } from '@/utils/windowBreakpoints'

export default memo(() => {
  const winSize = useWindowSize()
  const containerStyle = useMemo(() => {
    // 车机小窗 / 双小窗并存时可用高度变小，压缩内边距，保证播放控制条始终可达
    const isCompact = winSize.width < COMPACT_WIDTH || winSize.height < COMPACT_HEIGHT
    return {
      ...styles.container,
      paddingHorizontal: isCompact ? 8 : 15,
      paddingBottom: isCompact ? 8 : 15,
      paddingTop: isCompact ? 2 : 5,
    }
  }, [winSize.width, winSize.height])

  return (
    <View style={containerStyle} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_player}>
      <PlayInfo />
      <ControlBtn />
      <MoreBtn />
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 0,
    width: '100%',
    // paddingTop: progressContentPadding,
    // marginTop: -progressContentPadding,
    // backgroundColor: 'rgba(0, 0, 0, .1)',
    paddingHorizontal: 15,
    paddingBottom: 15,
    paddingTop: 5,
    // backgroundColor: AppColors.primary,
    // backgroundColor: 'red',
    flexDirection: 'column',
  },
  status: {
    marginTop: 10,
    flexDirection: 'column',
    flex: 0,
    paddingLeft: 5,
    justifyContent: 'space-evenly',
    // backgroundColor: 'rgba(0, 0, 0, .1)',
  },
})
