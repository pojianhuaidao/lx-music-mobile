import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'
import { kuwoPalette } from '../palette'
import type { KuwoNavId } from './TopBar'

interface ModuleItem {
  id: KuwoNavId
  title: string
  desc: string
  /** 是否为大卡片（酷我「今日为你推荐」形态）*/
  big?: boolean
}

const RECOMMEND_MODULES: ModuleItem[] = [
  { id: 'nav_songlist', title: '今日为你推荐', desc: '每日更新的精选歌单', big: true },
  { id: 'nav_songlist', title: '猜你喜欢', desc: '基于收听偏好生成' },
  { id: 'nav_love', title: '我的收藏', desc: '收藏的单曲与歌单' },
]

const FEATURED_MODULES: ModuleItem[] = [
  { id: 'nav_top', title: '榜单', desc: '各平台热歌榜' },
  { id: 'nav_local', title: '本地音乐', desc: '扫描本机音频' },
  { id: 'nav_download', title: '下载管理', desc: '已下载歌曲' },
]

interface ContentGridProps {
  /** recommend = 中部推荐区，featured = 精选区 */
  variant: 'recommend' | 'featured'
  onOpen: (id: KuwoNavId) => void
}

const ModuleCard = memo(({ item, onOpen }: { item: ModuleItem, onOpen: (id: KuwoNavId) => void }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={{ ...styles.card, ...(item.big ? styles.cardBig : null) }}
      onPress={() => { onOpen(item.id) }}
    >
      <View style={styles.cardHeader}>
        <Text size={item.big ? 15 : 13} color={kuwoPalette.textPrimary} style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Icon name="nextMusic" size={11} color={kuwoPalette.textSecondary} />
      </View>
      <Text size={10} color={kuwoPalette.textSecondary} numberOfLines={1}>{item.desc}</Text>
      {
        item.big
          ? (
              <View style={styles.placeholderRow}>
                <View style={styles.placeholderCover} />
                <View style={{ ...styles.placeholderCover, backgroundColor: kuwoPalette.brand }} />
                <View style={{ ...styles.placeholderCover, backgroundColor: kuwoPalette.brandAlt }} />
                <View style={styles.placeholderCover} />
              </View>
            )
          : null
      }
    </TouchableOpacity>
  )
})

/** 酷我车机版内容区（中部推荐 / 精选）*/
export default memo(({ variant, onOpen }: ContentGridProps) => {
  const modules = variant == 'recommend' ? RECOMMEND_MODULES : FEATURED_MODULES
  return (
    <View style={styles.container}>
      <Text size={12} color={kuwoPalette.textSecondary} style={styles.sectionTitle}>
        {variant == 'recommend' ? '推荐' : '精选'}
      </Text>
      {
        modules.map(item => (
          <ModuleCard key={item.title} item={item} onOpen={onOpen} />
        ))
      }
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: scaleSizeH(6),
    marginLeft: scaleSizeW(2),
  },
  card: {
    backgroundColor: kuwoPalette.card,
    borderRadius: kuwoPalette.radius,
    paddingHorizontal: scaleSizeW(10),
    paddingVertical: scaleSizeH(9),
    marginBottom: scaleSizeH(8),
  },
  cardBig: {
    paddingBottom: scaleSizeH(10),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleSizeH(3),
  },
  cardTitle: {
    flexShrink: 1,
    fontWeight: 'bold',
  },
  placeholderRow: {
    flexDirection: 'row',
    marginTop: scaleSizeH(8),
  },
  placeholderCover: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: kuwoPalette.radius * 0.5,
    backgroundColor: kuwoPalette.background,
    marginRight: scaleSizeW(6),
  },
})
