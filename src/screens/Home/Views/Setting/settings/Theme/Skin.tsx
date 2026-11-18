import { memo, useMemo } from 'react'

import { StyleSheet, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { skins } from '@/skin'

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const skinId = useSettingValue('theme.skinId')

  const list = useMemo(() => {
    return skins.map((skin) => ({ id: skin.id, name: skin.name, description: skin.description }))
  }, [])

  return (
    <SubTitle title={t('setting_basic_theme_skin')}>
      <View style={styles.list}>
        {
          list.map(({ id, name, description }) => (
            <View key={id} style={styles.item}>
              <CheckBox
                marginRight={8}
                check={skinId == id}
                label={name}
                onChange={() => { updateSetting({ 'theme.skinId': id }) }}
                need
              />
              {
                description
                  ? <Text style={styles.desc} size={11} color={theme['c-font-label']}>{description}</Text>
                  : null
              }
            </View>
          ))
        }
      </View>
    </SubTitle>
  )
})

const styles = StyleSheet.create({
  list: {
    flexDirection: 'column',
  },
  item: {
    flexDirection: 'column',
    marginBottom: 10,
  },
  desc: {
    marginTop: 2,
    marginLeft: 26,
  },
})
