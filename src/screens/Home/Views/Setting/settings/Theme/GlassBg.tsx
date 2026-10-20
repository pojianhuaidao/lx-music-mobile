import { memo, useState } from 'react'
import { View } from 'react-native'

import CheckBoxItem from '../../components/CheckBoxItem'
import Slider, { type SliderProps } from '@/components/common/Slider'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'

const OPACITY_MIN = 10
const OPACITY_MAX = 90
const DEFAULT_OPACITY = 0.55

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const isGlassBg = useSettingValue('theme.glassBg')
  const glassOpacity = useSettingValue('theme.glassOpacity')
  // 内嵌展开状态：开关开启时展开，关闭时收起；已开启状态下直接可见
  const [expanded, setExpanded] = useState(!!isGlassBg)
  // 本地 state 驱动滑块，拖动即时生效，不受 store 回读延迟影响
  const [sliderValue, setSliderValue] = useState(Math.round((glassOpacity ?? DEFAULT_OPACITY) * 100))

  const setGlassBg = (checked: boolean) => {
    updateSetting({ 'theme.glassBg': checked })
    setSliderValue(Math.round((glassOpacity ?? DEFAULT_OPACITY) * 100))
    setExpanded(checked)
  }

  const handleValueChange: SliderProps['onValueChange'] = value => {
    value = Math.trunc(value)
    setSliderValue(value)
    updateSetting({ 'theme.glassOpacity': value / 100 })
  }
  const handleSlidingComplete: SliderProps['onSlidingComplete'] = value => {
    value = Math.trunc(value)
    setSliderValue(value)
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
        isGlassBg && expanded
          ? (
              <View style={styles.sliderRow}>
                <Text size={13} color={theme['c-font-label']}>{sliderValue}%</Text>
                <Slider
                  minimumValue={OPACITY_MIN}
                  maximumValue={OPACITY_MAX}
                  step={1}
                  value={sliderValue}
                  onValueChange={handleValueChange}
                  onSlidingComplete={handleSlidingComplete} />
              </View>
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
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 4,
    paddingLeft: 15,
    paddingRight: 15,
    paddingBottom: 8,
  },
})
