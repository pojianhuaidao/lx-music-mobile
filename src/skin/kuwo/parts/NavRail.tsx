import { useMemo, memo } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
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

/**
 * 酷我车机版右栏快捷入口
 *
 * 覆盖洛雪全部导航分组，避免皮肤接管首页后丢失任何功能入口；
 * 条目文案复用既有多语言 key（t('nav_xxx')）。
 */
export default memo(({ activeId, onOpen, onHome }: NavRailProps) => {
  const { palette: skinPalette, on: skinOn } = useKuwoTheme()
  const styles = useMemo(() => createStyles(skinPalette, skinOn), [skinPalette, skinOn])
  const t = useI18n()

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
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
                <Icon name={icon as IconName} size={15} color={isActive ? skinPalette.textPrimary : skinPalette.textSecondary} />
                <Text size={9} color={isActive ? skinPalette.textPrimary : skinPalette.textSecondary} numberOfLines={1} style={styles.label}>
                  {t(id)}
                </Text>
              </TouchableOpacity>
            )
          })
        }
      </ScrollView>
      <TouchableOpacity activeOpacity={0.7} style={{ ...styles.item, ...styles.homeItem }} onPress={onHome}>
        <Icon name="home" size={15} color={skinPalette.textPrimary} />
        <Text size={9} color={skinPalette.textPrimary} numberOfLines={1} style={styles.label}>推荐</Text>
      </TouchableOpacity>
    </View>
  )
})

const createStyles = (skinPalette: SkinPalette, skinOn: KuwoOnColor) => createStyle({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: scaleSizeH(6),
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scaleSizeH(9),
    marginBottom: scaleSizeH(6),
    borderRadius: skinPalette.radius,
    backgroundColor: skinPalette.card,
  },
  itemActive: {
    backgroundColor: skinPalette.selectedBg,
  },
  label: {
    marginTop: scaleSizeH(3),
  },
  homeItem: {
    backgroundColor: skinPalette.brand,
    marginBottom: 0,
    marginTop: scaleSizeW(2),
  },
})
