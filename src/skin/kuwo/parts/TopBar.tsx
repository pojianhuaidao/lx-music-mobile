import { useMemo, memo, useCallback } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { createStyle, confirmDialog, exitApp } from '@/utils/tools'
import type { NAV_ID_Type } from '@/config/constant'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { useKuwoTheme } from '../theme'
import type { KuwoOnColor, SkinPalette } from '../palette'

export type KuwoNavId = NAV_ID_Type

interface TabItem {
  id: KuwoNavId
  label: string
}

/** 酷我车机版顶部导航：搜索 / 我的 / 推荐 / 听吧 / 臻选 / 曲库 */
export const KUWO_TABS: TabItem[] = [
  { id: 'nav_search', label: '搜索' },
  { id: 'nav_love', label: '我的' },
  { id: 'nav_songlist', label: '推荐' },
  { id: 'nav_top', label: '听吧' },
  { id: 'nav_download', label: '臻选' },
  { id: 'nav_local', label: '曲库' },
]

interface TopBarProps {
  activeId: KuwoNavId
  /** 是否处于酷我推荐首页（骨架页） */
  isHome: boolean
  onOpen: (id: KuwoNavId) => void
  onHome: () => void
}

export default memo(({ activeId, isHome, onOpen, onHome }: TopBarProps) => {
  const { palette: skinPalette, on: skinOn } = useKuwoTheme()
  const styles = useMemo(() => createStyles(skinPalette, skinOn), [skinPalette, skinOn])
  const handleExit = useCallback(() => {
    void confirmDialog({
      message: '是否退出洛雪音乐？',
      confirmButtonText: '退出',
    }).then((confirm: boolean) => {
      if (!confirm) return
      exitApp()
    })
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <Text size={16} color={skinPalette.textPrimary} style={styles.brandText}>洛雪音乐</Text>
        <View style={styles.brandDot} />
      </View>
      <ScrollView
        style={styles.tabs}
        contentContainerStyle={styles.tabsContent}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {
          KUWO_TABS.map(({ id, label }) => {
            const isActive = !isHome && activeId == id
            return (
              <TouchableOpacity
                key={id}
                activeOpacity={0.7}
                style={{ ...styles.tab, backgroundColor: isActive ? skinPalette.selectedBg : 'transparent' }}
                onPress={() => { onOpen(id) }}
              >
                <Text size={13} color={isActive ? skinPalette.textPrimary : skinPalette.textSecondary}>{label}</Text>
              </TouchableOpacity>
            )
          })
        }
      </ScrollView>
      <View style={styles.actions}>
        {
          isHome
            ? null
            : (
                <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={onHome}>
                  <Icon name="home" size={15} color={skinPalette.textPrimary} />
                </TouchableOpacity>
              )
        }
        <TouchableOpacity
          style={{ ...styles.actionBtn, ...styles.settingBtn }}
          activeOpacity={0.7}
          onPress={() => { onOpen('nav_setting') }}
        >
          <Icon name="setting" size={15} color={skinPalette.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={handleExit}>
          <Icon name="exit2" size={15} color={skinPalette.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  )
})

const createStyles = (skinPalette: SkinPalette, skinOn: KuwoOnColor) => createStyle({
  container: {
    height: scaleSizeH(46),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleSizeW(10),
    backgroundColor: skinPalette.card,
    borderRadius: skinPalette.radius,
    marginBottom: scaleSizeH(8),
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginRight: scaleSizeW(12),
  },
  brandText: {
    fontWeight: 'bold',
  },
  brandDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginLeft: 2,
    marginBottom: 4,
    backgroundColor: skinPalette.brand,
  },
  tabs: {
    flexGrow: 1,
    flexShrink: 1,
  },
  tabsContent: {
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: scaleSizeW(12),
    paddingVertical: scaleSizeH(5),
    borderRadius: 13,
    marginRight: scaleSizeW(4),
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: scaleSizeW(8),
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: skinPalette.background,
    marginLeft: scaleSizeW(6),
  },
  settingBtn: {
    backgroundColor: skinPalette.brand,
  },
})
