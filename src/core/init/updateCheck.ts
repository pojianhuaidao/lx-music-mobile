import { checkUpdate } from '@/utils/update'
import { showUpdateModal } from '@/navigation'

let isUpdateChecked = false

// 启动后延迟检查 GitHub 新版本，避免影响首屏渲染；有新版本时弹出更新引导
export const initUpdateCheck = () => {
  if (isUpdateChecked) return
  isUpdateChecked = true
  setTimeout(async() => {
    try {
      const info = await checkUpdate()
      if (info) showUpdateModal(info)
    } catch (error) {
      console.error('检查更新失败', error)
    }
  }, 2000)
}
