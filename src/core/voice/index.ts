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
import { toNewMusicInfo } from '@/utils'
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
    // musicSdk 各源的 search() 统一返回 { list, total, allPage, limit, source } 对象，
    // 不能把返回值当数组直接判断 length，否则任何关键词都会误判为空列表
    const res = await sdk.musicSearch.search(keyword, 1, 10)
    // musicSearch 返回的是旧版歌曲结构（songmid/img/types，无 meta 字段），
    // 直接入库播放会因读取 musicInfo.meta.picUrl 抛 "Cannot read property 'picUrl' of undefined"，
    // 与主搜索一致转换为带 meta 的新 MusicInfo 结构后再写入临时列表
    const list = ((res && res.list) || []).map((s: any) => toNewMusicInfo(s) as LX.Music.MusicInfoOnline)
    if (!list.length) {
      toast(i18n.t('voice_not_found').replace('{keyword}', keyword))
      return
    }
    await setTempList(LIST_IDS.TEMP, list)
    await playList(LIST_IDS.TEMP, 0)
    const first = list[0]
    const singer = Array.isArray(first.singer) ? first.singer.join('/') : (first.singer || '')
    toast(`${i18n.t('voice_playing')}：${first.name || ''}${singer ? ` - ${singer}` : ''}`)
    // 播放后自动停止本次监听（车机场景避免误唤醒干扰播放）
    // 注意：stopListening 触发原生 stopListening -> releaseStreams/releaseAudioRecord，
    // 与采集线程的 sherpa-onnx 调用存在并发窗口（原生层已做 try-catch 防御）；
    // 这里也兜底捕获桥接异常，避免 JS 未捕获异常逃逸到全局。
    if (settingState.setting['voice.autoStopAfterPlay']) {
      setTimeout(() => {
        try {
          VoiceModule?.stopListening()
        } catch (err) {
          console.error('[voice] stopListening failed', err)
        }
      }, 1500)
    }
  } catch (err) {
    // 透传失败链路（音源 / 识别关键词 / 底层错误消息），便于区分网络、音源接口、参数问题
    const source = (settingState.setting['common.apiSource'] as string) || 'kw'
    const errMsg = err instanceof Error ? err.message : String(err ?? 'unknown')
    console.error(`[voice] playSearchResult failed: source=${source}, keyword=${keyword}`, err)
    toast(`${i18n.t('voice_search_failed')}：${source} | ${errMsg.slice(0, 100)}`)
  }
}

/** 处理识别结果文本 */
export const handleVoiceResult = (text: string) => {
  const command = parseVoiceCommand(text)
  if (!command) {
    if (settingState.setting['voice.wakeWordFree']) {
      // 免唤醒模式：环境音/闲聊等非命令文本静默忽略，不打扰用户
      return
    }
    toast(i18n.t('voice_not_command'))
    return
  }
  void playSearchResult(command.keyword)
}

/** 初始化：根据设置启动或关闭语音服务 */
export const initVoice = async () => {
  try {
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
    await VoiceModule.setWakeWordFree(!!settingState.setting['voice.wakeWordFree'])
    resultHandler = (text) => handleVoiceResult(text)
    wakeUpHandler = () => toast(i18n.t('voice_wake_up'))
    stateHandler = null
    errorHandler = (message) => toast(i18n.t('voice_error') + (message ? `：${message}` : ''))
  } catch (err) {
    // 原生 init 桥接异常（如引擎/服务不可用）时兜底：不外抛避免触发 RN 红屏，
    // 只提示一次错误；引擎是否可用由原生 onError 事件驱动，不在此处重试或继续调用。
    console.error('[voice] init failed', err)
    toast(i18n.t('voice_error'))
  }
}

/** 开启/关闭语音服务（设置面板调用） */
export const setVoiceEnabled = async (enabled: boolean) => {
  try {
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
      await VoiceModule.setWakeWordFree(!!settingState.setting['voice.wakeWordFree'])
      resultHandler = (text) => handleVoiceResult(text)
      wakeUpHandler = () => toast(i18n.t('voice_wake_up'))
      errorHandler = (message) => toast(i18n.t('voice_error') + (message ? `：${message}` : ''))
    } else {
      resultHandler = null
      wakeUpHandler = null
      errorHandler = null
    }
  } catch (err) {
    // 同上：桥接异常兜底，不外抛避免红屏
    console.error('[voice] setVoiceEnabled failed', err)
    toast(i18n.t('voice_error'))
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

/** 更新免唤醒开关（设置面板调用，运行时即时生效） */
export const setVoiceWakeWordFree = async (wakeWordFree: boolean) => {
  if (!VoiceModule) return
  await VoiceModule.setWakeWordFree(!!wakeWordFree)
}

/** 完全销毁语音服务 */
export const destroyVoice = async () => {
  clearRecognizeTimer()
  if (!VoiceModule) return
  await VoiceModule.destroy()
}

export const getVoiceState = () => currentState
