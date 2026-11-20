import { memo, useCallback, useMemo } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { useIsPlay, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useNeteaseTheme } from '../theme'
import type { NeteaseOnColor, NeteasePalette } from '../palette'

interface MiniPlayerBarProps {
  onOpenPlayDetail: () => void
}

/**
 * 网易云音乐车机版迷你播放条
 *
 * 版式：封面 + 歌名/歌手 + 上一首/播放/下一首，底部一条 2dp 进度。
 * 控制能力直接复用 core/player，不改动播放器内核。
 */
export default memo(({ onOpenPlayDetail }: MiniPlayerBarProps) => {
  const { palette: skinPalette, on: skinOn } = useNeteaseTheme()
  const styles = useMemo(() => createStyles(skinPalette, skinOn), [skinPalette, skinOn])
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
          <Text size={13} color={skinOn.textPrimary} numberOfLines={1} style={styles.name}>
            {musicInfo.name || '暂无播放'}
          </Text>
          <Text size={11} color={skinOn.textSecondary} numberOfLines={1} style={styles.singer}>
            {musicInfo.singer || '网易云音乐车机版'}
          </Text>
        </View>
      </TouchableOpacity>
      <View style={styles.controls}>
        <TouchableOpacity activeOpacity={0.7} onPress={handlePrev} style={styles.sideBtn}>
          <Icon name="prevMusic" size={16} color={skinOn.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} onPress={handleTogglePlay} style={styles.playBtn}>
          <Icon name={isPlay ? 'pause' : 'play'} size={18} color={skinPalette.brandAlt} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={handleNext} style={styles.sideBtn}>
          <Icon name="nextMusic" size={16} color={skinOn.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={handleOpenDetail} style={styles.listBtn}>
          <Icon name="menu" size={16} color={skinOn.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={styles.progressTrack}>
        <View style={{ ...styles.progressBar, width: barProgressStyle.width }} />
      </View>
    </View>
  )
})

const createStyles = (skinPalette: NeteasePalette, skinOn: NeteaseOnColor) => createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: scaleSizeH(58),
    paddingHorizontal: scaleSizeW(14),
    backgroundColor: skinPalette.nowPlayingBg,
    borderTopLeftRadius: scaleSizeW(14),
    borderTopRightRadius: scaleSizeW(14),
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cover: {
    width: scaleSizeH(42),
    height: scaleSizeH(42),
    borderRadius: scaleSizeW(9),
    backgroundColor: skinOn.track,
  },
  info: {
    flex: 1,
    marginLeft: scaleSizeW(10),
    justifyContent: 'center',
  },
  name: {
    fontWeight: '600',
  },
  singer: {
    marginTop: scaleSizeH(3),
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideBtn: {
    width: scaleSizeW(32),
    height: scaleSizeW(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: scaleSizeW(34),
    height: scaleSizeW(34),
    borderRadius: scaleSizeW(17),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: scaleSizeW(4),
  },
  listBtn: {
    width: scaleSizeW(32),
    height: scaleSizeW(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: scaleSizeH(2),
    backgroundColor: skinOn.track,
  },
  progressBar: {
    height: scaleSizeH(2),
    backgroundColor: skinPalette.highlight,
  },
})
