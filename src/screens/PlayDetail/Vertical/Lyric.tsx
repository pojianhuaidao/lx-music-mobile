import { memo, useMemo, useEffect, useRef, useCallback } from 'react'
import { View, FlatList, TouchableOpacity, type FlatListProps, type LayoutChangeEvent, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'
// import { useLayout } from '@/utils/hooks'
import { type Line, useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { createStyle } from '@/utils/tools'
// import { useComponentIds } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { AnimatedColorText } from '@/components/common/Text'
import { setSpText } from '@/utils/pixelRatio'
import { useWindowSize } from '@/utils/hooks'
import { COMPACT_WIDTH } from '@/utils/windowBreakpoints'
import playerState from '@/store/player/state'
import { play } from '@/core/player/player'
import { resync } from '@/core/lyric'
import { scrollTo } from '@/utils/scroll'
import PlayLine, { type PlayLineType } from '../components/PlayLine'
// import { screenkeepAwake } from '@/utils/nativeModules/utils'
// import { log } from '@/utils/log'
// import { toast } from '@/utils/tools'

type FlatListType = FlatListProps<Line>

/**
 * 歌词配色覆盖
 *
 * 皮肤可以提供自己的歌词配色（如酷我车机版的品牌黄/深蓝）。
 * 未提供时一律走原版 theme 取色，保证 default 皮肤渲染结果与改造前逐像素等价。
 */
export interface LyricColorOverride {
  /** 当前播放行主色 */
  active: string
  /** 当前播放行译文色 */
  activeSub?: string
  /** 非当前行主色 */
  inactive: string
  /** 非当前行译文色 */
  inactiveSub?: string
}

// const useLock = () => {
//   const showCommentRef = useRef(false)


//   useEffect(() => {
//     let appstateListener = AppState.addEventListener('change', (state) => {
//       switch (state) {
//         case 'active':
//           if (showLyricRef.current && !showCommentRef.current) screenkeepAwake()
//           break
//         case 'background':
//           screenUnkeepAwake()
//           break
//       }
//     })
//     return () => {
//       appstateListener.remove()
//     }
//   }, [])
//   useEffect(() => {
//     let listener: ReturnType<typeof onNavigationComponentDidDisappearEvent>
//     showCommentRef.current = !!componentIds.comment
//     if (showCommentRef.current) {
//       if (showLyricRef.current) screenUnkeepAwake()
//       listener = onNavigationComponentDidDisappearEvent(componentIds.comment as string, () => {
//         if (showLyricRef.current && AppState.currentState == 'active') screenkeepAwake()
//       })
//     }

//     const rm = global.state_event.on('componentIdsUpdated', (ids) => {

//     })

//     return () => {
//       if (listener) listener.remove()
//     }
//   }, [])
// }

interface LineProps {
  line: Line
  lineNum: number
  activeLine: number
  onLayout: (lineNum: number, height: number, width: number) => void
  onPress: (lineNum: number) => void
  lineColors?: LyricColorOverride
}
const LrcLine = memo(({ line, lineNum, activeLine, onLayout, onPress, lineColors }: LineProps) => {
  const theme = useTheme()
  const lrcFontSize = useSettingValue('playDetail.vertical.style.lrcFontSize')
  const textAlign = useSettingValue('playDetail.style.align')
  const size = lrcFontSize / 10
  const lineHeight = setSpText(size) * 1.3

  const colors = useMemo(() => {
    const active = activeLine == lineNum
    // 皮肤需要自己的歌词配色时可以覆盖；未传时保持原版取色，渲染结果与改造前完全一致
    if (lineColors) {
      return active ? [
        lineColors.active,
        lineColors.activeSub ?? lineColors.active,
        1,
      ] as const : [
        lineColors.inactive,
        lineColors.inactiveSub ?? lineColors.inactive,
        0.6,
      ] as const
    }
    return active ? [
      theme['c-primary'],
      theme['c-primary-alpha-200'],
      1,
    ] as const : [
      theme['c-350'],
      theme['c-300'],
      0.6,
    ] as const
  }, [activeLine, lineNum, theme, lineColors])

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    onLayout(lineNum, nativeEvent.layout.height, nativeEvent.layout.width)
  }
  const handlePress = () => {
    onPress(lineNum)
  }


  // textBreakStrategy="simple" 用于解决某些设备上字体被截断的问题
  // https://stackoverflow.com/a/72822360
  return (
    <TouchableOpacity style={styles.line} activeOpacity={0.5} onLayout={handleLayout} onPress={handlePress}>
      <AnimatedColorText style={{
        ...styles.lineText,
        textAlign,
        lineHeight,
      }} textBreakStrategy="simple" color={colors[0]} opacity={colors[2]} size={size}>{line.text}</AnimatedColorText>
      {
        line.extendedLyrics.map((lrc, index) => {
          return (<AnimatedColorText style={{
            ...styles.lineTranslationText,
            textAlign,
            lineHeight: lineHeight * 0.8,
          }} textBreakStrategy="simple" key={index} color={colors[1]} opacity={colors[2]} size={size * 0.8}>{lrc}</AnimatedColorText>)
        })
      }
    </TouchableOpacity>
  )
}, (prevProps, nextProps) => {
  if (prevProps.lineColors !== nextProps.lineColors) return false
  return prevProps.line === nextProps.line &&
    prevProps.activeLine != nextProps.lineNum &&
    nextProps.activeLine != nextProps.lineNum
})
const wait = async() => new Promise(resolve => setTimeout(resolve, 100))
const LYRIC_RESTORE_DELAY = 5000
// 手动浏览歌词的兜底看门狗：拖拽/惯性结束事件丢失（快速手势、嵌套滚动冲突等）时，
// 强制退出手动浏览态恢复自动滚动，避免 isPauseScrollRef 永久停在 true 导致歌词不再滚动
const LYRIC_SCROLL_PAUSE_WATCHDOG = 8000
// 首屏渲染行数固定为常量。原实现绑定当前播放行号（Math.max(line + 10, 10)），
// 播放行变化会不断改变渲染窗口，造成行高测量错位与额外重渲染
const LYRIC_INITIAL_NUM_TO_RENDER = 20
const LYRIC_ACTIVE_LINE_POSITION = 0.42
// 行切换后的滚动启动延迟。原实现为 600ms：当连续两行间隔短于 600ms（密集段落/快歌），
// 每行的定时器都会被下一行清掉重建，滚动被无限推迟，表现为「高亮在走、画面停在旧行」
const LYRIC_SCROLL_DELAY = 120

export default (props?: { lineColors?: LyricColorOverride }) => {
  const lineColors = props?.lineColors
  const lyricLines = useLrcSet()
  const { line } = useLrcPlay()
  const lyricLinesRef = useRef(lyricLines)
  lyricLinesRef.current = lyricLines
  const flatListRef = useRef<FlatList>(null)
  const playLineRef = useRef<PlayLineType>(null)
  const isPauseScrollRef = useRef(true)
  const scrollTimoutRef = useRef<NodeJS.Timeout | null>(null)
  const delayScrollTimeout = useRef<NodeJS.Timeout | null>(null)
  const pauseScrollWatchdogRef = useRef<NodeJS.Timeout | null>(null)
  const isDraggingRef = useRef(false)
  const lastWatchdogRefreshRef = useRef(0)
  const lineRef = useRef({ line: 0, prevLine: 0 })
  // 行号漂移自愈的节流时间戳
  const lastResyncAtRef = useRef(0)
  const isFirstSetLrc = useRef(true)
  const scrollInfoRef = useRef<NativeSyntheticEvent<NativeScrollEvent>['nativeEvent'] | null>(null)
  // FlatList 实测可视高度。窗口形态切换（全屏 ↔ 系统虚拟 PiP / 分屏）后 onScroll 不一定立刻触发，
  // 只读 scrollInfo.layoutMeasurement 会继续用旧高度算滚动目标，导致对不齐当前行
  const listHeightRef = useRef(0)
  const listLayoutInfoRef = useRef<{ spaceHeight: number, lineHeights: number[] }>({ spaceHeight: 0, lineHeights: [] })
  const scrollCancelRef = useRef<(() => void) | null>(null)
  const isShowLyricProgressSetting = useSettingValue('playDetail.isShowLyricProgressSetting')
  const lrcFontSize = useSettingValue('playDetail.vertical.style.lrcFontSize')
  // 尚未测量到真实行高时的估算行高，与 LrcLine 的字体行高 + 上下 padding 保持一致
  const defaultLineHeight = useMemo(() => setSpText(lrcFontSize / 10) * 1.3 + 20, [lrcFontSize])
  // useLock()
  // const [imgUrl, setImgUrl] = useState(null)
  // const theme = useGetter('common', 'theme')
  // const { onLayout, ...layout } = useLayout()

  // useEffect(() => {
  //   const url = playMusicInfo ? playMusicInfo.musicInfo.img : null
  //   if (imgUrl == url) return
  //   setImgUrl(url)
  // // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [playMusicInfo])

  // const imgWidth = useMemo(() => layout.width * 0.75, [layout.width])
  const handleScrollToActive = (index = lineRef.current.line) => {
    if (index < 0) return
    const flatList = flatListRef.current
    if (!flatList) return
    // console.log('handleScrollToActive', index)
    const { spaceHeight, lineHeights } = listLayoutInfoRef.current
    // 逐项判空：行高是懒测量写入 lineHeights 的，数组中间很容易出现空洞；
    // 原实现直接累加会让 offset 变成 NaN，而 scrollToOffset(NaN) 既不报错也不滚动，
    // 表现为歌词永久卡住。这里先校验整条累加链，只要有一项缺失就整体降级为 scrollToIndex。
    let canScrollByOffset = !!scrollInfoRef.current && lineRef.current.line - lineRef.current.prevLine == 1
    let offset = spaceHeight
    if (canScrollByOffset) {
      if (!Number.isFinite(offset)) {
        canScrollByOffset = false
      } else {
        for (let line = 0; line < index; line++) {
          const height = lineHeights[line]
          if (!Number.isFinite(height)) {
            canScrollByOffset = false
            break
          }
          offset += height
        }
      }
      if (canScrollByOffset) {
        const activeLineHeight = lineHeights[index]
        if (Number.isFinite(activeLineHeight)) offset += activeLineHeight / 2
        else canScrollByOffset = false
      }
    }

    if (canScrollByOffset && scrollInfoRef.current) {
      const scrollInfo = scrollInfoRef.current
      // 可视高度优先用 FlatList 自身 onLayout 的实测值，避免切到小窗后仍按全屏高度对齐
      const viewHeight = listHeightRef.current > 0 ? listHeightRef.current : scrollInfo.layoutMeasurement.height
      const target = offset - viewHeight * LYRIC_ACTIVE_LINE_POSITION
      if (Number.isFinite(target)) {
        if (scrollCancelRef.current) {
          scrollCancelRef.current()
          scrollCancelRef.current = null
        }
        try {
          scrollCancelRef.current = scrollTo(flatList, scrollInfo, target, 600, () => {
            scrollCancelRef.current = null
          })
        } catch (err) {
          console.warn('[Lyric] scrollTo failed, fallback to scrollToIndex', err)
          canScrollByOffset = false
        }
      } else {
        canScrollByOffset = false
      }
    }

    if (canScrollByOffset) return

    if (scrollCancelRef.current) {
      scrollCancelRef.current()
      scrollCancelRef.current = null
    }
    try {
      flatList.scrollToIndex({
        index,
        animated: true,
        viewPosition: LYRIC_ACTIVE_LINE_POSITION,
      })
    } catch (err) {
      console.warn('[Lyric] scrollToIndex failed', err)
    }
  }

  const clearPauseScrollWatchdog = () => {
    if (!pauseScrollWatchdogRef.current) return
    clearTimeout(pauseScrollWatchdogRef.current)
    pauseScrollWatchdogRef.current = null
  }
  const restoreAutoScroll = () => {
    if (!isPauseScrollRef.current) return
    if (scrollTimoutRef.current) {
      clearTimeout(scrollTimoutRef.current)
      scrollTimoutRef.current = null
    }
    playLineRef.current?.setVisible(false)
    isPauseScrollRef.current = false
    handleScrollToActive()
  }
  const startPauseScrollWatchdog = () => {
    lastWatchdogRefreshRef.current = Date.now()
    clearPauseScrollWatchdog()
    pauseScrollWatchdogRef.current = setTimeout(() => {
      pauseScrollWatchdogRef.current = null
      // 兜底：结束事件丢失时强制恢复自动滚动，否则会永久卡在手动浏览态
      restoreAutoScroll()
    }, LYRIC_SCROLL_PAUSE_WATCHDOG)
  }
  const startRestoreAutoScrollTimeout = () => {
    if (scrollTimoutRef.current) clearTimeout(scrollTimoutRef.current)
    scrollTimoutRef.current = setTimeout(() => {
      scrollTimoutRef.current = null
      restoreAutoScroll()
    }, LYRIC_RESTORE_DELAY)
    // 恢复定时器本身也可能因后台挂起等原因不执行，再加一层看门狗
    startPauseScrollWatchdog()
  }

  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollInfoRef.current = nativeEvent
    if (isPauseScrollRef.current) {
      playLineRef.current?.updateScrollInfo(nativeEvent)
      // 手指仍在拖动时周期性刷新看门狗（限流 2s 一次），避免长时间拖拽被误判成事件丢失
      if (isDraggingRef.current && Date.now() - lastWatchdogRefreshRef.current > 2000) {
        startPauseScrollWatchdog()
      }
    }
  }
  const handleScrollBeginDrag = () => {
    isDraggingRef.current = true
    isPauseScrollRef.current = true
    playLineRef.current?.setVisible(true)
    if (delayScrollTimeout.current) {
      clearTimeout(delayScrollTimeout.current)
      delayScrollTimeout.current = null
    }
    if (scrollTimoutRef.current) {
      clearTimeout(scrollTimoutRef.current)
      scrollTimoutRef.current = null
    }
    if (scrollCancelRef.current) {
      scrollCancelRef.current()
      scrollCancelRef.current = null
    }
    // 一进入手动浏览就启动看门狗，保证即使后续结束事件全部丢失也能自动恢复滚动
    startPauseScrollWatchdog()
  }

  const onScrollEndDrag = () => {
    isDraggingRef.current = false
    if (!isPauseScrollRef.current) return
    startRestoreAutoScrollTimeout()
  }

  const handleMomentumScrollEnd = () => {
    // 惯性滚动结束才是手动浏览真正结束的信号。
    // 原实现只监听 onScrollEndDrag，惯性滑动会继续消耗 5s 计时，
    // 甚至因后续没有再次触发而让恢复定时器在滑动过程中就被用掉，这里补一次重启。
    isDraggingRef.current = false
    if (!isPauseScrollRef.current) return
    startRestoreAutoScrollTimeout()
  }

  useEffect(() => {
    return () => {
      if (delayScrollTimeout.current) {
        clearTimeout(delayScrollTimeout.current)
        delayScrollTimeout.current = null
      }
      if (scrollTimoutRef.current) {
        clearTimeout(scrollTimoutRef.current)
        scrollTimoutRef.current = null
      }
      if (pauseScrollWatchdogRef.current) {
        clearTimeout(pauseScrollWatchdogRef.current)
        pauseScrollWatchdogRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    // linesRef.current = lyricLines
    listLayoutInfoRef.current.lineHeights = []
    // 换歌词（切歌、歌词晚到、切换翻译/罗马音）时不能把内部行号无条件归零：
    // 归零后若播放行号没有变化（播放 hook 只在行号变化时才推送），下面的 [line]
    // effect 不会再次触发，列表就永久停在首行 —— 这正是「自动切歌后歌词不跟随」的观感来源。
    // 因此这里保留当前播放行（行号未知时才回到 0），并按新歌词行数裁剪，避免越界。
    const currentLine = line >= 0 ? Math.min(line, lyricLines.length - 1) : 0
    lineRef.current.prevLine = currentLine
    lineRef.current.line = currentLine
    // 换歌词后旧的滚动定时器与看门狗必须失效，否则会对新列表按旧位置滚动
    clearPauseScrollWatchdog()
    if (scrollTimoutRef.current) {
      clearTimeout(scrollTimoutRef.current)
      scrollTimoutRef.current = null
    }
    if (delayScrollTimeout.current) {
      clearTimeout(delayScrollTimeout.current)
      delayScrollTimeout.current = null
    }
    if (!flatListRef.current) return
    if (!lyricLines.length) {
      flatListRef.current.scrollToOffset({
        offset: 0,
        animated: false,
      })
      isPauseScrollRef.current = false
      return
    }
    playLineRef.current?.updateLyricLines(lyricLines)
    requestAnimationFrame(() => {
      isFirstSetLrc.current = false
      isPauseScrollRef.current = false
      if (delayScrollTimeout.current) clearTimeout(delayScrollTimeout.current)
      delayScrollTimeout.current = setTimeout(() => {
        delayScrollTimeout.current = null
        handleScrollToActive(currentLine)
      }, 100)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lyricLines])

  // 行号漂移自愈：播放器进度与歌词时钟可能因切歌、seek、变速、歌词晚到而失步，
  // 表现为高亮停在旧行、滚动不再跟随。低频（1.2s）按播放进度反查应有行号，
  // 偏差超过 2 行时请求核心层重建歌词时钟，并立即按目标行重新定位。
  useEffect(() => {
    const timer = setInterval(() => {
      if (!playerState.isPlay) return
      if (isPauseScrollRef.current) return
      const lines = lyricLinesRef.current
      if (lines.length < 2) return
      const time = playerState.progress.nowPlayTime * 1000
      if (!Number.isFinite(time)) return
      let low = 0
      let high = lines.length - 1
      let expect = -1
      while (low <= high) {
        const mid = (low + high) >> 1
        const lineTime = lines[mid]?.time
        if (!Number.isFinite(lineTime)) break
        if (lineTime <= time) {
          expect = mid
          low = mid + 1
        } else {
          high = mid - 1
        }
      }
      if (expect < 0) return
      const current = lineRef.current.line
      if (Math.abs(expect - current) < 2) return
      const now = Date.now()
      if (now - lastResyncAtRef.current < 3000) return
      lastResyncAtRef.current = now
      console.warn('[Lyric] line drift detected, realign:', current, '->', expect)
      resync()
      lineRef.current.prevLine = current
      lineRef.current.line = expect
      handleScrollToActive(expect)
    }, 1200)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // line 为负表示当前无歌词/尚未开始，此时也要同步 prevLine，
    // 否则下次进入歌词时会被误判成「跳行」，丢失逐行平滑滚动
    if (line < 0) {
      lineRef.current.prevLine = lineRef.current.line
      return
    }
    lineRef.current.prevLine = lineRef.current.line
    lineRef.current.line = line
    if (!flatListRef.current || isPauseScrollRef.current) return

    // 先清掉上一行残留的延迟滚动，避免快速切行时多个 delayScrollTimeout 叠加触发重复滚动
    if (delayScrollTimeout.current) {
      clearTimeout(delayScrollTimeout.current)
      delayScrollTimeout.current = null
    }

    if (line - lineRef.current.prevLine != 1) {
      handleScrollToActive()
      return
    }

    delayScrollTimeout.current = setTimeout(() => {
      delayScrollTimeout.current = null
      handleScrollToActive()
    }, LYRIC_SCROLL_DELAY)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line])

  useEffect(() => {
    requestAnimationFrame(() => {
      playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
      playLineRef.current?.updateLyricLines(lyricLines)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShowLyricProgressSetting])

  const handleScrollToIndexFailed: FlatListType['onScrollToIndexFailed'] = (info) => {
    void wait().then(() => {
      handleScrollToActive(info.index)
    })
  }

  const handleLineLayout = useCallback<LineProps['onLayout']>((lineNum, height) => {
    listLayoutInfoRef.current.lineHeights[lineNum] = height
    playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
  }, [])

  const handleSpaceLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    listLayoutInfoRef.current.spaceHeight = nativeEvent.layout.height
    playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
  }, [])

  const handleListLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    listHeightRef.current = nativeEvent.layout.height
  }, [])

  const handlePlayLine = useCallback((time: number) => {
    if (!playerState.musicInfo.id) return
    if (scrollTimoutRef.current) {
      clearTimeout(scrollTimoutRef.current)
      scrollTimoutRef.current = null
    }
    clearPauseScrollWatchdog()
    playLineRef.current?.setVisible(false)
    isPauseScrollRef.current = false
    global.app_event.setProgress(time)
    if (!playerState.isPlay) play()
  }, [])

  const handleLinePress = useCallback((lineNum: number) => {
    const targetLine = lyricLinesRef.current[lineNum]
    if (!targetLine || !playerState.musicInfo.id) return
    if (scrollTimoutRef.current) {
      clearTimeout(scrollTimoutRef.current)
      scrollTimoutRef.current = null
    }
    clearPauseScrollWatchdog()
    playLineRef.current?.setVisible(false)
    isPauseScrollRef.current = false
    global.app_event.setProgress(targetLine.time / 1000)
    if (!playerState.isPlay) play()
  }, [])

  const getItemLayout: FlatListType['getItemLayout'] = useCallback((_data: ArrayLike<Line> | null | undefined, index: number) => {
    // 优先使用已测量到的真实行高，未测量到的行用估算行高兜底。
    // 这样 scrollToIndex 在行高数组存在空洞时也能算出确定的偏移，
    // 不必依赖 onScrollToIndexFailed 反复重试（原缺陷的观感就是「重试也滚不动」）。
    const { spaceHeight, lineHeights } = listLayoutInfoRef.current
    let offset = Number.isFinite(spaceHeight) ? spaceHeight : 0
    for (let line = 0; line < index; line++) {
      const height = lineHeights[line]
      offset += Number.isFinite(height) ? height : defaultLineHeight
    }
    const height = lineHeights[index]
    return {
      length: Number.isFinite(height) ? height : defaultLineHeight,
      offset,
      index,
    }
  }, [defaultLineHeight])

  const winSize = useWindowSize()
  // 窗口尺寸变化（全屏 ↔ 系统虚拟 PiP、分屏、旋屏）后列表行高与可视高度都会变，
  // 需要按新高度重新对齐当前播放行，否则滚动基准还是旧尺寸，看起来像「歌词不再跟随」
  useEffect(() => {
    if (!flatListRef.current) return
    // 用户正在手动浏览歌词时不要抢滚动
    if (isPauseScrollRef.current) return
    const timer = setTimeout(() => {
      handleScrollToActive()
    }, 120)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winSize.width, winSize.height])
  // 小窗/双小窗并存时窗口变窄，固定 20dp 左右内边距会明显压缩歌词可用宽度
  const listStyle = useMemo(() => ({
    ...styles.container,
    paddingLeft: winSize.width < COMPACT_WIDTH ? 8 : winSize.width < 640 ? 14 : 20,
    paddingRight: winSize.width < COMPACT_WIDTH ? 8 : winSize.width < 640 ? 14 : 20,
  }), [winSize.width])

  const renderItem: FlatListType['renderItem'] = ({ item, index }) => {
    return (
      <LrcLine line={item} lineNum={index} activeLine={line} onLayout={handleLineLayout} onPress={handleLinePress} lineColors={lineColors} />
    )
  }
  const getkey: FlatListType['keyExtractor'] = (item, index) => `${index}${item.text}`

  const spaceComponent = useMemo(() => (
    <View style={styles.space} onLayout={handleSpaceLayout}></View>
  ), [handleSpaceLayout])

  return (
    <>
      <FlatList
        data={lyricLines}
        renderItem={renderItem}
        keyExtractor={getkey}
        style={listStyle}
        ref={flatListRef}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={spaceComponent}
        ListFooterComponent={spaceComponent}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        fadingEdgeLength={100}
        initialNumToRender={LYRIC_INITIAL_NUM_TO_RENDER}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        onScroll={handleScroll}
        onLayout={handleListLayout}
      />
      { isShowLyricProgressSetting ? <PlayLine ref={playLineRef} onPlayLine={handlePlayLine} /> : null }
    </>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
    paddingLeft: 20,
    paddingRight: 20,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  space: {
    paddingTop: '100%',
  },
  line: {
    paddingTop: 10,
    paddingBottom: 10,
    // opacity: 0,
  },
  lineText: {
    textAlign: 'center',
    // fontSize: 16,
    // lineHeight: 20,
    // paddingTop: 5,
    // paddingBottom: 5,
    // opacity: 0,
  },
  lineTranslationText: {
    textAlign: 'center',
    // fontSize: 13,
    // lineHeight: 17,
    paddingTop: 5,
    // paddingBottom: 5,
  },
})
