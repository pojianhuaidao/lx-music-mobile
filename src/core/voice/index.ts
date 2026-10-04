/**
 * 车机语音搜歌：RN 原生模块（VoiceModule）的 JS 封装
 * - 生命周期：init / startListening / stopListening / setWakeWord / setSensitivity / destroy
 * - 事件：onWakeUp / onResult / onError / onState
 * - 命令解析：唤醒后文本匹配「播放/搜索/来一首/唱 + 歌名」→ musicSdk 搜索 → 播放第一结果
 */
import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native'

import { LIST_IDS } from '@/config/constant'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import settingActions from '@/store/setting/action'
import settingState from '@/store/setting/state'
import musicSdk from '@/utils/musicSdk'
import { toast } from '@/utils/tools'

import { parseVoiceCommand } from './commandParser'

const { VoiceModule } = NativeModules
const i18n = global.i18n

export type VoiceState = 0 | 1 | 2 // 0=待机 1=唤醒词监听中 2=指令识别中

let eventEmitter: NativeEventEmitter | null = null
let isSubscribed = false
let currentState: VoiceState = 0
let recognizeTimer: ReturnType<typeof setTimeout> | null = null
let resultHandler: ((text: string) => void) | null = null
let wakeUpHandler: (() => void) | null = null
let errorHandler: ((message: string) => void) | null = null
let stateHandler: ((state: VoiceState) => void) | null = null

const clearRecognizeTimer = () => {
  if (recognizeTimer) {
    clearTimeout(recognizeTimer)
    recognizeTimer = null
  }
}

/** 订阅原生事件（幂等，全局只订阅一次） */
export const subscribeVoiceEvents = () => {
  if (isSubscribed || !VoiceModule) return
  eventEmitter = new NativeEventEmitter(VoiceModule)
  eventEmitter.addListener('onWakeUp', () => {
    currentState = 2
    clearRecognizeTimer()
    // 兜底超时：原生引擎 6s 无稳定结果会自动回到待机，JS 侧同步清理
    recognizeTimer = setTimeout(() => {
      recognizeTimer = null
      if (currentState === 2) currentState = 1
      toast(i18n.t('voice_listening_notice_timeout'))
    }, 7000)
    wakeUpHandler?.()
  })
  eventEmitter.addListener('onResult', (data: { text: string }) => {
    clearRecognizeTimer()
    currentState = 1
    resultHandler?.((data && data.text) || '')
  })
  eventEmitter.addListener('onError', (data: { message: string }) => {
    currentState = 0
    errorHandler?.((data && data.message) || '')
  })
  eventEmitter.addListener('onState', (data: { state: number }) => {
    const state = (data && data.state) as VoiceState
    currentState = state
    if (state === 0 || state === 1) clearRecognizeTimer()
    stateHandler?.(state)
  })
  isSubscribed = true
}

const requestRecordPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: i18n.t('voice_permission_title'),
      message: i18n.t('voice_permission_message'),
      buttonPositive: i18n.t('confirm'),
      buttonNegative: i18n.t('cancel'),
    },
  )
  return granted === PermissionsAndroid.RESULTS.GRANTED
}

/** 播放语音识别到的歌曲 */
const playSearchResult = async (keyword: string) => {
  try {
    const source = (settingState.setting['common.apiSource'] as string) || 'kw'
    const sdkMap = musicSdk as Record<string, any>
    const sdk = sdkMap[source] && sdkMap[source].musicSearch ? sdkMap[source] : musicSdk.kw
    const list = await sdk.musicSearch.search(keyword, 1, 10)
    if (!list || !list.length) {
      toast(i18n.t('voice_not_found').replace('{keyword}', keyword))
      return
    }
    await setTempList(LIST_IDS.TEMP, list)
    await playList(LIST_IDS.TEMP, 0)
    toast(`${i18n.t('voice_playing')}：${list[0].title} - ${(list[0].singer || []).join('/')}`)
    // 播放后自动停止本次监听（车机场景避免误唤醒干扰播放）
    if (settingState.setting['voice.autoStopAfterPlay']) {
      setTimeout(() => {
        VoiceModule?.stopListening()
      }, 1500)
    }
  } catch (err) {
    toast(i18n.t('voice_search_failed'))
  }
}

/** 处理识别结果文本 */
export const handleVoiceResult = (text: string) => {
  const command = parseVoiceCommand(text)
  if (!command) {
    toast(i18n.t('voice_not_command'))
    return
  }
  void playSearchResult(command.keyword)
}

/** 初始化：根据设置启动或关闭语音服务 */
export const initVoice = async () => {
  subscribeVoiceEvents()
  if (!VoiceModule) return
  const enabled = settingState.setting['voice.enabled']
  const wakeWord = settingState.setting['voice.wakeWord'] || '你好小马'
  const sensitivity = settingState.setting['voice.sensitivity']
  if (!enabled) {
    await VoiceModule.init(false, wakeWord, sensitivity)
    return
  }
  const granted = await requestRecordPermission()
  if (!granted) {
    toast(i18n.t('voice_permission_denied'))
    await VoiceModule.init(false, wakeWord, sensitivity)
    return
  }
  await VoiceModule.init(true, wakeWord, sensitivity)
  resultHandler = (text) => handleVoiceResult(text)
  wakeUpHandler = () => toast(i18n.t('voice_wake_up'))
  stateHandler = null
  errorHandler = (message) => toast(i18n.t('voice_error') + (message ? `：${message}` : ''))
}

/** 开启/关闭语音服务（设置面板调用） */
export const setVoiceEnabled = async (enabled: boolean) => {
  if (!VoiceModule) return
  if (enabled) {
    const granted = await requestRecordPermission()
    if (!granted) {
      toast(i18n.t('voice_permission_denied'))
      settingActions.updateSetting({ 'voice.enabled': false } as Partial<LX.AppSetting>)
      return
    }
  }
  const wakeWord = settingState.setting['voice.wakeWord'] || '你好小马'
  const sensitivity = settingState.setting['voice.sensitivity']
  await VoiceModule.init(enabled, wakeWord, sensitivity)
  if (enabled) {
    resultHandler = (text) => handleVoiceResult(text)
    wakeUpHandler = () => toast(i18n.t('voice_wake_up'))
    errorHandler = (message) => toast(i18n.t('voice_error') + (message ? `：${message}` : ''))
  } else {
    resultHandler = null
    wakeUpHandler = null
    errorHandler = null
  }
}

/** 更新唤醒词（设置面板调用） */
export const setVoiceWakeWord = async (wakeWord: string) => {
  if (!VoiceModule) return
  await VoiceModule.setWakeWord(wakeWord)
}

/** 更新灵敏度（设置面板调用） */
export const setVoiceSensitivity = async (sensitivity: number) => {
  if (!VoiceModule) return
  await VoiceModule.setSensitivity(sensitivity)
}

/** 完全销毁语音服务 */
export const destroyVoice = async () => {
  clearRecognizeTimer()
  if (!VoiceModule) return
  await VoiceModule.destroy()
}

export const getVoiceState = () => currentState
