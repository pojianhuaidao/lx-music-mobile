import { useState, useRef, forwardRef, useImperativeHandle } from 'react'
// import { StyleSheet, View, Text, StatusBar, ScrollView } from 'react-native'

// import { useGetter, useDispatch } from '@/store'
import List, { type ListType } from './List'

import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import { toast, checkStoragePermissions, requestStoragePermission } from '@/utils/tools'
import { useI18n } from '@/lang'

export interface ReadOptions {
  title: string
  isPersist?: boolean
  dirOnly?: boolean
  filter?: string[]
}
const initReadOptions = {}

interface ChoosePathProps {
  onConfirm: (path: string) => void
}

export interface ChoosePathType {
  show: (options: ReadOptions) => void
}

export default forwardRef<ChoosePathType, ChoosePathProps>(({
  onConfirm = () => {},
}: ChoosePathProps, ref) => {
  const t = useI18n()
  const listRef = useRef<ListType>(null)
  const confirmAlertRef = useRef<ConfirmAlertType>(null)
  const [deny, setDeny] = useState(false)
  const readOptions = useRef<ReadOptions>(initReadOptions as ReadOptions)

  const handleOpenExternalStorage = async(options: ReadOptions) => {
    return checkStoragePermissions().then(isGranted => {
      readOptions.current = options
      if (isGranted) {
        listRef.current?.show(options.title, '', options.dirOnly, options.filter)
      } else {
        confirmAlertRef.current?.setVisible(true)
      }
    })
  }

  useImperativeHandle(ref, () => ({
    show(options) {
      // 统一走内置文件浏览器（List）：系统文件选择器（SAF openDocument）在车机上
      // 常常选不到外部存储里的文件、或返回 content:// 后无法读取，因此移除该分支，
      // 导入音源、本地音频目录选择等所有场景都只保留内置浏览器。
      void handleOpenExternalStorage(options)
    },
  }))

  const handleTipsCancel = () => {
    toast(t('disagree_tip'), 'long')
  }
  const handleTipsConfirm = () => {
    confirmAlertRef.current?.setVisible(false)
    void requestStoragePermission().then(result => {
      // console.log(result)
      setDeny(result == null)
      if (result) {
        listRef.current?.show(readOptions.current.title, '', readOptions.current.dirOnly, readOptions.current.filter)
      } else {
        toast(t('storage_permission_tip_disagree'), 'long')
      }
    })
  }
  const onPathConfirm = (path: string) => {
    listRef.current?.hide()
    onConfirm(path)
  }

  return (
    <>
      <List ref={listRef} onConfirm={onPathConfirm} />
      <ConfirmAlert
        ref={confirmAlertRef}
        onCancel={handleTipsCancel}
        onConfirm={handleTipsConfirm}
        bgHide={false}
        closeBtn={false}
        showConfirm={!deny}
        cancelText={t('disagree')}
        confirmText={t('agree')}
        text={t(deny ? 'storage_permission_tip_disagree_ask_again' : 'storage_permission_tip_request')} />
    </>
  )
})
