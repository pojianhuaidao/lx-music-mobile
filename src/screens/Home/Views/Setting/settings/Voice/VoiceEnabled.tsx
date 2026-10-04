import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'

import CheckBoxItem from '../../components/CheckBoxItem'
import { setVoiceEnabled } from '@/core/voice'

export default memo(() => {
  const t = useI18n()
  const enabled = useSettingValue('voice.enabled')
  const setEnabled = (enabled: boolean) => {
    updateSetting({ 'voice.enabled': enabled })
    void setVoiceEnabled(enabled)
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem check={enabled} onChange={setEnabled} label={t('setting_voice_enabled')} />
    </View>
  )
})


const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
