import { memo, useMemo } from 'react'
import { View } from 'react-native'

import InputItem, { type InputItemProps } from '../../components/InputItem'
import { createStyle, toast } from '@/utils/tools'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { setVoiceWakeWord } from '@/core/voice'

export default memo(() => {
  const t = useI18n()
  const wakeWord = useSettingValue('voice.wakeWord')
  const setWakeWord = (wakeWord: string) => {
    updateSetting({ 'voice.wakeWord': wakeWord })
    void setVoiceWakeWord(wakeWord)
  }

  const word = useMemo(() => wakeWord || '', [wakeWord])

  const setWord: InputItemProps['onChanged'] = (value, callback) => {
    const word = value.trim()
    callback(word)
    if (wakeWord == word) return
    if (!word) {
      toast(t('setting_voice_wake_word_empty'))
      return
    }
    setWakeWord(word)
    toast(t('setting_voice_wake_word_save_tip'))
  }

  return (
    <View style={styles.content} >
      <InputItem
        value={word}
        label={t('setting_voice_wake_word')}
        onChanged={setWord}
        placeholder={t('setting_voice_wake_word_placeholder')} />
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 10,
  },
})
