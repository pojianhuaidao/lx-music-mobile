import { useMemo, memo, useCallback } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { createStyle, confirmDialog, exitApp } from '@/utils/tools'
import type { NAV_ID_Type } from '@/config/constant'
import { scaleSizeH, scaleSizeW, setSpText } from '@/utils/pixelRatio'
import { getNavTabMetrics, getNavTabWidth, getNavTabsContentWidth } from '@/skin/common/navTabs'
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
  // 导航项按「文字长度 + 实际渲染字号」显式算出固定宽度（含最小宽度兜底），并整条横向可滚：
  // 窄横屏下任何一项都不会被压缩或裁切，也保证 ScrollView 有真实的横向滚动范围
  const navTabs = useMemo(() => getNavTabMetrics({
    padH: scaleSizeW(12),
    gap: scaleSizeW(4),
    font: 13,
  }), [])
  const tabLayout = useMemo(() => {
    const renderedFontSize = setSpText(navTabs.fontSize)
    const tabWidths = KUWO_TABS.map(item => getNavTabWidth(item.label, renderedFontSize, navTabs.padH))
    return { tabWidths, contentWidth: getNavTabsContentWidth(tabWidths, navTabs.gap) }
  }, [navTabs])
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
        contentContainerStyle={[styles.tabsContent, { width: tabLayout.contentWidth }]}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {
          KUWO_TABS.map(({ id, label }, index) => {
            const isActive = !isHome && activeId == id
            return (
              <TouchableOpacity
                key={id}
                activeOpacity={0.7}
                style={{
                  ...styles.tab,
                  backgroundColor: isActive ? skinPalette.selectedBg : 'transparent',
                  width: tabLayout.tabWidths[index],
                  marginRight: navTabs.gap,
                }}
                onPress={() => { onOpen(id) }}
              >
                <Text numberOfLines={1} size={navTabs.fontSize} color={isActive ? skinPalette.textPrimary : skinPalette.textSecondary}>{label}</Text>
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
  // 导航条容器：占满品牌区与右侧按钮之间的剩余宽度，内容超出即可横向滚动
  // 不固定高度（按内容自适应），避免极端缩放下导航项在垂直方向被裁
  tabs: {
    flex: 1,
  },
  // 内容容器：显式横向排布 + 固定总宽（由 tabLayout 注入），保证内容宽于视口时可横向滚动
  tabsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
  },
  tab: {
    // 关键：宽度由「文字宽度 + 内边距」显式算出（见 tabLayout），不参与任何压缩/分配
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
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
