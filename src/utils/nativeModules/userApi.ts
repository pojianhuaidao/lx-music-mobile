import { NativeEventEmitter, NativeModules } from 'react-native'

const { UserApiModule } = NativeModules

let loadScriptInfo: LX.UserApi.UserApiInfo | null = null
export const loadScript = (info: LX.UserApi.UserApiInfo & { script: string }) => {
  loadScriptInfo = info
  UserApiModule.loadScript({
    id: info.id,
    name: info.name,
    description: info.description,
    version: info.version ?? '',
    author: info.author ?? '',
    homepage: info.homepage ?? '',
    script: info.script,
  })
}

export interface SendResponseParams {
  requestKey: string
  error: string | null
  response: {
    statusCode: number
    statusMessage: string
    headers: Record<string, string>
    body: any
  } | null
}
export interface SendActions {
  request: LX.UserApi.UserApiRequestParams
  response: SendResponseParams
}
export const sendAction = <T extends keyof SendActions>(action: T, data: SendActions[T]) => {
  UserApiModule.sendAction(action, JSON.stringify(data))
}

// export const clearAppCache = CacheModule.clearAppCache as () => Promise<void>

export interface InitParams {
  status: boolean
  errorMessage: string
  info: LX.UserApi.UserApiInfo
}

export interface ResponseParams {
  status: boolean
  errorMessage?: string
  requestKey: string
  result: any
}
export interface UpdateInfoParams {
  name: string
  log: string
  updateUrl: string
}
export interface RequestParams {
  requestKey: string
  url: string
  options: {
    method: string
    data: any
    timeout: number
    headers: any
    binary: boolean
  }
}
export type CancelRequestParams = string

export interface Actions {
  init: InitParams
  request: RequestParams
  cancelRequest: CancelRequestParams
  response: ResponseParams
  showUpdateAlert: UpdateInfoParams
  log: string
}
export type ActionsEvent = { [K in keyof Actions]: { action: K, data: Actions[K] } }[keyof Actions]

export const onScriptAction = (handler: (event: ActionsEvent) => void): () => void => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UserApiModule)
  const eventListener = eventEmitter.addListener('api-action', event => {
    // 本回调运行在原生事件同步栈内，任何未被捕获的异常都会直接升级为全局错误
    // （setJSExceptionHandler → isFatal=true → “Fatal: ...” 弹窗），而自定义音源属于
    // 第三方脚本，其回传数据与结构均不可信（非 JSON 文本如 "ok" / "[object Object]"、
    // HTML、被截断的分片，或 sources 结构异常）。因此这里统一做兜底隔离：
    // 解析或处理失败时只记录日志并丢弃该事件，降级为业务层的“加载失败”提示。
    try {
      if (event.data) {
        try {
          event.data = JSON.parse(event.data as string)
        } catch (err: any) {
          console.error('[userApi] api-action data parse failed:', event.action,
            String(event.data).slice(0, 300), err?.message)
          return
        }
      }
      if (event.action == 'init') {
        if (!event.data) return
        if (event.data.info) event.data.info = { ...loadScriptInfo, ...event.data.info }
        else event.data.info = { ...loadScriptInfo }
      } else if (event.action == 'showUpdateAlert') {
        if (!loadScriptInfo?.allowShowUpdateAlert) return
      }
      handler(event as ActionsEvent)
    } catch (err: any) {
      console.error('[userApi] api-action handle failed:', event.action, err?.message)
    }
  })

  return () => {
    eventListener.remove()
  }
}

export const destroy = () => {
  UserApiModule.destroy()
}
