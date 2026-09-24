import { useI18n } from '@/lang'
import { memo, useCallback, useState } from 'react'

import Section from '../../components/Section'
import Part from './Part'
import Webdav from './Webdav'
import type { BackupSelectOptions } from './actions'

export default memo(() => {
  const t = useI18n()
  const [selectOptions, setSelectOptions] = useState<BackupSelectOptions>({ playList: true, localMusicList: false, userApi: false, setting: false })
  const setOption = useCallback((key: keyof BackupSelectOptions) => (value: boolean) => {
    setSelectOptions(prev => ({ ...prev, [key]: value }))
  }, [])

  return (
    <Section title={t('setting_backup')}>
      <Part selectOptions={selectOptions} setOption={setOption} />
      <Webdav selectOptions={selectOptions} />
    </Section>
  )
})
