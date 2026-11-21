import { memo, useCallback, useMemo, useState } from 'react'
import { TouchableOpacity, View, type LayoutChangeEvent } from 'react-native'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'
import { useIsPlay, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useKuwoTheme } from '../theme'
import type { KuwoOnColor, SkinPalette } from '../palette'

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
  const { palette: skinPalette, on: skinOn } = useKuwoTheme()
  const [cardWidth, setCardWidth] = useState(0)
  const metrics = useMemo(() => getCtrlMetrics(cardWidth), [cardWidth])
  const styles = useMemo(() => createStyles(skinPalette, skinOn, metrics), [skinPalette, skinOn, metrics])
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

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width)
    setCardWidth(prev => (Math.abs(prev - w) > 1 ? w : prev))
  }, [])

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <TouchableOpacity activeOpacity={0.8} onPress={handleOpenDetail} style={styles.coverWrap}>
        <Image
          url={musicInfo.pic}
          nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic}
          style={styles.cover}
        />
      </TouchableOpacity>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text size={14} color={skinOn.textPrimary} numberOfLines={1} style={styles.name}>
            {musicInfo.name || '暂无播放'}
          </Text>
          <TouchableOpacity activeOpacity={0.7} onPress={onOpenLove} style={styles.loveBtn}>
            <Icon name="love" size={14} color={skinOn.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text size={11} color={skinOn.textSecondary} numberOfLines={1}>
          {musicInfo.singer || '酷我车机版外观'}
        </Text>
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={{ ...styles.progressBar, ...progressStyle }} />
          </View>
          <View style={styles.timeRow}>
            <Text size={9} color={skinOn.textSecondary}>{progress.nowPlayTimeStr || '00:00'}</Text>
            <Text size={9} color={skinOn.textSecondary}>{progress.maxPlayTimeStr || '00:00'}</Text>
          </View>
        </View>
        <View style={styles.controls}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => { void playPrev() }} style={styles.ctrlBtn}>
            <Icon name="prevMusic" size={metrics.ctrlIcon} color={skinOn.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={handleTogglePlay} style={{ ...styles.ctrlBtn, ...styles.playBtn }}>
            <Icon name={isPlay ? 'pause' : 'play'} size={metrics.playIcon} color={skinPalette.nowPlayingBg} />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={() => { void playNext() }} style={styles.ctrlBtn}>
            <Icon name="nextMusic" size={metrics.ctrlIcon} color={skinOn.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
})

interface CtrlMetrics {
  /** 单个控制按钮边长：三个按钮等宽，保证任意卡片宽度下都完整落在卡片内 */
  btn: number
  /** 按钮之间的水平间距 */
  gap: number
  ctrlIcon: number
  playIcon: number
}

/** 大屏下的按钮上限，保持酷我原始视觉比例 */
const BASE_CTRL = 30
/** 极窄左栏下的按钮下限，低于此值图标无法辨认；仅在可用宽极端不足时生效 */
const MIN_CTRL = 10

/**
 * 按卡片实际可用宽度计算控制按钮尺寸。
 *
 * 低分辨率横屏（如 dp 640x360）时酷我左栏宽度仅 60~70dp，原先硬编码 30/34 + 22 最小宽
 * 会把「上一首/播放/下一首」挤出卡片被裁切，只剩半个图标。
 * 这里改成三按钮等分可用宽度、随卡片收缩，不再使用固定宽度与最小宽度地板，
 * 保证任何分辨率下三个按钮都完整显示。
 */
const getCtrlMetrics = (cardWidth: number): CtrlMetrics => {
  const hPadding = Math.round(scaleSizeW(10) * 2)
  const gap = Math.max(1, Math.round(scaleSizeW(4)))
  let btn = BASE_CTRL
  if (cardWidth > 0) {
    const available = Math.max(0, cardWidth - hPadding)
    // 三个按钮等宽；每个按钮左右各半个间距，共 3 个间距宽度需从可用宽度中扣除
    const fit = Math.floor((available - gap * 3) / 3)
    btn = Math.min(BASE_CTRL, Math.max(MIN_CTRL, fit))
  }
  return {
    btn,
    gap,
    ctrlIcon: Math.max(8, Math.round(btn * 0.55)),
    playIcon: Math.max(9, Math.round(btn * 0.62)),
  }
}

const createStyles = (skinPalette: SkinPalette, skinOn: KuwoOnColor, metrics: CtrlMetrics) => createStyle({
  container: {
    flex: 1,
    backgroundColor: skinPalette.nowPlayingBg,
    borderRadius: skinPalette.radius,
    padding: scaleSizeW(10),
  },
  coverWrap: {
    flex: 1,
    minHeight: 60,
    width: '100%',
    borderRadius: skinPalette.radius * 0.6,
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
    backgroundColor: skinOn.track,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: skinPalette.brand,
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
    width: metrics.btn,
    height: metrics.btn,
    borderRadius: metrics.btn / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
    marginHorizontal: metrics.gap / 2,
  },
  playBtn: {
    backgroundColor: skinPalette.brand,
    width: metrics.btn,
    height: metrics.btn,
    borderRadius: metrics.btn / 2,
  },
})
