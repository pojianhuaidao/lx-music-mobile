import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import Input from '@/components/common/Input'
import CheckBox from '@/components/common/CheckBox'
import Modal from './ModalWrapper'
import { useLocalList } from '@/store/local'
import { useLocalFilterOptions } from '@/store/local/hook'
import { updateSetting } from '@/core/common'
import {
  LOCAL_FILTER_DEFAULTS,
  LOCAL_FILTER_EXTS,
  filterLocalMusics,
  formatDurationInput,
  formatDurationReadable,
  parseDurationInput,
  type LocalFilterDurationUnit,
} from '@/utils/localFilter'

export interface FilterModalType {
  show: () => void
  hide: () => void
}

const UNIT_LIST: Array<{ id: LocalFilterDurationUnit, labelKey: 'local_filter_unit_second' | 'local_filter_unit_minute' }> = [
  { id: 'second', labelKey: 'local_filter_unit_second' },
  { id: 'minute', labelKey: 'local_filter_unit_minute' },
]

export default forwardRef<FilterModalType, {}>((props, ref) => {
  const theme = useTheme()
  const t = useI18n()
  const list = useLocalList()
  const options = useLocalFilterOptions()

  const [visible, setVisible] = useState(false)
  const [unit, setUnit] = useState<LocalFilterDurationUnit>('second')
  const [minText, setMinText] = useState('')
  const [maxText, setMaxText] = useState('')

  useImperativeHandle(ref, () => ({
    show() {
      setMinText(formatDurationInput(options.minDuration, unit))
      setMaxText(formatDurationInput(options.maxDuration, unit))
      setVisible(true)
    },
    hide() {
      setVisible(false)
    },
  }), [options, unit])

  const handleClose = useCallback(() => {
    setVisible(false)
  }, [])

  // 过滤未启用时，按"若启用"的口径预览命中数量，便于用户判断条件是否过严
  const matchedCount = useMemo(() => {
    return filterLocalMusics(list, { ...options, enabled: true }).length
  }, [list, options])

  const minSeconds = parseDurationInput(minText, unit)
  const maxSeconds = parseDurationInput(maxText, unit)
  const minInvalid = minSeconds == null
  const maxInvalid = maxSeconds == null
  const rangeInvalid = !minInvalid && !maxInvalid && minSeconds > 0 && maxSeconds > 0 && minSeconds > maxSeconds

  // 用户一旦修改任一过滤条件，即视为"要过滤"，自动打开总开关（开关仍可手动关闭）
  const ensureEnabled = useCallback(() => {
    if (!options.enabled) updateSetting({ 'local.filter.enabled': true })
  }, [options.enabled])

  const commitDuration = useCallback((key: 'local.filter.minDuration' | 'local.filter.maxDuration', text: string) => {
    const seconds = parseDurationInput(text, unit)
    if (seconds == null) return
    ensureEnabled()
    if (key == 'local.filter.minDuration') updateSetting({ 'local.filter.minDuration': seconds })
    else updateSetting({ 'local.filter.maxDuration': seconds })
  }, [ensureEnabled, unit])

  const handleMinChange = useCallback((text: string) => {
    setMinText(text)
    commitDuration('local.filter.minDuration', text)
  }, [commitDuration])

  const handleMaxChange = useCallback((text: string) => {
    setMaxText(text)
    commitDuration('local.filter.maxDuration', text)
  }, [commitDuration])

  const handleUnitChange = useCallback((next: LocalFilterDurationUnit) => {
    if (next == unit) return
    const minValue = parseDurationInput(minText, unit) ?? 0
    const maxValue = parseDurationInput(maxText, unit) ?? 0
    setUnit(next)
    setMinText(formatDurationInput(minValue, next))
    setMaxText(formatDurationInput(maxValue, next))
  }, [minText, maxText, unit])

  const handleEnabledChange = useCallback((enabled: boolean) => {
    updateSetting({ 'local.filter.enabled': enabled })
  }, [])

  const handleOnlyDecodableChange = useCallback((onlyDecodable: boolean) => {
    if (onlyDecodable) ensureEnabled()
    updateSetting({ 'local.filter.onlyDecodable': onlyDecodable })
  }, [ensureEnabled])

  const handleToggleExt = useCallback((ext: string) => {
    const next = new Set(options.exts)
    if (next.has(ext)) next.delete(ext)
    else {
      next.add(ext)
      ensureEnabled()
    }
    updateSetting({ 'local.filter.exts': LOCAL_FILTER_EXTS.filter(item => next.has(item)).join(',') })
  }, [ensureEnabled, options.exts])

  const handleClearExts = useCallback(() => {
    updateSetting({ 'local.filter.exts': '' })
  }, [])

  const handleReset = useCallback(() => {
    updateSetting({
      'local.filter.minDuration': LOCAL_FILTER_DEFAULTS.minDuration,
      'local.filter.maxDuration': LOCAL_FILTER_DEFAULTS.maxDuration,
      'local.filter.exts': LOCAL_FILTER_DEFAULTS.exts,
      'local.filter.onlyDecodable': LOCAL_FILTER_DEFAULTS.onlyDecodable,
    })
    setMinText('')
    setMaxText('')
  }, [])

  const durationTip = useMemo(() => {
    const min = minSeconds && minSeconds > 0 ? formatDurationReadable(minSeconds) : ''
    const max = maxSeconds && maxSeconds > 0 ? formatDurationReadable(maxSeconds) : ''
    if (min && max) return t('local_filter_duration_range', { min, max })
    if (min) return t('local_filter_duration_min', { min })
    if (max) return t('local_filter_duration_max', { max })
    return ''
  }, [minSeconds, maxSeconds, t])

  return (
    <Modal visible={visible} onClose={handleClose}>
      <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
        <View style={styles.header}>
          <Text size={16} color={theme['c-font']}>{t('local_filter_title')}</Text>
          <Text size={12} color={theme['c-font-label']} style={styles.headerTip}>
            {t('local_filter_matched', { matched: matchedCount, total: list.length })}
          </Text>
        </View>
        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <CheckBox check={options.enabled} label={t('local_filter_enabled')} onChange={handleEnabledChange} />
            {options.enabled
              ? null
              : <Text size={11} color={theme['c-font-label']} style={styles.tip}>{t('local_filter_disabled_tip')}</Text>}
          </View>
          <View style={styles.section}>
            <Text size={13} color={theme['c-font']} style={styles.sectionTitle}>{t('local_filter_duration')}</Text>
            <View style={styles.row}>
              <Text size={13} color={theme['c-font-label']} style={styles.rowLabel}>{t('local_filter_min_duration')}</Text>
              <Input
                value={minText}
                onChangeText={handleMinChange}
                placeholder={t('local_filter_duration_placeholder')}
                keyboardType="numbers-and-punctuation"
                style={{ ...styles.input, backgroundColor: theme['c-primary-input-background'], color: minInvalid || rangeInvalid ? theme['c-primary'] : theme['c-font'] }}
              />
            </View>
            <View style={[styles.row, styles.rowGap]}>
              <Text size={13} color={theme['c-font-label']} style={styles.rowLabel}>{t('local_filter_max_duration')}</Text>
              <Input
                value={maxText}
                onChangeText={handleMaxChange}
                placeholder={t('local_filter_duration_placeholder')}
                keyboardType="numbers-and-punctuation"
                style={{ ...styles.input, backgroundColor: theme['c-primary-input-background'], color: maxInvalid || rangeInvalid ? theme['c-primary'] : theme['c-font'] }}
              />
            </View>
            <View style={styles.unitList}>
              {UNIT_LIST.map(item => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.7}
                  onPress={() => { handleUnitChange(item.id) }}
                  style={[styles.unit, { backgroundColor: unit == item.id ? theme['c-primary'] : theme['c-primary-background'] }]}
                >
                  <Text size={12} color={unit == item.id ? theme['c-font'] : theme['c-font-label']}>{t(item.labelKey)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text size={11} color={theme['c-font-label']} style={styles.tip}>{t('local_filter_duration_hint')}</Text>
            {durationTip ? <Text size={11} color={theme['c-font-label']} style={styles.tip}>{durationTip}</Text> : null}
            {rangeInvalid ? <Text size={11} color={theme['c-primary']} style={styles.tip}>{t('local_filter_duration_invalid')}</Text> : null}
          </View>
          <View style={styles.section}>
            <Text size={13} color={theme['c-font']} style={styles.sectionTitle}>{t('local_filter_format')}</Text>
            <View style={styles.optionList}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleClearExts}
                style={[styles.option, { backgroundColor: options.exts.length ? theme['c-primary-background'] : theme['c-primary'] }]}
              >
                <Text size={12} color={options.exts.length ? theme['c-font-label'] : theme['c-font']}>{t('local_filter_format_all')}</Text>
              </TouchableOpacity>
              {LOCAL_FILTER_EXTS.map(ext => {
                const active = options.exts.includes(ext)
                return (
                  <TouchableOpacity
                    key={ext}
                    activeOpacity={0.7}
                    onPress={() => { handleToggleExt(ext) }}
                    style={[styles.option, { backgroundColor: active ? theme['c-primary'] : theme['c-primary-background'] }]}
                  >
                    <Text size={12} color={active ? theme['c-font'] : theme['c-font-label']}>{ext}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <Text size={11} color={theme['c-font-label']} style={styles.tip}>{t('local_filter_format_hint')}</Text>
          </View>
          <View style={styles.section}>
            <CheckBox
              check={options.onlyDecodable}
              label={t('local_filter_only_decodable')}
              onChange={handleOnlyDecodableChange}
            />
            <Text size={11} color={theme['c-font-label']} style={styles.tip}>{t('local_filter_only_decodable_hint')}</Text>
          </View>
          <Text size={11} color={theme['c-font-label']} style={styles.tip}>{t('local_filter_scope_tip')}</Text>
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity activeOpacity={0.7} onPress={handleReset} style={styles.footerBtn}>
            <Text size={13} color={theme['c-font-label']}>{t('local_filter_reset')}</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={handleClose} style={styles.footerBtn}>
            <Text size={13} color={theme['c-primary']}>{t('close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
})


const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    minWidth: 300,
    maxWidth: 420,
    padding: 15,
  },
  header: {
    marginBottom: 12,
  },
  headerTip: {
    marginTop: 4,
  },
  body: {
    maxHeight: 380,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowGap: {
    marginTop: 8,
  },
  rowLabel: {
    width: 70,
  },
  input: {
    flexGrow: 1,
    borderRadius: 4,
    paddingLeft: 8,
    paddingRight: 8,
  },
  unitList: {
    flexDirection: 'row',
    marginTop: 8,
  },
  unit: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 8,
  },
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  tip: {
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  footerBtn: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
})
