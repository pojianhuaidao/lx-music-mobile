import { checkUpdate } from '@/utils/update'
import { showUpdateModal } from '@/navigation'
import { toast } from '@/utils/tools'
import { createI18n } from '@/lang'

let isUpdateChecked = false

// 启动后延迟检查 GitHub 新版本，避免影响首屏渲染；有新版本时弹出更新引导，失败时给出可见提示
export const initUpdateCheck = () => {
  if (isUpdateChecked) return
  isUpdateChecked = true
  setTimeout(async() => {
    try {
      const info = await checkUpdate()
      if (info) showUpdateModal(info)
      else console.log('[update] no new version')
    } catch (error) {
      console.error('检查更新失败', error)
      toast(createI18n().t('update_check_failed'))
    }
  }, 2000)
}
