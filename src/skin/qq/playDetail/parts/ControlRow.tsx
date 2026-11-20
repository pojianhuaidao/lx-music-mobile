import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { MUSIC_TOGGLE_MODE, MUSIC_TOGGLE_MODE_LIST, LIST_IDS } from '@/config/constant'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { toast } from '@/utils/tools'
import { usePlayerMusicInfo, useIsPlay } from '@/store/player/hook'
import { useMusicExistsList } from '@/store/list/hook'
import { collectMusic, playNext, playPrev, togglePlay, uncollectMusic } from '@/core/player/player'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useQqTheme } from '../../theme'
import type { QqOnColor, SkinPalette } from '../../palette'

export interface QqControlRowProps {
  /** 播放列表入口 */
  onOpenPlayList: () => void
  /** 紧凑模式（竖屏小窗），整体缩小一档 */
  compact?: boolean
}

type ModeName = 'play_list_loop' | 'play_list_random' | 'play_list_order' | 'play_single_loop' | 'play_single'

/**
 * QQ音乐风格播放控制行
 *
 * 播放模式、上一首/播放/下一首、收藏、播放列表入口。
 * 全部复用 core/player 既有能力，不改动播放器内核与播放状态。
 */
export default memo(({ onOpenPlayList, compact = false }: QqControlRowProps) => {
  const { palette: skinPalette, on: skinOn } = useQqTheme()
  const styles = useMemo(() => createStyles(skinPalette, skinOn), [skinPalette, skinOn])
  const isPlay = useIsPlay()
  const musicInfo = usePlayerMusicInfo()
  const togglePlayMethod = useSettingValue('player.togglePlayMethod')
  const t = useI18n()

  const loveList = useMemo(() => ({ id: LIST_IDS.LOVE, name: '我的收藏' }) as LX.List.MyListInfo, [])
  // useMusicExistsList 只按 id 判断是否已收藏，这里仅做类型收窄，不改变运行时行为
  const isLoved = useMusicExistsList(loveList, musicInfo as unknown as LX.Music.MusicInfo)
  const [loved, setLoved] = useState(isLoved)
  useEffect(() => {
    setLoved(isLoved)
  }, [isLoved, musicInfo.id])

  const toggleNextPlayMode = useCallback(() => {
    let index = MUSIC_TOGGLE_MODE_LIST.indexOf(togglePlayMethod as typeof MUSIC_TOGGLE_MODE_LIST[number])
    if (++index >= MUSIC_TOGGLE_MODE_LIST.length) index = 0
    const mode = MUSIC_TOGGLE_MODE_LIST[index]
    updateSetting({ 'player.togglePlayMethod': mode })
    let modeName: ModeName
    switch (mode) {
      case MUSIC_TOGGLE_MODE.listLoop:
        modeName = 'play_list_loop'
        break
      case MUSIC_TOGGLE_MODE.random:
        modeName = 'play_list_random'
        break
      case MUSIC_TOGGLE_MODE.list:
        modeName = 'play_list_order'
        break
      case MUSIC_TOGGLE_MODE.singleLoop:
        modeName = 'play_single_loop'
        break
      default:
        modeName = 'play_single'
        break
    }
    toast(t(modeName))
  }, [togglePlayMethod, t])

  const playModeIcon = useMemo(() => {
    switch (togglePlayMethod) {
      case MUSIC_TOGGLE_MODE.listLoop:
        return 'list-loop'
      case MUSIC_TOGGLE_MODE.random:
        return 'list-random'
      case MUSIC_TOGGLE_MODE.list:
        return 'list-order'
      case MUSIC_TOGGLE_MODE.singleLoop:
        return 'single-loop'
      default:
        return 'single'
    }
  }, [togglePlayMethod])

  const handleToggleLove = useCallback(() => {
    if (!musicInfo.id) return
    if (loved) {
      uncollectMusic()
      setLoved(false)
    } else {
      collectMusic()
      setLoved(true)
    }
  }, [loved, musicInfo.id])

  const iconSize = compact ? 17 : 21
  const mainIconSize = compact ? 21 : 27
  const mainBtnSize = compact ? 42 : 52

  return (
    <View style={styles.container}>
      <TouchableOpacity activeOpacity={0.7} onPress={toggleNextPlayMode} style={styles.sideBtn}>
        <Icon name={playModeIcon} size={compact ? 15 : 18} color={skinOn.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} onPress={() => { void playPrev() }} style={styles.sideBtn}>
        <Icon name="prevMusic" size={iconSize} color={skinOn.textPrimary} />
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => { void togglePlay() }}
        style={{ ...styles.playBtn, width: mainBtnSize, height: mainBtnSize, borderRadius: mainBtnSize / 2 }}
      >
        <Icon name={isPlay ? 'pause' : 'play'} size={mainIconSize} color={skinPalette.brandAlt} />
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} onPress={() => { void playNext() }} style={styles.sideBtn}>
        <Icon name="nextMusic" size={iconSize} color={skinOn.textPrimary} />
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} onPress={handleToggleLove} style={styles.sideBtn}>
        <Icon name="love" size={compact ? 15 : 18} color={loved ? skinPalette.brand : skinOn.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} onPress={onOpenPlayList} style={styles.sideBtn}>
        <Icon name="menu" size={compact ? 15 : 18} color={skinOn.textSecondary} />
      </TouchableOpacity>
    </View>
  )
})

const createStyles = (skinPalette: SkinPalette, skinOn: QqOnColor) => createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  sideBtn: {
    width: scaleSizeW(34),
    height: scaleSizeW(34),
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: skinPalette.brand,
  },
})
