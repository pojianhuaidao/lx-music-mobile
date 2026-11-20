import { memo, useCallback, useMemo } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { useWindowSize } from '@/utils/hooks'
import { useIsPlay, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useQqTheme } from '../theme'
import type { QqOnColor, QqPalette } from '../palette'

interface MiniPlayerBarProps {
  onOpenPlayDetail: () => void
}

/**
 * 计算播放条高度与内部元素缩放比
 *
 * 基准高度取设计稿 58，同时受窗口高度约束（不超过 16%），
 * 避免横屏窄高窗口下播放条大面积遮挡列表。
 */
const getBarMetrics = (winHeight: number) => {
  const baseH = scaleSizeH(58)
  const limitH = winHeight > 0 ? Math.round(winHeight * 0.16) : baseH
  const barH = Math.max(Math.round(baseH * 0.5), Math.min(baseH, limitH))
  return { barH, ratio: Math.min(1, barH / baseH) }
}

/**
 * QQ音乐车机版迷你播放条
 *
 * 版式：封面 + 歌名/歌手 + 上一首/播放/下一首，底部一条 2dp 进度。
 * 控制能力直接复用 core/player，不改动播放器内核。
 */
export default memo(({ onOpenPlayDetail }: MiniPlayerBarProps) => {
  const { palette: skinPalette, on: skinOn } = useQqTheme()
  const windowSize = useWindowSize()
  const metrics = useMemo(() => getBarMetrics(windowSize.height), [windowSize.height])
  const styles = useMemo(() => createStyles(skinPalette, skinOn, metrics), [skinPalette, skinOn, metrics])
  const fontSize = useMemo(() => ({
    name: Math.max(10, Math.round(13 * metrics.ratio)),
    singer: Math.max(9, Math.round(11 * metrics.ratio)),
    icon: Math.max(13, Math.round(16 * metrics.ratio)),
    playIcon: Math.max(14, Math.round(18 * metrics.ratio)),
  }), [metrics])
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const progress = useProgress()

  const barProgressStyle = useMemo(() => ({
    width: `${Math.min(Math.max(progress.progress, 0), 1) * 100}%`,
  } as const), [progress.progress])

  const handleOpenDetail = useCallback(() => {
    if (!musicInfo.id) return
    onOpenPlayDetail()
  }, [musicInfo.id, onOpenPlayDetail])

  const handlePrev = useCallback(() => { void playPrev() }, [])
  const handleNext = useCallback(() => { void playNext() }, [])
  const handleTogglePlay = useCallback(() => { void togglePlay() }, [])

  return (
    <View style={styles.container}>
      <TouchableOpacity activeOpacity={0.85} onPress={handleOpenDetail} style={styles.main}>
        <Image
          url={musicInfo.pic}
          nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic}
          style={styles.cover}
        />
        <View style={styles.info}>
          <Text size={fontSize.name} color={skinOn.textPrimary} numberOfLines={1} style={styles.name}>
            {musicInfo.name || '暂无播放'}
          </Text>
          <Text size={fontSize.singer} color={skinOn.textSecondary} numberOfLines={1} style={styles.singer}>
            {musicInfo.singer || 'QQ音乐车机版'}
          </Text>
        </View>
      </TouchableOpacity>
      <View style={styles.controls}>
        <TouchableOpacity activeOpacity={0.7} onPress={handlePrev} style={styles.sideBtn}>
          <Icon name="prevMusic" size={fontSize.icon} color={skinOn.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} onPress={handleTogglePlay} style={styles.playBtn}>
          <Icon name={isPlay ? 'pause' : 'play'} size={fontSize.playIcon} color={skinPalette.brandAlt} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={handleNext} style={styles.sideBtn}>
          <Icon name="nextMusic" size={fontSize.icon} color={skinOn.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={handleOpenDetail} style={styles.listBtn}>
          <Icon name="menu" size={fontSize.icon} color={skinOn.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={styles.progressTrack}>
        <View style={{ ...styles.progressBar, width: barProgressStyle.width }} />
      </View>
    </View>
  )
})

const createStyles = (skinPalette: QqPalette, skinOn: QqOnColor, metrics: { barH: number, ratio: number }) => {
  const { barH, ratio } = metrics
  const sz = (value: number) => Math.max(1, Math.round(value * ratio))
  const coverSize = Math.max(26, Math.min(sz(scaleSizeH(42)), barH - 16))
  const sideBtnSize = Math.max(26, sz(scaleSizeW(32)))
  const playBtnSize = Math.max(28, sz(scaleSizeW(34)))
  return createStyle({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      height: barH,
      paddingHorizontal: sz(scaleSizeW(14)),
      backgroundColor: skinPalette.nowPlayingBg,
      borderTopLeftRadius: sz(scaleSizeW(14)),
      borderTopRightRadius: sz(scaleSizeW(14)),
      overflow: 'hidden',
    },
    main: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    cover: {
      width: coverSize,
      height: coverSize,
      borderRadius: sz(scaleSizeW(9)),
      backgroundColor: skinOn.track,
    },
    info: {
      flex: 1,
      marginLeft: sz(scaleSizeW(10)),
      justifyContent: 'center',
    },
    name: {
      fontWeight: '600',
    },
    singer: {
      marginTop: sz(scaleSizeH(3)),
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sideBtn: {
      width: sideBtnSize,
      height: sideBtnSize,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playBtn: {
      width: playBtnSize,
      height: playBtnSize,
      borderRadius: Math.round(playBtnSize / 2),
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: sz(scaleSizeW(4)),
    },
    listBtn: {
      width: sideBtnSize,
      height: sideBtnSize,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressTrack: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 2,
      backgroundColor: skinOn.track,
    },
    progressBar: {
      height: 2,
      backgroundColor: skinPalette.highlight,
    },
  })
}
