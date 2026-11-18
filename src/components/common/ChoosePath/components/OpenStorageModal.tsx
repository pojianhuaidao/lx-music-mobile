import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { View } from 'react-native'
import Input, { type InputType } from '@/components/common/Input'
import Text from '@/components/common/Text'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import { createStyle, toast } from '@/utils/tools'
import { stat } from '@/utils/fs'
import { useTheme } from '@/store/theme/hook'
import { getOpenStoragePath, saveOpenStoragePath } from '@/utils/data'
import Button from '@/components/common/Button'
import type { PathItem } from './ListItem'
const filterFileName = /[\\:*?#"<>|]/


interface PathInputType {
  setPath: (text: string) => void
  getText: () => string
  focus: () => void
}
const PathInput = forwardRef<PathInputType, {}>((props, ref) => {
  const theme = useTheme()
  const [text, setText] = useState('')
  const inputRef = useRef<InputType>(null)

  useImperativeHandle(ref, () => ({
    getText() {
      return text.trim()
    },
    setPath(text) {
      setText(text)
    },
    focus() {
      inputRef.current?.focus()
    },
  }))

  return (
    <Input
      ref={inputRef}
      placeholder={global.i18n.t('open_storage_tip')}
      value={text}
      onChangeText={setText}
      multiline
      numberOfLines={3}
      textAlignVertical='top'
      style={{ ...styles.input, backgroundColor: theme['c-primary-input-background'] }}
    />
  )
})

export interface OpenDirModalType {
  show: (paths: string[]) => void
}
export default forwardRef<OpenDirModalType, { onOpenDir: (dir: string) => Promise<PathItem[]> }>(({
  onOpenDir,
}, ref) => {
  const confirmAlertRef = useRef<ConfirmAlertType>(null)
  const inputRef = useRef<PathInputType>(null)
  const [paths, setPaths] = useState<string[]>([])

  useImperativeHandle(ref, () => ({
    show(paths) {
      setPaths(paths)
      // 已移除 SAF 授权目录（getManagedFolders）入口，存储路径只通过手动输入或内置浏览定位
      confirmAlertRef.current?.setVisible(true)
      requestAnimationFrame(() => {
        void getOpenStoragePath().then(path => {
          if (path) inputRef.current?.setPath(path)
        })
      })
    },
  }))

  // const handleHideAlert = () => {
  //   inputRef.current?.setPath('')
  // }
  const handleConfirmAlert = async() => {
    const text = inputRef.current?.getText() ?? ''
    if (text) {
      // 统一只接受可读的绝对文件路径，不再支持 content:// (SAF) URI
      if (!text.startsWith('/') || filterFileName.test(text)) {
        toast(global.i18n.t('open_storage_error_tip'), 'long')
        return
      }
      try {
        if (!(await stat(text)).canRead) {
          toast('Permission denied', 'long')
          return
        }
      } catch (err: any) {
        toast('Open failed: ' + err.message, 'long')
        return
      }
      void onOpenDir(text)
    }
    void saveOpenStoragePath(text)
    confirmAlertRef.current?.setVisible(false)
  }

  return (
    <ConfirmAlert
      onConfirm={handleConfirmAlert}
      ref={confirmAlertRef}
    >
      <View style={styles.newFolderContent} onStartShouldSetResponder={() => true}>
        <Text style={styles.newFolderTitle}>
          {
            paths.length > 1
              ? global.i18n.t('open_storage_title')
              : global.i18n.t('open_storage_not_found_title')
          }
        </Text>
        <PathInput ref={inputRef} />
        <View style={styles.list}>
          {
            paths.map(path => {
              return (
                <Button style={styles.pathBtn} key={path} onPress={() => inputRef.current?.setPath(path)}>
                  <Text size={12}>{path}</Text>
                </Button>
              )
            })
          }
        </View>
        <View style={styles.tips}>
          <Text style={styles.tip} size={12}>
            {global.i18n.t('open_storage_tip')}
          </Text>
        </View>
      </View>
    </ConfirmAlert>
  )
})

const styles = createStyle({
  newFolderContent: {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'column',
  },
  newFolderTitle: {
    marginBottom: 5,
    width: 300,
    maxWidth: '100%',
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 240,
    borderRadius: 4,
    paddingTop: 3,
    paddingBottom: 3,
    height: 'auto',
  },
  list: {
    flexGrow: 1,
    flexShrink: 1,
    marginVertical: 10,
  },
  listContentItem: {
    paddingVertical: 10,
    flexDirection: 'row',
  },
  pathBtn: {
    paddingHorizontal: 5,
    paddingVertical: 10,
    flex: 1,
  },
  removeBtn: {
    flex: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  tips: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
  },
  tip: {
    flex: 1,
  },
  btn: {
    // alignSelf: 'flex-end',
    flex: 0,
  },
})

