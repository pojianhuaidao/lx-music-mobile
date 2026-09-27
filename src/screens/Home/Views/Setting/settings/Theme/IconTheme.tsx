import { memo, useMemo } from 'react'

import { StyleSheet, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'

const LIST = [
  {
    id: 'default',
    name: 'setting_basic_theme_icon_theme_default',
  },
  {
    id: 'tabler',
    name: 'setting_basic_theme_icon_theme_tabler',
  },
  {
    id: 'iconoir',
    name: 'setting_basic_theme_icon_theme_iconoir',
  },
] as const

const useActive = (id: LX.AppSetting['common.iconTheme']) => {
  const iconTheme = useSettingValue('common.iconTheme')
  const isActive = useMemo(() => iconTheme == id, [iconTheme, id])
  return isActive
}

const Item = ({ id, label }: {
  id: LX.AppSetting['common.iconTheme']
  label: string
}) => {
  const isActive = useActive(id)
  return <CheckBox marginRight={8} check={isActive} label={label} onChange={() => { updateSetting({ 'common.iconTheme': id }) }} need />
}

export default memo(() => {
  const t = useI18n()

  const list = useMemo(() => {
    return LIST.map((item) => ({ id: item.id, name: t(item.name) }))
  }, [t])

  return (
    <SubTitle title={t('setting_basic_theme_icon_theme')}>
      <View style={styles.list}>
        {
          list.map(({ id, name }) => <Item key={id} id={id} label={name} />)
        }
      </View>
    </SubTitle>
  )
})

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
