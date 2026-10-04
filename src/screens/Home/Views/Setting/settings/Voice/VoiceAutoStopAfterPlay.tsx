import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'

import CheckBoxItem from '../../components/CheckBoxItem'

export default memo(() => {
  const t = useI18n()
  const autoStopAfterPlay = useSettingValue('voice.autoStopAfterPlay')
  const setAutoStopAfterPlay = (autoStopAfterPlay: boolean) => {
    updateSetting({ 'voice.autoStopAfterPlay': autoStopAfterPlay })
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem check={autoStopAfterPlay} onChange={setAutoStopAfterPlay} label={t('setting_voice_auto_stop_after_play')} />
    </View>
  )
})


const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
