import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'

import CheckBoxItem from '../../components/CheckBoxItem'
import { setVoiceWakeWordFree } from '@/core/voice'

export default memo(() => {
  const t = useI18n()
  const wakeWordFree = useSettingValue('voice.wakeWordFree')
  const setWakeWordFree = (wakeWordFree: boolean) => {
    updateSetting({ 'voice.wakeWordFree': wakeWordFree })
    void setVoiceWakeWordFree(wakeWordFree)
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem check={wakeWordFree} onChange={setWakeWordFree} label={t('setting_voice_wake_word_free')} helpTitle={t('setting_voice_wake_word_free')} helpDesc={t('setting_voice_wake_word_free_desc')} />
    </View>
  )
})


const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
