import { memo, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Button from '../../components/Button'
import Input from '@/components/common/Input'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { getData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import { toast } from '@/utils/tools'
import { log } from '@/utils/log'
import { useTheme } from '@/store/theme/hook'
import { buildExportData, importDataFromJson, type BackupSelectOptions } from './actions'
import { ensureBackupDir, downloadBackupData, uploadBackupData, type WebdavConfig } from './webdavClient'

const webdavConfigKey = storageDataPrefix.webdavConfig

interface WebdavProps {
  selectOptions: BackupSelectOptions
}

export default memo(({ selectOptions }: WebdavProps) => {
  const t = useI18n()
  const theme = useTheme()
  const [server, setServer] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [inited, setInited] = useState(false)
  if (!inited) {
    setInited(true)
    void getData<WebdavConfig | null>(webdavConfigKey).then(config => {
      if (config) {
        setServer(config.server ?? '')
        setUsername(config.username ?? '')
        setPassword(config.password ?? '')
      }
    })
  }

  const saveConfig = (patch: Partial<WebdavConfig>) => {
    void saveData(webdavConfigKey, { server, username, password, ...patch })
  }
  const getConfig = (): WebdavConfig => ({ server, username, password })
  const checkConfig = (): WebdavConfig | null => {
    const config = getConfig()
    if (!config.server.trim() || !config.username.trim() || !config.password.trim()) {
      toast(t('setting_backup_webdav_tip_empty'))
      return null
    }
    return config
  }

  const handleLogin = () => {
    const config = checkConfig()
    if (!config) return
    saveConfig({})
    toast(t('setting_backup_webdav_tip_logging_in'))
    void ensureBackupDir(config).then(() => {
      toast(t('setting_backup_webdav_tip_login_success'))
    }).catch((err: any) => {
      log.error(err)
      toast(t('setting_backup_webdav_tip_failed') + ': ' + (err.message as string))
    })
  }
  const handleExport = () => {
    const config = checkConfig()
    if (!config) return
    saveConfig({})
    toast(t('setting_backup_webdav_tip_exporting'))
    void buildExportData(selectOptions).then(async(data) => {
      await uploadBackupData(config, JSON.stringify(data))
      toast(t('setting_backup_webdav_tip_success'))
    }).catch((err: any) => {
      log.error(err)
      toast(t('setting_backup_webdav_tip_failed') + ': ' + (err.message as string))
    })
  }
  const handleImport = () => {
    const config = checkConfig()
    if (!config) return
    saveConfig({})
    toast(t('setting_backup_webdav_tip_importing'))
    void downloadBackupData(config).then(async(text) => {
      const configData = JSON.parse(text)
      await importDataFromJson(configData)
      toast(t('setting_backup_webdav_tip_success'))
    }).catch((err: any) => {
      log.error(err)
      toast(t('setting_backup_webdav_tip_failed') + ': ' + (err.message as string))
    })
  }

  return (
    <SubTitle title={t('setting_backup_webdav')}>
      <Text size={12} color={theme['c-500']} style={styles.desc}>{t('setting_backup_webdav_desc')}</Text>
      <View style={styles.content}>
        <View style={styles.inputItem}>
          <Text size={14} style={styles.label}>{t('setting_backup_webdav_server')}</Text>
          <Input value={server} onChangeText={text => { setServer(text); saveConfig({ server: text }) }} style={styles.input} placeholder={t('setting_backup_webdav_server')} />
        </View>
        <View style={styles.inputItem}>
          <Text size={14} style={styles.label}>{t('setting_backup_webdav_user')}</Text>
          <Input value={username} onChangeText={text => { setUsername(text); saveConfig({ username: text }) }} style={styles.input} placeholder={t('setting_backup_webdav_user')} />
        </View>
        <View style={styles.inputItem}>
          <Text size={14} style={styles.label}>{t('setting_backup_webdav_password')}</Text>
          <Input value={password} onChangeText={text => { setPassword(text); saveConfig({ password: text }) }} style={styles.input} placeholder={t('setting_backup_webdav_password')} secureTextEntry />
        </View>
        <View style={styles.list}>
          <Button onPress={handleLogin}>{t('setting_backup_webdav_login')}</Button>
          <Button onPress={handleImport}>{t('setting_backup_webdav_import')}</Button>
          <Button onPress={handleExport}>{t('setting_backup_webdav_export')}</Button>
        </View>
      </View>
    </SubTitle>
  )
})

const styles = StyleSheet.create({
  desc: {
    marginLeft: -10,
    marginBottom: 8,
  },
  content: {
    paddingLeft: 25,
  },
  inputItem: {
    paddingLeft: 25,
    marginBottom: 15,
  },
  label: {
    marginBottom: 2,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    flexGrow: 1,
    flexShrink: 1,
    borderRadius: 4,
    maxWidth: 300,
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
