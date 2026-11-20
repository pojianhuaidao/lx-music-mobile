import { memo, useEffect, useMemo, useRef } from 'react'
import { AppState, TouchableOpacity, View } from 'react-native'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import Lyric, { type LyricColorOverride } from '@/screens/PlayDetail/Vertical/Lyric'
import SettingPopup, { type SettingPopupType } from '@/screens/PlayDetail/components/SettingPopup'

import { pop } from '@/navigation'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS, HEADER_HEIGHT as RAW_HEADER_HEIGHT, NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { useWindowSize } from '@/utils/hooks'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'
import { COMPACT_HEIGHT, COMPACT_WIDTH } from '@/utils/windowBreakpoints'

import { useKugouTheme } from '../theme'
import type { KugouOnColor, KugouPalette } from '../palette'
import ProgressBar from './parts/ProgressBar'
import ControlRow from './parts/ControlRow'
import PlayListPopup, { type KugouPlayListPopupType } from './parts/PlayListPopup'

const HEADER_HEIGHT = scaleSizeH(RAW_HEADER_HEIGHT)
// 底部进度条 + 控制行占位高度，用于给封面预留空间，避免小窗下封面把歌词挤出可视区
const FOOTER_HEIGHT = scaleSizeH(92)

/**
 * 酷狗音乐车机版 · 竖屏播放页
 *
 * 版式：顶部返回 + 歌曲信息 + 播放列表/设置入口；中部封面；下方歌词；底部品牌黄进度条 + 控制行。
 * 覆盖 726x856 等竖屏小窗场景，宽度或高度进入紧凑区间时控制行整体缩小一档。
 * 歌词直接复用洛雪原生竖屏 Lyric（含自动切歌跟随、手动浏览恢复、窗口尺寸变化重定位），
 * 仅通过 lineColors 覆盖配色；播放器内核与播放状态完全复用，不做改动。
 */
export default memo(({ componentId }: { componentId: string }) => {
  const { palette: skinPalette, on: skinOn } = useKugouTheme()
  const styles = useMemo(() => createStyles(skinPalette, skinOn), [skinPalette, skinOn])
  const statusBarHeight = useStatusbarHeight()
  const winSize = useWindowSize()
  const musicInfo = usePlayerMusicInfo()
  const progress = useProgress()
  const settingPopupRef = useRef<SettingPopupType>(null)
  const playListPopupRef = useRef<KugouPlayListPopupType>(null)

  const isCompact = winSize.width < COMPACT_WIDTH || winSize.height < COMPACT_HEIGHT

  const lyricColors = useMemo<LyricColorOverride>(() => ({
    active: skinPalette.brand,
    activeSub: 'rgba(245, 211, 78, 0.72)',
    inactive: skinOn.textPrimary,
    inactiveSub: skinOn.textSecondary,
  }), [])

  useEffect(() => {
    setComponentId(COMPONENT_IDS.playDetail, componentId)
    screenkeepAwake()
    const appstateListener = AppState.addEventListener('change', (state) => {
      switch (state) {
        case 'active':
          if (!commonState.componentIds.comment) screenkeepAwake()
          break
        case 'background':
          screenUnkeepAwake()
          break
      }
    })

    const handleComponentIdsChange = (ids: CommonState['componentIds']) => {
      if (ids.comment) screenUnkeepAwake()
      else if (AppState.currentState == 'active') screenkeepAwake()
    }

    global.state_event.on('componentIdsUpdated', handleComponentIdsChange)

    return () => {
      global.state_event.off('componentIdsUpdated', handleComponentIdsChange)
      appstateListener.remove()
      screenUnkeepAwake()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const back = () => {
    const id = commonState.componentIds.playDetail
    if (id) void pop(id)
  }

  // 封面尺寸随窗口实时重算：726x856 小窗与宽屏竖窗下都不会把歌词区挤到不可读
  const coverSize = useMemo(() => {
    const availHeight = Math.max(winSize.height - statusBarHeight - HEADER_HEIGHT - FOOTER_HEIGHT, 160)
    const availWidth = winSize.width * 0.52
    return Math.max(Math.floor(Math.min(availWidth, availHeight * 0.42)), 96)
  }, [winSize.width, winSize.height, statusBarHeight])

  return (
    <PageContent>
      <StatusBar />
      <View style={{ ...styles.container, paddingTop: statusBarHeight }}>
        <View style={styles.header} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_header}>
          <TouchableOpacity activeOpacity={0.7} onPress={back} style={styles.headerBtn}>
            <Icon name="chevron-left" size={20} color={skinOn.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text size={16} numberOfLines={1} color={skinOn.textPrimary} style={styles.headerName}>
              {musicInfo.name || '暂无播放'}
            </Text>
            <Text size={11} numberOfLines={1} color={skinOn.textSecondary}>
              {musicInfo.singer || '酷狗音乐车机版'}
            </Text>
          </View>
          <TouchableOpacity activeOpacity={0.7} onPress={() => { playListPopupRef.current?.show() }} style={styles.headerBtn}>
            <Icon name="menu" size={18} color={skinOn.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={() => { settingPopupRef.current?.show() }} style={styles.headerBtn}>
            <Icon name="slider" size={18} color={skinOn.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={styles.coverWrap}>
          <View style={{ ...styles.coverCard, width: coverSize, height: coverSize }}>
            <Image
              url={musicInfo.pic}
              nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic}
              style={styles.cover}
            />
          </View>
        </View>
        <View style={styles.lyricWrap}>
          <Lyric lineColors={lyricColors} />
        </View>
        <View style={styles.footer} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_player}>
          <ProgressBar
            progress={progress.progress}
            duration={progress.maxPlayTime}
            nowPlayTimeStr={progress.nowPlayTimeStr}
            maxPlayTimeStr={progress.maxPlayTimeStr}
            trackHeight={isCompact ? 3 : 4}
          />
          <View style={styles.controlWrap}>
            <ControlRow compact={isCompact} onOpenPlayList={() => { playListPopupRef.current?.show() }} />
          </View>
        </View>
      </View>
      <SettingPopup ref={settingPopupRef} position="bottom" direction="vertical" />
      <PlayListPopup ref={playListPopupRef} position="bottom" />
    </PageContent>
  )
})

const createStyles = (skinPalette: KugouPalette, skinOn: KugouOnColor) => createStyle({
  container: {
    flex: 1,
    backgroundColor: skinPalette.playBg,
    paddingHorizontal: scaleSizeW(20),
    paddingBottom: scaleSizeH(8),
  },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  headerName: {
    fontWeight: 'bold',
  },
  coverWrap: {
    paddingTop: scaleSizeH(4),
    paddingBottom: scaleSizeH(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverCard: {
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  lyricWrap: {
    flex: 1,
    alignSelf: 'stretch',
  },
  footer: {
    paddingTop: scaleSizeH(4),
    paddingHorizontal: scaleSizeW(4),
  },
  controlWrap: {
    marginTop: scaleSizeH(6),
    alignItems: 'center',
  },
})
