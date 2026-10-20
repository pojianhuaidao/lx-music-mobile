import { memo, useRef, useState } from 'react'
import { View } from 'react-native'

import CheckBoxItem from '../../components/CheckBoxItem'
import Popup, { type PopupType } from '@/components/common/Popup'
import Slider, { type SliderProps } from '@/components/common/Slider'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'

const OPACITY_MIN = 10
const OPACITY_MAX = 90

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const isGlassBg = useSettingValue('theme.glassBg')
  const glassOpacity = useSettingValue('theme.glassOpacity')
  const [popupVisible, setPopupVisible] = useState(false)
  const [sliderSize, setSliderSize] = useState(Math.round(glassOpacity * 100))
  const [isSliding, setSliding] = useState(false)
  const popupRef = useRef<PopupType>(null)

  const setGlassBg = (checked: boolean) => {
    updateSetting({ 'theme.glassBg': checked })
    if (!checked) return
    setSliderSize(Math.round(glassOpacity * 100))
    setPopupVisible(true)
    requestAnimationFrame(() => {
      popupRef.current?.setVisible(true)
    })
  }

  const handleSlidingStart: SliderProps['onSlidingStart'] = () => {
    setSliding(true)
  }
  const handleValueChange: SliderProps['onValueChange'] = value => {
    value = Math.trunc(value)
    setSliderSize(value)
    updateSetting({ 'theme.glassOpacity': value / 100 })
  }
  const handleSlidingComplete: SliderProps['onSlidingComplete'] = value => {
    setSliding(false)
    value = Math.trunc(value)
    updateSetting({ 'theme.glassOpacity': value / 100 })
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem
        check={isGlassBg}
        label={t('setting_basic_theme_glass_bg')}
        helpTitle={t('setting_basic_theme_glass_bg')}
        helpDesc={t('setting_basic_theme_glass_bg_tip')}
        onChange={setGlassBg} />
      {
        popupVisible
          ? (
              <Popup
                ref={popupRef}
                title={t('setting_basic_theme_glass_opacity')}
                onHide={() => { setPopupVisible(false) }}>
                <View style={styles.popupContent}>
                  <Text size={13} color={theme['c-font-label']}>{isSliding ? sliderSize : Math.round(glassOpacity * 100)}%</Text>
                  <Slider
                    minimumValue={OPACITY_MIN}
                    maximumValue={OPACITY_MAX}
                    step={1}
                    value={Math.round(glassOpacity * 100)}
                    onSlidingStart={handleSlidingStart}
                    onValueChange={handleValueChange}
                    onSlidingComplete={handleSlidingComplete} />
                </View>
              </Popup>
            )
          : null
      }
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
  popupContent: {
    paddingLeft: 25,
    paddingRight: 25,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
})
