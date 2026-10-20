import { memo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Navigation } from 'react-native-navigation'

import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import ModalContent from './ModalContent'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { temporaryDirectoryPath } from '@/utils/fs'
import { downloadUpdateApk, installUpdateApk, type UpdateInfo } from '@/utils/update'

const UPDATE_FILE = `${temporaryDirectoryPath}/lx-music-mobile-update.apk`

interface Props {
  componentId: string
  info: UpdateInfo
}

type Phase = 'idle' | 'downloading' | 'downloaded' | 'error'

const formatSize = (bytes: number) => {
  if (!bytes) return ''
  const mb = bytes / 1024 / 1024
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`
}

export default memo(({ componentId, info }: Props) => {
  const theme = useTheme()
  const t = useI18n()
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)

  const dismiss = () => {
    void Navigation.dismissOverlay(componentId)
  }

  const handleDownload = async() => {
    setPhase('downloading')
    setProgress(0)
    try {
      await downloadUpdateApk(info.downloadUrl, UPDATE_FILE, (received, total) => {
        if (total > 0) setProgress(received / total)
      })
      setPhase('downloaded')
    } catch (error) {
      console.error('下载更新失败', error)
      setPhase('error')
    }
  }

  const handleInstall = () => {
    dismiss()
    setTimeout(() => {
      void installUpdateApk(UPDATE_FILE).catch(error => {
        console.error('安装更新失败', error)
      })
    }, 300)
  }

  const sizeText = formatSize(info.assetSize)

  return (
    <ModalContent>
      <Text style={styles.title} size={18}>{t('update_modal_title')} v{info.version}</Text>
      <ScrollView style={styles.content} keyboardShouldPersistTaps={'always'}>
        {
          info.notes
            ? <Text selectable style={styles.text}>{info.notes}</Text>
            : <Text style={styles.text}>{t('update_modal_no_notes')}</Text>
        }
      </ScrollView>
      <View style={styles.btns}>
        {
          phase === 'downloading'
            ? (
                <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }}>
                  <Text color={theme['c-button-font']}>{t('update_modal_downloading')} {Math.round(progress * 100)}%</Text>
                </Button>
              )
            : phase === 'downloaded'
              ? (
                  <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleInstall}>
                    <Text color={theme['c-button-font']}>{t('update_modal_install')}</Text>
                  </Button>
                )
              : (
                  <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleDownload}>
                    <Text color={theme['c-button-font']}>{t('update_modal_download')}{sizeText ? `（${sizeText}）` : ''}</Text>
                  </Button>
                )
        }
        <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={dismiss}>
          <Text color={theme['c-button-font']}>{phase === 'error' ? t('update_modal_close') : t('update_modal_close')}</Text>
        </Button>
      </View>
      {
        phase === 'error'
          ? <Text style={styles.errorText} size={12}>{t('update_modal_failed')}</Text>
          : null
      }
    </ModalContent>
  )
})

const styles = createStyle({
  content: {
    flexGrow: 0,
    marginLeft: 5,
    marginRight: 5,
    paddingLeft: 10,
    paddingRight: 10,
    maxHeight: 300,
  },
  title: {
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 15,
  },
  text: {
    fontSize: 13,
    textAlignVertical: 'bottom',
    marginBottom: 5,
  },
  errorText: {
    textAlign: 'center',
    paddingBottom: 8,
  },
  btns: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 15,
    paddingBottom: 15,
    paddingLeft: 15,
  },
  btn: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 10,
    paddingRight: 10,
    alignItems: 'center',
    borderRadius: 4,
    marginRight: 15,
  },
})
