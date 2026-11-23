import { memo, useMemo } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW, setSpText } from '@/utils/pixelRatio'
import { getNavTabMetrics, getNavTabWidth, getNavTabsContentWidth } from '@/skin/common/navTabs'
import type { NAV_ID_Type } from '@/config/constant'
import { useNeteaseTheme } from '../theme'
import type { NeteaseOnColor, NeteasePalette } from '../palette'

export type NeteaseNavId = NAV_ID_Type

interface TabItem {
  id: NeteaseNavId
  label: string
}

/** 网易云音乐车机版顶部导航：推荐 / 排行 / 我的 / 本地 */
export const NETEASE_TABS: TabItem[] = [
  { id: 'nav_songlist', label: '推荐' },
  { id: 'nav_top', label: '排行' },
  { id: 'nav_love', label: '我的' },
  { id: 'nav_local', label: '本地' },
]

interface BrandBarProps {
  activeId: NeteaseNavId
  /** 竖屏使用更大的品牌字号与更大的点击热区 */
  compact?: boolean
  onOpen: (id: NeteaseNavId) => void
}

/**
 * 网易云音乐品牌栏 + 分类 tab
 *
 * 版式对齐 网易云 车机版：左侧红色品牌标题 + 次级蓝标记，中部胶囊 tab，右侧搜索入口。
 */
export default memo(({ activeId, compact = false, onOpen }: BrandBarProps) => {
  const { palette: skinPalette, on: skinOn } = useNeteaseTheme()
  const styles = useMemo(() => createStyles(skinPalette, skinOn, compact), [skinPalette, skinOn, compact])
  // 导航项按「文字长度 + 实际渲染字号」显式算出固定宽度（含最小宽度兜底），并整条横向可滚：
  // 窄横屏下任何一项都不会被压缩或裁切，也保证 ScrollView 有真实的横向滚动范围
  const navTabs = useMemo(() => getNavTabMetrics({
    padH: scaleSizeW(compact ? 15 : 12),
    gap: scaleSizeW(8),
    font: compact ? 14 : 13,
  }), [compact])
  const tabLayout = useMemo(() => {
    const renderedFontSize = setSpText(navTabs.fontSize)
    const tabWidths = NETEASE_TABS.map(item => getNavTabWidth(item.label, renderedFontSize, navTabs.padH))
    return { tabWidths, contentWidth: getNavTabsContentWidth(tabWidths, navTabs.gap) }
  }, [navTabs])

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <View style={styles.brandMark} />
        <Text size={compact ? 19 : 17} color={skinPalette.brand} style={styles.brandText}>网易云音乐</Text>
        <Text size={10} color={skinPalette.textSecondary} style={styles.brandSub}>车机版</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.tabList, { width: tabLayout.contentWidth }]}
        style={styles.tabScroll}
      >
        {NETEASE_TABS.map((item, index) => {
          const isActive = activeId === item.id
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.75}
              onPress={() => { onOpen(item.id) }}
              style={{
                ...styles.tabItem,
                ...(isActive ? styles.tabItemActive : null),
                width: tabLayout.tabWidths[index],
                marginRight: navTabs.gap,
              }}
            >
              <Text
                numberOfLines={1}
                size={navTabs.fontSize}
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

const createStyles = (skinPalette: NeteasePalette, skinOn: NeteaseOnColor, compact: boolean) => createStyle({
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
    backgroundColor: skinPalette.spot,
    marginRight: scaleSizeW(7),
  },
  brandText: {
    fontWeight: '700',
  },
  brandSub: {
    marginLeft: scaleSizeW(6),
    marginTop: scaleSizeH(4),
  },
  // 导航条容器：占满品牌区与右侧按钮之间的剩余宽度，内容超出即可横向滚动
  // 不固定高度（按内容自适应），避免极端缩放下导航项在垂直方向被裁
  tabScroll: {
    flex: 1,
  },
  // 内容容器：显式横向排布 + 固定总宽（由 tabLayout 注入），保证内容宽于视口时可横向滚动
  tabList: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
    paddingRight: scaleSizeW(8),
  },
  tabItem: {
    // 关键：宽度由「文字宽度 + 内边距」显式算出（见 tabLayout），不参与任何压缩/分配
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
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
