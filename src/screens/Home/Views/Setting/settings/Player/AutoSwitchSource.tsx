import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'


import CheckBoxItem from '../../components/CheckBoxItem'

export default memo(() => {
  const t = useI18n()
  const autoSwitchSource = useSettingValue('player.autoSwitchSource')
  const setAutoSwitchSource = (autoSwitchSource: boolean) => {
    updateSetting({ 'player.autoSwitchSource': autoSwitchSource })
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem check={autoSwitchSource} label={t('setting_player_auto_switch_source')} onChange={setAutoSwitchSource} />
    </View>
  )
})


const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
