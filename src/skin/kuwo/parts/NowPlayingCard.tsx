import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { PixelRatio, TouchableOpacity, View, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import useWindowSize from '@/utils/hooks/useWindowSize'
import { scaleSizeH, scaleSizeW, setSpText } from '@/utils/pixelRatio'
import { useIsPlay, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useKuwoTheme } from '../theme'
import type { KuwoOnColor, SkinPalette } from '../palette'
import { checkCardFit, getCardMetrics, LEFT_COL_RATIO, type CardMetrics } from './nowPlayingLayout'

interface NowPlayingCardProps {
  onOpenPlayDetail: () => void
  onOpenLove: () => void
  /** 左栏视口可用高度（dp，由 HomeHorizontal 的 ScrollView onLayout 测得）；0 表示未测量到 */
  availableHeight?: number
}

/**
 * 酷我车机版左栏「正在播放」卡（第八版：封面受视口高度约束）
 *
 * 版式：封面（可选）/ 歌名 + 收藏 / 歌手 / 进度条 / 时长 / 上一首 暂停 下一首。
 *
 * 布局策略：
 * - 卡片**不设固定高度**，高度由内容自然撑开；父容器（HomeHorizontal 左栏）是纵向 ScrollView，内容超高可滚动；
 * - 控制三键**无条件渲染**，固定 CTRL_H(30dp) 等高、三等宽；
 * - 封面用**显式数字边长**（不用 aspectRatio / width:100%），边长受「视口高 − 信息区固定高」约束：
 *   2270x896@224dpi 档左栏只有 266dp 宽 × 325dp 高，封面若按内容宽取正方形(266dp)会把
 *   进度/时长/三键挤出视口并被压成 0 高而整体消失，故封面必须让位；
 * - 所有子项 flexShrink:0，任何档位都只「溢出后滚动」，绝不被 Yoga 压缩变形 / 压成负高。
 */
export default memo(({ onOpenPlayDetail, onOpenLove, availableHeight = 0 }: NowPlayingCardProps) => {
  const { palette: skinPalette, on: skinOn } = useKuwoTheme()
  const winSize = useWindowSize()
  // 卡片自身布局宽度（dp）：width 由父容器决定、与内容高度无关，不构成测量闭环
  const [cardWidth, setCardWidth] = useState(0)

  const handleContainerLayout = useCallback((e: { nativeEvent: { layout: { width: number } } }) => {
    const width = Math.round(e.nativeEvent.layout.width / PixelRatio.get())
    setCardWidth(prev => prev === width ? prev : width)
  }, [])

  const metrics = useMemo(() => getCardMetrics({
    // 优先用实测卡宽；首帧未测到时按「窗口宽 × 左栏比例」估算
    columnWidth: cardWidth > 0
      ? cardWidth
      : Math.max(
        0,
        Math.round((winSize.width - scaleSizeW(16)) * LEFT_COL_RATIO) - Math.round(scaleSizeW(6)),
      ),
    availableHeight,
    padH: clamp(scaleSizeW(10), 6, 16),
    padV: clamp(scaleSizeH(10), 6, 16),
    loveGap: clamp(scaleSizeW(6), 4, 10),
    titleFontBase: clamp(setSpText(14), 11, 18),
    singerHeightBase: clamp(setSpText(11) * 1.35, 13, 20),
    trackHeightBase: clamp(scaleSizeH(3), 3, 5),
    timeHeightBase: clamp(setSpText(9) * 1.3, 11, 16),
    infoGap: clamp(scaleSizeH(8), 5, 12),
    progGap: clamp(scaleSizeH(8), 3, 10),
    timeGap: clamp(scaleSizeH(4), 2, 6),
    singerGap: clamp(scaleSizeH(2), 1, 4),
    ctrlGap: clamp(scaleSizeH(8), 4, 12),
  }), [winSize.width, cardWidth, availableHeight])

  // 运行时自检：一屏适配断言，仅在开发模式打印，不进入 release 包逻辑
  useEffect(() => {
    if (!__DEV__ || availableHeight <= 0) return
    const fit = checkCardFit(metrics, availableHeight)
    const table = {
      viewportH: fit.viewportH,
      padV: metrics.padV,
      infoGap: metrics.infoGap,
      titleH: metrics.titleH,
      singerH: metrics.singerH,
      trackH: metrics.trackH,
      timeH: metrics.timeH,
      btnH: metrics.btnH,
      infoH: fit.infoH,
      coverSize: fit.coverSize,
      totalH: fit.totalH,
      fits: fit.fits,
    }
    if (!fit.fits) {
      console.warn('[kuwo NowPlayingCard] 一屏自检未通过：总高超出视口高', table)
    } else {
      console.log('[kuwo NowPlayingCard] 一屏自检通过', table)
    }
  }, [metrics, availableHeight])

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

  // 封面尺寸：宽、高都取 metrics.coverSize 的固定数字（dp），
  // 内联传入以绕开 createStyle→trasformeStyle 的 scaleSizeW/scaleSizeH 二次缩放，
  // flexGrow/flexShrink 均置 0 + alignSelf:'center'，保证任何父级约束下都保持正方形、绝不纵向拉伸。
  const coverSizeStyle = useMemo<ImageStyle>(() => ({
    width: metrics.coverSize,
    height: metrics.coverSize,
  }), [metrics.coverSize])
  const coverBoxStyle = useMemo<ViewStyle>(() => ({
    ...coverSizeStyle,
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'center',
  }), [coverSizeStyle])

  const handleTogglePlay = useCallback(() => {
    void togglePlay()
  }, [])

  const handlePrev = useCallback(() => {
    void playPrev()
  }, [])

  const handleNext = useCallback(() => {
    void playNext()
  }, [])

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      {metrics.showCover
        ? (
            <TouchableOpacity activeOpacity={0.8} onPress={handleOpenDetail} style={[styles.coverWrap, coverBoxStyle]}>
              <Image
                url={musicInfo.pic}
                nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic}
                style={[styles.cover, coverSizeStyle]}
              />
            </TouchableOpacity>
          )
        : null}
      <View style={styles.titleRow}>
        <View style={styles.nameWrap}>
          <Text size={metrics.titleFont} color={skinOn.textPrimary} numberOfLines={1} style={styles.name}>
            {musicInfo.name || '暂无播放'}
          </Text>
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={onOpenLove} style={styles.loveBtn}>
          <Icon name="love" size={metrics.loveIcon} color={skinOn.textSecondary} />
        </TouchableOpacity>
      </View>
      <Text size={metrics.singerFont} color={skinOn.textSecondary} numberOfLines={1} style={styles.singerText}>
        {musicInfo.singer || '酷我车机版外观'}
      </Text>
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={{ ...styles.progressBar, ...progressStyle }} />
        </View>
        <View style={styles.timeRow}>
          <Text size={metrics.timeFont} color={skinOn.textSecondary} style={styles.timeText}>{progress.nowPlayTimeStr || '00:00'}</Text>
          <Text size={metrics.timeFont} color={skinOn.textSecondary} style={styles.timeText}>{progress.maxPlayTimeStr || '00:00'}</Text>
        </View>
      </View>
      <View style={styles.controls}>
        <TouchableOpacity activeOpacity={0.7} onPress={handlePrev} style={styles.ctrlBtn}>
          <Icon name="prevMusic" size={metrics.ctrlIcon} color={skinOn.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={handleTogglePlay} style={{ ...styles.ctrlBtn, ...styles.playBtn }}>
          <Icon name={isPlay ? 'pause' : 'play'} size={metrics.playIcon} color={skinPalette.nowPlayingBg} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={handleNext} style={styles.ctrlBtn}>
          <Icon name="nextMusic" size={metrics.ctrlIcon} color={skinOn.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  )
})

const clamp = (value: number, min: number, max: number) => {
  const rounded = Math.round(value)
  return Math.min(max, Math.max(min, Number.isFinite(rounded) ? rounded : min))
}

interface CardStyles {
  container: ViewStyle
  coverWrap: ViewStyle
  cover: ImageStyle
  titleRow: ViewStyle
  nameWrap: ViewStyle
  name: TextStyle
  loveBtn: ViewStyle
  singerText: TextStyle
  progressWrap: ViewStyle
  progressTrack: ViewStyle
  progressBar: ViewStyle
  timeRow: ViewStyle
  timeText: TextStyle
  controls: ViewStyle
  ctrlBtn: ViewStyle
  playBtn: ViewStyle
}

// 刻意不用 utils/tools 的 createStyle：它会把数字型 width/height/padding/margin 再经
// trasformeStyle 交给 scaleSizeW/scaleSizeH，按「设计基准 375x667 vs 当前窗口」的比值二次缩放。
// metrics 里的尺寸已是按实测视口算好的 dp，再缩放会让实际渲染尺寸偏离 infoH 预算
// （r1~r3 的实际内容总高超出卡片视口、信息区被挤出并出现负高度），故此处直接返回纯对象，dp 原值生效。
const createStyles = (skinPalette: SkinPalette, skinOn: KuwoOnColor, metrics: CardMetrics): CardStyles => ({
  // 不设 height / minHeight / flex，高度由内容撑开；flexShrink:0 保证永不被 Yoga 压缩
  container: {
    width: '100%',
    flexShrink: 0,
    backgroundColor: skinPalette.nowPlayingBg,
    borderRadius: skinPalette.radius,
    paddingHorizontal: metrics.padH,
    paddingVertical: metrics.padV,
    overflow: 'hidden',
  },
  // 封面：显式数字边长（宽=高），边长已按「视口高 − 信息区固定高」收缩，居中显示
  coverWrap: {
    width: metrics.coverSize,
    height: metrics.coverSize,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    alignSelf: 'center',
    borderRadius: skinPalette.radius * 0.6,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: metrics.infoGap,
  },
  // 图片节点同样用固定数字边长（不写 '100%'），避免图片跟随父级被纵向拉伸
  cover: {
    width: metrics.coverSize,
    height: metrics.coverSize,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: metrics.titleH,
    flexShrink: 0,
  },
  nameWrap: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    overflow: 'hidden',
  },
  name: {
    width: '100%',
    lineHeight: metrics.titleH,
    fontWeight: 'bold',
  },
  loveBtn: {
    flexShrink: 0,
    marginLeft: metrics.loveGap,
    height: metrics.titleH,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  singerText: {
    height: metrics.singerH,
    flexShrink: 0,
    marginTop: metrics.singerGap,
    lineHeight: metrics.singerH,
  },
  progressWrap: {
    marginTop: metrics.progGap,
    flexShrink: 0,
  },
  progressTrack: {
    height: metrics.trackH,
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
    alignItems: 'center',
    height: metrics.timeH,
    flexShrink: 0,
    marginTop: metrics.timeGap,
  },
  timeText: {
    lineHeight: metrics.timeH,
  },
  // 三键：高度受 btnH 上限约束（≤28dp）、三等宽，无条件渲染
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    height: metrics.btnH,
    flexShrink: 0,
    marginTop: metrics.ctrlGap,
    overflow: 'hidden',
  },
  ctrlBtn: {
    flex: 1,
    height: metrics.btnH,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playBtn: {
    backgroundColor: skinPalette.brand,
    borderRadius: 6,
  },
})
