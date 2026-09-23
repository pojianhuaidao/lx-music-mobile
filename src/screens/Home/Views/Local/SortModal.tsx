import { forwardRef, useImperativeHandle, useState, useCallback } from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { useI18n, type Message } from '@/lang'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Modal from './ModalWrapper'
import { localAction, useSortSetting } from '@/store/local'
import { type SortType, type SortOrder } from '@/store/local/state'

export interface SortModalType {
  show: () => void
  hide: () => void
}

const sortTypes: { id: SortType, labelKey: keyof Message }[] = [
  { id: 'name', labelKey: 'local_sort_name' },
  { id: 'singer', labelKey: 'local_sort_singer' },
  { id: 'album', labelKey: 'local_sort_album' },
  { id: 'time', labelKey: 'local_sort_time' },
  { id: 'addTime', labelKey: 'local_sort_addTime' },
  { id: 'size', labelKey: 'local_sort_size' },
]

const sortOrders: { id: SortOrder, labelKey: keyof Message }[] = [
  { id: 'asc', labelKey: 'local_sort_asc' },
  { id: 'desc', labelKey: 'local_sort_desc' },
]

export default forwardRef<SortModalType, {}>((_, ref) => {
  const theme = useTheme()
  const t = useI18n()
  const { sortType, sortOrder } = useSortSetting()
  const [visible, setVisible] = useState(false)

  useImperativeHandle(ref, () => ({
    show: () => setVisible(true),
    hide: () => setVisible(false),
  }))

  const handleClose = useCallback(() => {
    setVisible(false)
  }, [])

  const handleSortTypeChange = useCallback((type: SortType) => {
    localAction.setSortType(type)
  }, [])

  const handleSortOrderChange = useCallback((order: SortOrder) => {
    localAction.setSortOrder(order)
  }, [])

  return (
    <Modal visible={visible} onClose={handleClose}>
      <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
        <View style={styles.header}>
          <Text size={16} color={theme['c-font']}>{t('local_sort')}</Text>
        </View>

        <View style={styles.section}>
          <Text size={13} color={theme['c-font-label']} style={styles.sectionTitle}>
            {t('list_sort_modal_by_field')}
          </Text>
          <View style={styles.optionList}>
            {sortTypes.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.option,
                  sortType === item.id && { backgroundColor: theme['c-primary-light-400-alpha-200'] },
                ]}
                onPress={() => handleSortTypeChange(item.id)}
              >
                <Text
                  size={14}
                  color={sortType === item.id ? theme['c-primary-font'] : theme['c-font']}
                >
                  {t(item.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text size={13} color={theme['c-font-label']} style={styles.sectionTitle}>
            {t('list_sort_modal_by_type')}
          </Text>
          <View style={styles.optionList}>
            {sortOrders.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.option,
                  sortOrder === item.id && { backgroundColor: theme['c-primary-light-400-alpha-200'] },
                ]}
                onPress={() => handleSortOrderChange(item.id)}
              >
                <Text
                  size={14}
                  color={sortOrder === item.id ? theme['c-primary-font'] : theme['c-font']}
                >
                  {t(item.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
          <Text size={14} color={theme['c-primary-font']}>{t('close')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
})

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    minWidth: 280,
    padding: 15,
  },
  header: {
    marginBottom: 15,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    marginBottom: 10,
  },
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
})
