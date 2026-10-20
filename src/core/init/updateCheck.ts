import AsyncStorage from '@react-native-async-storage/async-storage'
import { checkUpdate } from '@/utils/update'
import { showUpdateModal } from '@/navigation'
import { toast } from '@/utils/tools'
import { createI18n } from '@/lang'

let isUpdateChecked = false

// 记录上次成功检查日期的持久化键，实现"每天最多检查一次"
const LAST_CHECK_DATE_KEY = 'update:lastCheckDate'

const getToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 启动后延迟检查 GitHub 新版本，避免影响首屏渲染；同一天内最多检查一次（次日首次启动再检查），
// 有新版本时弹出更新引导，失败时给出可见提示（失败不记录日期，下次启动仍会重试）
export const initUpdateCheck = () => {
  if (isUpdateChecked) return
  isUpdateChecked = true
  setTimeout(async() => {
    try {
      const today = getToday()
      if ((await AsyncStorage.getItem(LAST_CHECK_DATE_KEY)) === today) {
        console.log('[update] already checked today, skip')
        return
      }
      const info = await checkUpdate()
      await AsyncStorage.setItem(LAST_CHECK_DATE_KEY, today)
      if (info) showUpdateModal(info)
      else console.log('[update] no new version')
    } catch (error) {
      console.error('检查更新失败', error)
      toast(createI18n().t('update_check_failed'))
    }
  }, 2000)
}
