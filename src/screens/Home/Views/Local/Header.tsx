import { memo, useCallback, useRef } from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useScanning, useScanProgress, localAction } from '@/store/local'
import { importFolder, scanAllStorage } from '@/core/local'
import { saveLocalListNow, saveLocalExcludedIdsNow } from '@/core/init/local'
import { confirmDialog, toast } from '@/utils/tools'
import FileSelect, { type FileSelectType } from '@/components/common/FileSelect'
import SortModal, { type SortModalType } from './SortModal'
import FolderManagerModal, { type FolderManagerModalType } from './FolderManagerModal'
import FilterModal, { type FilterModalType } from './FilterModal'
import { useLocalFilterStats } from '@/store/local/hook'

export default memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const isScanning = useScanning()
  const scanProgress = useScanProgress()
  const sortModalRef = useRef<SortModalType>(null)
  const folderManagerRef = useRef<FolderManagerModalType>(null)
  const filterModalRef = useRef<FilterModalType>(null)
  const fileSelectRef = useRef<FileSelectType>(null)
  const filterStats = useLocalFilterStats()

  const handleSelectFolder = useCallback(() => {
    if (isScanning) {
      toast(t('local_scanning'))
      return
    }
    // 统一走应用内置文件浏览器（dirOnly 目录模式）选择音乐目录，
    // 不再拉起系统文件选择器（SAF），车机上 SAF 常进不去外部存储
    fileSelectRef.current?.show({ title: t('local_add_folder'), dirOnly: true }, (path) => {
      void importFolder(path)
    })
  }, [isScanning, t])

  const handleShowSort = useCallback(() => {
    sortModalRef.current?.show()
  }, [])

  const handleShowFolderManager = useCallback(() => {
    folderManagerRef.current?.show()
  }, [])

  const handleShowFilter = useCallback(() => {
    filterModalRef.current?.show()
  }, [])

  const handleScanAll = useCallback(async() => {
    if (isScanning) {
      toast(t('local_scanning'))
      return
    }
    await scanAllStorage()
  }, [isScanning, t])

  const handleClearList = useCallback(async() => {
    const confirmed = await confirmDialog({
      message: t('local_clear_list_tip'),
    })
    if (!confirmed) return
    localAction.clearList()
    saveLocalListNow() // Immediately save to storage
    saveLocalExcludedIdsNow() // Immediately save cleared excluded IDs
  }, [t])

  return (
    <View style={[styles.container, { backgroundColor: theme['c-primary-background'] }]}>
      <View style={styles.titleRow}>
        <Text size={18} color={theme['c-font']} style={styles.title}>{t('local_title')}</Text>
      </View>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme['c-primary-light-400-alpha-200'] }]}
          onPress={handleSelectFolder}
          disabled={isScanning}
        >
          <Icon name="add_folder" size={16} color={theme['c-primary-font']} />
          <Text size={13} color={theme['c-primary-font']} style={styles.buttonText}>
            {t('local_add_folder')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme['c-primary-light-400-alpha-200'] }]}
          onPress={handleShowFolderManager}
        >
          <Icon name="menu" size={16} color={theme['c-primary-font']} />
          <Text size={13} color={theme['c-primary-font']} style={styles.buttonText}>
            {t('local_folder_manager')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme['c-primary-light-400-alpha-200'] }]}
          onPress={handleShowSort}
        >
          <Icon name="slider" size={16} color={theme['c-primary-font']} />
          <Text size={13} color={theme['c-primary-font']} style={styles.buttonText}>
            {t('local_sort')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, {
            backgroundColor: filterStats.active ? theme['c-primary'] : theme['c-primary-light-400-alpha-200'],
          }]}
          onPress={handleShowFilter}
        >
          <Icon
            name={filterStats.active ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={16}
            color={filterStats.active ? theme['c-font'] : theme['c-primary-font']}
          />
          <Text size={13} color={filterStats.active ? theme['c-font'] : theme['c-primary-font']} style={styles.buttonText}>
            {filterStats.active
              ? t('local_filter_button_matched', { matched: filterStats.matched, total: filterStats.total })
              : t('local_filter')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme['c-primary-light-400-alpha-200'] }]}
          onPress={handleScanAll}
          disabled={isScanning}
        >
          <Icon name="search-2" size={16} color={theme['c-primary-font']} />
          <Text size={13} color={theme['c-primary-font']} style={styles.buttonText}>
            {t('local_scan_all')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme['c-primary-light-400-alpha-200'] }]}
          onPress={handleClearList}
          disabled={isScanning}
        >
          <Icon name="remove" size={16} color={theme['c-primary-font']} />
          <Text size={13} color={theme['c-primary-font']} style={styles.buttonText}>
            {t('local_clear_list')}
          </Text>
        </TouchableOpacity>
      </View>

      {isScanning && scanProgress.total > 0 && (
        <View style={styles.progressRow}>
          <Text size={11} color={theme['c-font-label']}>
            {t('local_scan_progress', { current: scanProgress.current, total: scanProgress.total })}
          </Text>
        </View>
      )}

      <SortModal ref={sortModalRef} />
      <FolderManagerModal ref={folderManagerRef} />
      <FilterModal ref={filterModalRef} />
      <FileSelect ref={fileSelectRef} />
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  buttonText: {
    marginLeft: 5,
  },
  progressRow: {
    marginTop: 8,
  },
})
