import { useMemo, memo, useState, useCallback } from 'react'
import { ScrollView, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { NAV_MENUS } from '@/config/constant'
import { useI18n } from '@/lang'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'
import { useKuwoTheme } from '../theme'
import type { KuwoOnColor, SkinPalette } from '../palette'
import type { KuwoNavId } from './TopBar'

type IconName = typeof NAV_MENUS[number]['icon']

interface NavRailProps {
  /** 当前分组页 id；处于酷我推荐首页时传 null */
  activeId: KuwoNavId | null
  onOpen: (id: KuwoNavId) => void
  onHome: () => void
}

interface RailMetrics {
  /** 高度不足以放下全部条目时启用紧凑尺寸 */
  compact: boolean
  icon: number
  paddingV: number
  gap: number
  labelSize: number
  labelGap: number
}

/**
 * 根据右栏实际可用高度推算条目尺寸
 *
 * 低分辨率横屏（如 dp 640x360）下右栏高度仅二三百 dp，8 个导航项 + 推荐按钮
 * 按设计稿尺寸堆叠会溢出近百 dp，底部条目被父级裁掉、图标只剩半个。
 * 这里按可用高度做一次紧凑降级，同时 ScrollView 常驻 flex:1 兜底滚动，
 * 保证任何高度下所有入口都可达。
 */
const getRailMetrics = (railHeight: number): RailMetrics => {
  const icon = scaleSizeW(15)
  const paddingV = scaleSizeH(9)
  const gap = scaleSizeH(6)
  const labelGap = scaleSizeH(3)
  const labelSize = 9
  const naturalItem = paddingV * 2 + icon + labelGap + 12 + gap
  const compact = railHeight > 0 && railHeight < naturalItem * (NAV_MENUS.length + 1)
  if (!compact) {
    return { compact, icon, paddingV, gap, labelSize, labelGap }
  }
  return {
    compact,
    // 紧凑图标不放大：低分屏 scaleSizeW(15) 本身可能只有 8dp 左右，
    // 直接套 11dp 地板反而比自然尺寸更大、条目更高，这里以自然尺寸为上限
    icon: Math.min(icon, Math.max(9, Math.round(icon * 0.78))),
    paddingV: Math.max(2, Math.round(paddingV * 0.35)),
    gap: Math.max(2, Math.round(gap * 0.4)),
    labelSize: 8,
    labelGap: 1,
  }
}

/**
 * 酷我车机版右栏快捷入口
 *
 * 覆盖洛雪全部导航分组，避免皮肤接管首页后丢失任何功能入口；
 * 条目文案复用既有多语言 key（t('nav_xxx')）。
 */
export default memo(({ activeId, onOpen, onHome }: NavRailProps) => {
  const { palette: skinPalette, on: skinOn } = useKuwoTheme()
  const [railHeight, setRailHeight] = useState(0)
  const metrics = useMemo(() => getRailMetrics(railHeight), [railHeight])
  const styles = useMemo(() => createStyles(skinPalette, skinOn, metrics), [skinPalette, skinOn, metrics])
  const t = useI18n()

  const handleLayout = useCallback(({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    setRailHeight(Math.round(layout.height))
  }, [])

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <ScrollView
        style={styles.rail}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {
          NAV_MENUS.map(({ id, icon }) => {
            const isActive = activeId == id
            return (
              <TouchableOpacity
                key={id}
                activeOpacity={0.7}
                style={{ ...styles.item, ...(isActive ? styles.itemActive : null) }}
                onPress={() => { onOpen(id) }}
              >
                <Icon name={icon as IconName} size={metrics.icon} color={isActive ? skinPalette.textPrimary : skinPalette.textSecondary} />
                <Text size={metrics.labelSize} color={isActive ? skinPalette.textPrimary : skinPalette.textSecondary} numberOfLines={1} style={styles.label}>
                  {t(id)}
                </Text>
              </TouchableOpacity>
            )
          })
        }
      </ScrollView>
      <TouchableOpacity activeOpacity={0.7} style={{ ...styles.item, ...styles.homeItem }} onPress={onHome}>
        <Icon name="home" size={metrics.icon} color={skinPalette.textPrimary} />
        <Text size={metrics.labelSize} color={skinPalette.textPrimary} numberOfLines={1} style={styles.label}>推荐</Text>
      </TouchableOpacity>
    </View>
  )
})

const createStyles = (skinPalette: SkinPalette, skinOn: KuwoOnColor, metrics: RailMetrics) => createStyle({
  container: {
    flex: 1,
  },
  rail: {
    // 不写 flex:1 时 ScrollView 会按内容高度撑开，条目超出可用高就被父级裁掉且无法滚动
    flex: 1,
    flexGrow: 1,
  },
  content: {
    paddingBottom: metrics.gap,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: metrics.paddingV,
    marginBottom: metrics.gap,
    borderRadius: skinPalette.radius,
    backgroundColor: skinPalette.card,
  },
  itemActive: {
    backgroundColor: skinPalette.selectedBg,
  },
  label: {
    marginTop: metrics.labelGap,
  },
  homeItem: {
    backgroundColor: skinPalette.brand,
    marginBottom: 0,
    marginTop: scaleSizeW(2),
  },
})
