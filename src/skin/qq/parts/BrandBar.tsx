import { memo, useMemo } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import type { NAV_ID_Type } from '@/config/constant'
import { useQqTheme } from '../theme'
import type { QqOnColor, SkinPalette } from '../palette'

export type QqNavId = NAV_ID_Type

interface TabItem {
  id: QqNavId
  label: string
}

/** QQ音乐车机版顶部导航：推荐 / 排行 / 我的 / 本地 */
export const QQ_TABS: TabItem[] = [
  { id: 'nav_songlist', label: '推荐' },
  { id: 'nav_top', label: '排行' },
  { id: 'nav_love', label: '我的' },
  { id: 'nav_local', label: '本地' },
]

interface BrandBarProps {
  activeId: QqNavId
  /** 竖屏使用更大的品牌字号与更大的点击热区 */
  compact?: boolean
  onOpen: (id: QqNavId) => void
}

/**
 * QQ音乐品牌栏 + 分类 tab
 *
 * 版式对齐 QQ 车机版：左侧品牌绿字标题，中部胶囊 tab，右侧搜索入口。
 */
export default memo(({ activeId, compact = false, onOpen }: BrandBarProps) => {
  const { palette: skinPalette, on: skinOn } = useQqTheme()
  const styles = useMemo(() => createStyles(skinPalette, skinOn, compact), [skinPalette, skinOn, compact])

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <View style={styles.brandMark} />
        <Text size={compact ? 19 : 17} color={skinPalette.brand} style={styles.brandText}>QQ音乐</Text>
        <Text size={10} color={skinPalette.textSecondary} style={styles.brandSub}>车机版</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabList}
        style={styles.tabScroll}
      >
        {QQ_TABS.map(item => {
          const isActive = activeId === item.id
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.75}
              onPress={() => { onOpen(item.id) }}
              style={{ ...styles.tabItem, ...(isActive ? styles.tabItemActive : null) }}
            >
              <Text
                size={compact ? 14 : 13}
                color={isActive ? '#FFFFFF' : skinPalette.textSecondary}
                style={isActive ? styles.tabTextActive : styles.tabText}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
      <TouchableOpacity activeOpacity={0.7} onPress={() => { onOpen('nav_search') }} style={styles.searchBtn}>
        <Icon name="search" size={compact ? 18 : 16} color={skinPalette.textPrimary} />
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} onPress={() => { onOpen('nav_setting') }} style={styles.settingBtn}>
        <Icon name="setting" size={compact ? 18 : 16} color={skinPalette.textPrimary} />
      </TouchableOpacity>
    </View>
  )
})

const createStyles = (skinPalette: SkinPalette, skinOn: QqOnColor, compact: boolean) => createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleSizeW(compact ? 16 : 14),
    height: scaleSizeH(compact ? 52 : 46),
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: scaleSizeW(14),
  },
  brandMark: {
    width: scaleSizeW(4),
    height: scaleSizeH(compact ? 18 : 16),
    borderRadius: 2,
    backgroundColor: skinPalette.brandAlt,
    marginRight: scaleSizeW(7),
  },
  brandText: {
    fontWeight: '700',
  },
  brandSub: {
    marginLeft: scaleSizeW(6),
    marginTop: scaleSizeH(4),
  },
  tabScroll: {
    flex: 1,
  },
  tabList: {
    alignItems: 'center',
    paddingRight: scaleSizeW(8),
  },
  tabItem: {
    paddingHorizontal: scaleSizeW(compact ? 15 : 12),
    paddingVertical: scaleSizeH(compact ? 7 : 6),
    borderRadius: scaleSizeW(18),
    marginRight: scaleSizeW(8),
    backgroundColor: 'transparent',
  },
  tabItemActive: {
    backgroundColor: skinPalette.brand,
  },
  tabText: {
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  searchBtn: {
    width: scaleSizeW(compact ? 34 : 30),
    height: scaleSizeW(compact ? 34 : 30),
    borderRadius: scaleSizeW(17),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: skinPalette.card,
  },
  settingBtn: {
    width: scaleSizeW(compact ? 34 : 30),
    height: scaleSizeW(compact ? 34 : 30),
    borderRadius: scaleSizeW(17),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: skinPalette.brand,
    marginLeft: scaleSizeW(8),
  },
})
