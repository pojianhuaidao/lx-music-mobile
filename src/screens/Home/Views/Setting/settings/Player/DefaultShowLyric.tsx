import { useI18n } from '@/lang'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'

import CheckBoxItem from '../../components/CheckBoxItem'

export default memo(() => {
  const t = useI18n()
  const defaultShowLyric = useSettingValue('playDetail.defaultShowLyric')
  const setDefaultShowLyric = (value: boolean) => {
    updateSetting({ 'playDetail.defaultShowLyric': value })
  }

  return (
    <View style={{ marginTop: 5 }}>
      <CheckBoxItem check={defaultShowLyric} onChange={setDefaultShowLyric} label={t('setting_play_default_show_lyric')} />
    </View>
  )
})