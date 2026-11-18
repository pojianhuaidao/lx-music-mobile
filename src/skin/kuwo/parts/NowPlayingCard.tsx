import { memo, useCallback, useMemo } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'
import { useIsPlay, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { kuwoPalette, kuwoOnDark } from '../palette'

interface NowPlayingCardProps {
  onOpenPlayDetail: () => void
  onOpenLove: () => void
}

/**
 * 酷我车机版左栏「正在播放」卡
 *
 * 版式对齐酷我：封面 / 歌名 / 歌手 / 收藏心形 / 进度条 / 上一首 暂停 下一首。
 * 播放控制直接复用 core/player 的既有能力，不改动播放器内核。
 */
export default memo(({ onOpenPlayDetail, onOpenLove }: NowPlayingCardProps) => {
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const progress = useProgress()

  const progressStyle = useMemo(() => ({
    width: `${Math.min(Math.max(progress.progress, 0), 1) * 100}%`,
  } as const), [progress.progress])

  const handleOpenDetail = useCallback(() => {
    if (!musicInfo.id) return
    onOpenPlayDetail()
  }, [musicInfo.id, onOpenPlayDetail])

  const handleTogglePlay = useCallback(() => {
    void togglePlay()
  }, [])

  return (
    <View style={styles.container}>
      <TouchableOpacity activeOpacity={0.8} onPress={handleOpenDetail} style={styles.coverWrap}>
        <Image
          url={musicInfo.pic}
          nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic}
          style={styles.cover}
        />
      </TouchableOpacity>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text size={14} color={kuwoOnDark.textPrimary} numberOfLines={1} style={styles.name}>
            {musicInfo.name || '暂无播放'}
          </Text>
          <TouchableOpacity activeOpacity={0.7} onPress={onOpenLove} style={styles.loveBtn}>
            <Icon name="love" size={14} color={kuwoOnDark.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text size={11} color={kuwoOnDark.textSecondary} numberOfLines={1}>
          {musicInfo.singer || '酷我车机版外观'}
        </Text>
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={{ ...styles.progressBar, ...progressStyle }} />
          </View>
          <View style={styles.timeRow}>
            <Text size={9} color={kuwoOnDark.textSecondary}>{progress.nowPlayTimeStr || '00:00'}</Text>
            <Text size={9} color={kuwoOnDark.textSecondary}>{progress.maxPlayTimeStr || '00:00'}</Text>
          </View>
        </View>
        <View style={styles.controls}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => { void playPrev() }} style={styles.ctrlBtn}>
            <Icon name="prevMusic" size={16} color={kuwoOnDark.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={handleTogglePlay} style={{ ...styles.ctrlBtn, ...styles.playBtn }}>
            <Icon name={isPlay ? 'pause' : 'play'} size={16} color={kuwoPalette.nowPlayingBg} />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={() => { void playNext() }} style={styles.ctrlBtn}>
            <Icon name="nextMusic" size={16} color={kuwoOnDark.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    backgroundColor: kuwoPalette.nowPlayingBg,
    borderRadius: kuwoPalette.radius,
    padding: scaleSizeW(10),
  },
  coverWrap: {
    flex: 1,
    minHeight: 60,
    width: '100%',
    borderRadius: kuwoPalette.radius * 0.6,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  info: {
    flexShrink: 1,
    marginTop: scaleSizeH(10),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    flexShrink: 1,
    fontWeight: 'bold',
  },
  loveBtn: {
    marginLeft: scaleSizeW(6),
    padding: 2,
  },
  progressWrap: {
    marginTop: scaleSizeH(10),
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: kuwoOnDark.track,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: kuwoPalette.brand,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: scaleSizeH(4),
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scaleSizeH(8),
  },
  ctrlBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: scaleSizeW(4),
  },
  playBtn: {
    backgroundColor: kuwoPalette.brand,
    width: 34,
    height: 34,
    borderRadius: 17,
  },
})
