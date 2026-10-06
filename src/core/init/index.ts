import { initSetting, showPactModal } from '@/core/common'
import registerPlaybackService from '@/plugins/player/service'
import initTheme from './theme'
import initI18n from './i18n'
import initUserApi from './userApi'
import initPlayer from './player'
import dataInit from './dataInit'
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
 * - initPlayer/dataInit/initCommonState/initDownloadData/initLocalMusic 均不依赖音源；
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

/**
 * 下载模块后台初始化（首屏后注水）：加载下载列表/配置、兜底保存路径、同步配置到 store
 */
const initDownloadBackground = async(setting: LX.AppSetting) => {
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

  registerPlaybackService()
  bootLog('Playback Service Registered.')
  await initPlayer(setting)
  bootLog('Player inited.')
  await dataInit(setting)
  bootLog('Data inited.')
  await initCommonState(setting)
  bootLog('Common State inited.')

  // === 首屏前 critical path 完成，以下后台段注水（不阻塞 pushHomeScreen）===
  // 音源初始化 + apiSource 校验/设置：后续 init 段与首屏渲染均不依赖音源，
  // 搜索/取歌词/取图等音乐功能前有 global.lx.apiInitPromise 等待音源就绪，首屏提前显示后有兜底
  void initUserApiAndApiSource(setting)
  void initDownloadBackground(setting)
  void initLocalMusic()

  // syncSetting()

  isInited ||= true

  return handlePushedHomeScreen
}
