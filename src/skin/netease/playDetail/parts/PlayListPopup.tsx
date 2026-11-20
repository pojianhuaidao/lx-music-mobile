import { forwardRef, memo, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Popup, { type PopupProps, type PopupType } from '@/components/common/Popup'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useActiveListId, useMusicList } from '@/store/list/hook'
import { usePlayMusicInfo } from '@/store/player/hook'
import { playListById } from '@/core/player/player'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { useNeteaseTheme } from '../../theme'
import type { NeteaseOnColor, NeteasePalette } from '../../palette'

export interface NeteasePlayListPopupType {
  show: () => void
}

export interface NeteasePlayListPopupProps extends Omit<PopupProps, 'children'> {
  /** 点击歌曲后是否关闭弹层，默认关闭 */
  closeOnSelect?: boolean
}

/**
 * 网易云音乐风格播放列表弹层
 *
 * 数据来自当前激活列表（useMusicList），点击切歌走 core/player.playListById，
 * 与原生播放列表行为一致，仅做外观替换。
 */
export default memo(forwardRef<NeteasePlayListPopupType, NeteasePlayListPopupProps>(({ closeOnSelect = true, ...props }, ref) => {
  const { palette: skinPalette, on: skinOn } = useNeteaseTheme()
  const styles = useMemo(() => createStyles(skinPalette, skinOn), [skinPalette, skinOn])
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  const popupRef = useRef<PopupType>(null)
  const list = useMusicList()
  const activeListId = useActiveListId()
  const playMusicInfo = usePlayMusicInfo()

  const currentMusicId = playMusicInfo.musicInfo?.id

  useImperativeHandle(ref, () => ({
    show() {
      if (visible) popupRef.current?.setVisible(true)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          popupRef.current?.setVisible(true)
        })
      }
    },
  }), [visible])

  const handleSelect = (musicId: string) => {
    void playListById(activeListId, musicId)
    if (closeOnSelect) popupRef.current?.setVisible(false)
  }

  const listContent = useMemo(() => {
    if (!list.length) {
      return <Text size={13} color={skinPalette.textSecondary} style={styles.empty}>{t('no_item')}</Text>
    }
    return list.map((music) => {
      const isActive = music.id === currentMusicId
      return (
        <TouchableOpacity
          key={`${music.source}_${music.id}`}
          activeOpacity={0.7}
          onPress={() => { handleSelect(music.id) }}
          style={styles.row}
        >
          <View style={styles.rowInfo}>
            <Text
              size={13}
              numberOfLines={1}
              color={isActive ? skinPalette.brandAlt : skinPalette.textPrimary}
              style={isActive ? styles.activeName : undefined}
            >{music.name}</Text>
            <Text size={11} numberOfLines={1} color={skinPalette.textSecondary}>{music.singer}</Text>
          </View>
          {isActive ? <Icon name="play" size={14} color={skinPalette.brandAlt} /> : null}
        </TouchableOpacity>
      )
    })
  }, [list, currentMusicId, t])

  return (
    visible
      ? (
        <Popup ref={popupRef} title={t('setting_backup_part_play_list')} onHide={() => { setVisible(false) }} {...props}>
          <ScrollView>
            <View onStartShouldSetResponder={() => true} style={styles.content}>{listContent}</View>
          </ScrollView>
        </Popup>
        )
      : null
  )
}), (prev, next) => prev.closeOnSelect === next.closeOnSelect)

const createStyles = (skinPalette: NeteasePalette, skinOn: NeteaseOnColor) => createStyle({
  content: {
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: skinPalette.divider,
  },
  rowInfo: {
    flex: 1,
    marginRight: 8,
  },
  activeName: {
    fontWeight: 'bold',
  },
  empty: {
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
})
