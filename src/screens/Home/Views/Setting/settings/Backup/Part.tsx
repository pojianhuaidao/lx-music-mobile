import { memo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Button from '../../components/Button'
import CheckBoxItem from '../../components/CheckBoxItem'
import { useI18n } from '@/lang'
import ListImportExport, { type ListImportExportType } from './ListImportExport'
import type { BackupSelectOptions } from './actions'


interface PartProps {
  selectOptions: BackupSelectOptions
  setOption: (key: keyof BackupSelectOptions) => (value: boolean) => void
}

export default memo(({ selectOptions, setOption }: PartProps) => {
  const t = useI18n()
  const listImportExportRef = useRef<ListImportExportType>(null)

  return (
    <>
      <SubTitle title={t('setting_backup_part')}>
        <View style={styles.checkList}>
          <CheckBoxItem check={selectOptions.playList} label={t('setting_backup_part_play_list')} onChange={setOption('playList')} marginRight={14} />
          <CheckBoxItem check={selectOptions.localMusicList} label={t('setting_backup_part_local_music_list')} onChange={setOption('localMusicList')} marginRight={14} />
          <CheckBoxItem check={selectOptions.userApi} label={t('setting_backup_part_user_api')} onChange={setOption('userApi')} marginRight={14} />
          <CheckBoxItem check={selectOptions.setting} label={t('setting_backup_part_setting')} onChange={setOption('setting')} />
        </View>
        <View style={styles.list}>
          <Button onPress={() => listImportExportRef.current?.import()}>{t('setting_backup_part_import_data')}</Button>
          <Button onPress={() => listImportExportRef.current?.export()}>{t('setting_backup_part_export_data')}</Button>
        </View>
      </SubTitle>
      <ListImportExport ref={listImportExportRef} selectOptions={selectOptions} />
    </>
  )
})

const styles = StyleSheet.create({
  checkList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  list: {
    flexDirection: 'row',
  },
})
