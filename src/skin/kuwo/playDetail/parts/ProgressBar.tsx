import { useMemo, memo, useCallback, useEffect, useRef, useState } from 'react'
import { PanResponder, View } from 'react-native'
import { useDrag } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useKuwoTheme } from '../../theme'
import type { KuwoOnColor, SkinPalette } from '../../palette'

export interface KuwoProgressBarProps {
  /** 播放进度 0 ~ 1 */
  progress: number
  /** 歌曲总时长（秒），拖动结束后按它换算目标播放位置 */
  duration: number
  nowPlayTimeStr: string
  maxPlayTimeStr: string
  /** 轨道高度，横屏播放页与竖屏小窗尺寸不同 */
  trackHeight?: number
  showTime?: boolean
}

/**
 * 酷我风格进度条
 *
 * 视觉：白色半透明轨道 + 品牌黄进度。交互：复用既有 useDrag + PanResponder，
 * 拖动中只更新本地进度，松手才通过 global.app_event.setProgress 真正 seek，
 * 与洛雪原生 Progress 组件行为一致，不改动播放器内核。
 */
export default memo(({
  progress,
  duration,
  nowPlayTimeStr,
  maxPlayTimeStr,
  trackHeight = 4,
  showTime = true,
}: KuwoProgressBarProps) => {
  const { palette: skinPalette, on: skinOn } = useKuwoTheme()
  const styles = useMemo(() => createStyles(skinPalette, skinOn), [skinPalette, skinOn])
  const [draging, setDraging] = useState(false)
  const [dragProgress, setDragProgress] = useState(0)

  const durationRef = useRef(duration)
  useEffect(() => {
    durationRef.current = duration
  }, [duration])

  const onSetProgress = useCallback((progress: number) => {
    if (!durationRef.current) return
    global.app_event.setProgress(progress * durationRef.current)
  }, [])

  const {
    onLayout,
    onDragStart,
    onDragEnd,
    onDrag,
  } = useDrag(onSetProgress, setDraging, setDragProgress)

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderMove: (evt, gestureState) => {
        onDrag(gestureState.dx)
      },
      onPanResponderGrant: (evt, gestureState) => {
        onDragStart(gestureState.dx, evt.nativeEvent.locationX)
      },
      onPanResponderRelease: () => {
        onDragEnd()
      },
    }),
  ).current

  const percent = Math.min(Math.max(draging ? dragProgress : progress, 0), 1) * 100
  const percentStyle = { width: `${percent}%` } as const

  return (
    <View style={styles.container}>
      <View style={styles.trackRow}>
        <View style={{ ...styles.track, height: trackHeight, borderRadius: trackHeight / 2 }}>
          <View style={{ ...styles.bar, ...percentStyle, borderRadius: trackHeight / 2 }} />
        </View>
        <View onLayout={onLayout} style={styles.pressArea} {...panResponder.panHandlers} />
      </View>
      {
        showTime
          ? (
            <View style={styles.timeRow}>
              <Text size={10} color={skinOn.textSecondary}>{nowPlayTimeStr || '00:00'}</Text>
              <Text size={10} color={skinOn.textSecondary}>{maxPlayTimeStr || '00:00'}</Text>
            </View>
            )
          : null
      }
    </View>
  )
})

const createStyles = (skinPalette: SkinPalette, skinOn: KuwoOnColor) => createStyle({
  container: {
    width: '100%',
  },
  trackRow: {
    width: '100%',
    justifyContent: 'center',
  },
  track: {
    width: '100%',
    backgroundColor: skinOn.track,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: skinPalette.brand,
  },
  pressArea: {
    position: 'absolute',
    left: 0,
    top: -8,
    width: '100%',
    height: 24,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
})
