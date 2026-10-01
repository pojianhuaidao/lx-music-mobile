import { forwardRef, useImperativeHandle, useState, useCallback } from 'react'
import { View, TouchableOpacity, StyleSheet, FlatList } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Modal from './ModalWrapper'
import { useFolders, localAction } from '@/store/local'
import { type FolderInfo } from '@/store/local/state'
import { confirmDialog, toast } from '@/utils/tools'
import { selectAndImportFolder } from '@/core/local'

export interface FolderManagerModalType {
  show: () => void
  hide: () => void
}

export default forwardRef<FolderManagerModalType, {}>((_, ref) => {
  const theme = useTheme()
  const t = useI18n()
  const folders = useFolders()
  const [visible, setVisible] = useState(false)

  useImperativeHandle(ref, () => ({
    show: () => { setVisible(true) },
    hide: () => { setVisible(false) },
  }))

  const handleClose = useCallback(() => {
    setVisible(false)
  }, [])

  const handleAddFolder = useCallback(async() => {
    await selectAndImportFolder()
  }, [])

  const handleRemoveFolder = useCallback(async(folder: FolderInfo) => {
    const confirmed = await confirmDialog({
      message: t('local_remove_folder') + ': ' + folder.name + '?',
      confirmButtonText: t('confirm'),
      cancelButtonText: t('cancel'),
    })
    if (confirmed) {
      localAction.removeFolder(folder.path)
      toast(t('list_edit_action_tip_remove_success'))
    }
  }, [t])

  const renderItem = useCallback(({ item }: { item: FolderInfo }) => {
    return (
      <View style={[styles.folderItem, { borderBottomColor: theme['c-border-background'] }]}>
        <View style={styles.folderInfo}>
          <Icon name="add_folder" size={20} color={theme['c-font-label']} />
          <View style={styles.folderText}>
            <Text numberOfLines={1} size={14} color={theme['c-font']}>{item.name}</Text>
            <Text numberOfLines={1} size={11} color={theme['c-font-label']}>{item.path}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.removeBtn} onPress={() => { void handleRemoveFolder(item) }}>
          <Icon name="remove" size={18} color={theme['c-font-label']} />
        </TouchableOpacity>
      </View>
    )
  }, [theme, handleRemoveFolder])

  const keyExtractor = useCallback((item: FolderInfo) => item.path, [])

  const ListEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text size={14} color={theme['c-font-label']}>{t('local_folder_empty')}</Text>
    </View>
  ), [theme, t])

  return (
    <Modal visible={visible} onClose={handleClose}>
      <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
        <View style={styles.header}>
          <Text size={16} color={theme['c-font']}>{t('local_folder_manager')}</Text>
        </View>

        <FlatList
          data={folders}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListEmptyComponent={ListEmptyComponent}
          style={styles.list}
        />

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme['c-primary-light-400-alpha-200'] }]}
            onPress={handleAddFolder}
          >
            <Icon name="add_folder" size={16} color={theme['c-primary-font']} />
            <Text size={14} color={theme['c-primary-font']} style={styles.addBtnText}>
              {t('local_add_folder')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Text size={14} color={theme['c-font-label']}>{t('close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
})

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    minWidth: 300,
    maxHeight: 400,
  },
  header: {
    padding: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  list: {
    maxHeight: 250,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  folderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderText: {
    flex: 1,
    marginLeft: 10,
  },
  removeBtn: {
    padding: 8,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
  footer: {
    padding: 15,
    gap: 10,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 4,
  },
  addBtnText: {
    marginLeft: 8,
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
})
