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

/**
 * 音源初始化 + apiSource 校验/设置（自 init 主链移出后独立执行）。
 * 依赖核实结论：
 * - initUserApi 仅与「apiSource 校验 / setApiSource」存在依赖，二者保持在其 resolve 后同步执行（时序与串行一致）；
 * - initPlayer/dataInit/initCommonState/initDownloadData/initLocalMusic/initSync 均不依赖音源；
 * - 搜索/取歌词/取图等音乐功能前均有 global.lx.apiInitPromise 等待音源就绪，首屏提前显示后操作有兜底。
 */
const initUserApiAndApiSource = async(setting: LX.AppSetting) => {
  try {
    await initUserApi(setting)
  } catch (error) {
    console.error('init user api failed', error)
  }
  let apiSource = setting['common.apiSource']
  if (!apiSource || !userApiState.list.some(api => api.id === apiSource)) {
    apiSource = userApiState.list[0]?.id ?? ''
  }
  setApiSource(apiSource)
  bootLog('Api inited.')
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

  // 音源初始化移出主串行链：首屏不再等待远程 fetch 与内置音源注入（依赖核实见 initUserApiAndApiSource）
  void initUserApiAndApiSource(setting)
  bootLog('User Api inited.')

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
