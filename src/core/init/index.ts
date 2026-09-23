import { initSetting, showPactModal } from '@/core/common'
import registerPlaybackService from '@/plugins/player/service'
import initTheme from './theme'
import initI18n from './i18n'
import initUserApi from './userApi'
import initPlayer from './player'
import dataInit from './dataInit'
import initSync from './sync'
import initCommonState from './common'
import { initDeeplink } from './deeplink'
import { setApiSource } from '@/core/apiSource'
import commonActions from '@/store/common/action'
import settingState from '@/store/setting/state'
import { bootLog } from '@/utils/bootLog'
import { state as userApiState } from '@/store/userApi/state'
import { cheatTip } from '@/utils/tools'
import { initDownloadData } from '@/core/download'
import { downloadAction } from '@/store/download'
import { externalStorageDirectoryPath } from '@/utils/fs'
import { initLocalMusic } from './local'

let isFirstPush = true
const handlePushedHomeScreen = async() => {
  await cheatTip()
  if (settingState.setting['common.isAgreePact']) {
    if (isFirstPush) {
      isFirstPush = false
      void initDeeplink()
    }
  } else {
    if (isFirstPush) isFirstPush = false
    showPactModal()
  }
}

let isInited = false
export default async() => {
  if (isInited) return handlePushedHomeScreen
  bootLog('Initing...')
  commonActions.setFontSize(global.lx.fontSize)
  bootLog('Font size changed.')
  const setting = await initSetting()
  bootLog('Setting inited.')
  // console.log(setting)

  await initTheme(setting)
  bootLog('Theme inited.')
  await initI18n(setting)
  bootLog('I18n inited.')

  await initUserApi(setting)
  bootLog('User Api inited.')

  let apiSource = setting['common.apiSource']
  if (!apiSource || !userApiState.list.some(api => api.id === apiSource)) {
    apiSource = userApiState.list[0]?.id ?? ''
  }
  setApiSource(apiSource)
  bootLog('Api inited.')

  registerPlaybackService()
  bootLog('Playback Service Registered.')
  await initPlayer(setting)
  bootLog('Player inited.')
  await dataInit(setting)
  bootLog('Data inited.')
  await initCommonState(setting)
  bootLog('Common State inited.')

  // 初始化下载模块
  await initDownloadData()
  
  // 如果下载路径为空，使用默认路径
  if (!setting['download.savePath']) {
    const DEFAULT_SETTING = await import('@/config/defaultSetting')
    setting['download.savePath'] = DEFAULT_SETTING.default['download.savePath']
    bootLog(`Download path is empty, using default: ${setting['download.savePath']}`)
  }
  
  // 同步下载配置到store
  downloadAction.updateConfig({
    savePath: setting['download.savePath'],
    downloadQuality: setting['player.playQuality'],
    maxDownloadNum: setting['download.maxDownloadNum'],
    fileName: setting['download.fileName'],
  })
  bootLog('Download inited.')

  await initLocalMusic()
  bootLog('Local music inited.')

  void initSync(setting)
  bootLog('Sync inited.')

  // syncSetting()

  isInited ||= true

  return handlePushedHomeScreen
}
