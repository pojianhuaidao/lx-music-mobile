import { memo, useMemo } from 'react'

import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { isFFmpegAvailableSync, isFFmpegPlatformSupported } from '@/core/localFFmpeg'

const useActive = (id: LX.AppSetting['local.decodeKernel']) => {
  const kernel = useSettingValue('local.decodeKernel')
  return useMemo(() => (kernel ?? 'auto') == id, [kernel, id])
}

const Item = ({ id, name }: {
  id: LX.AppSetting['local.decodeKernel']
  name: string
}) => {
  const isActive = useActive(id)
  return (
    <CheckBox
      marginBottom={8}
      check={isActive}
      label={name}
      onChange={() => { updateSetting({ 'local.decodeKernel': id }) }}
      need
    />
  )
}

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const kernel = useSettingValue('local.decodeKernel')

  // 内核实测可用性：仅在 auto 模式下提示，避免误导用户
  const unavailableReason = useMemo(() => {
    if ((kernel ?? 'auto') != 'auto') return ''
    if (!isFFmpegPlatformSupported()) return t('local_ffmpeg_unsupported_platform')
    if (!isFFmpegAvailableSync()) return t('local_ffmpeg_unavailable')
    return ''
  }, [kernel, t])

  return (
    <SubTitle title={t('setting_play_local_decode_kernel')}>
      <View style={styles.list}>
        <Item id="auto" name={t('local_decode_kernel_auto')} />
        <Item id="system" name={t('local_decode_kernel_system')} />
      </View>
      <Text size={12} color={theme['c-500']} style={styles.tip}>{t('local_decode_kernel_tip')}</Text>
      {unavailableReason ? <Text size={12} color={theme['c-500']} style={styles.tip}>{unavailableReason}</Text> : null}
    </SubTitle>
  )
})

const styles = createStyle({
  list: {
    marginTop: 5,
  },
  tip: {
    marginTop: 2,
  },
})
