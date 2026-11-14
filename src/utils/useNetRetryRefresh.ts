import { useEffect, useRef } from 'react'
import { DeviceEventEmitter } from 'react-native'
import { NET_RETRY_SUCCESS_EVENT } from '@/core/netRetry'

/**
 * 监听网络恢复（netRetry 重试成功）事件，命中指定 key 前缀时触发界面重新加载。
 *
 * 典型场景：车机开机后 ROM 网络尚未就绪，歌单/排行榜首屏请求失败并展示了
 * “网络连接失败”；网络可用后 netRetry 自动重试成功，这里通知界面静默刷新，
 * 用户无需手动点重试。
 *
 * @param keyPrefixes 需要关注的缓存 key 前缀，如 ['slist__', 'tags__']
 * @param handler 命中后的回调（一般传入页面自身的刷新方法）
 */
export const useNetRetryRefresh = (keyPrefixes: string[], handler: () => void) => {
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  const prefixesRef = useRef(keyPrefixes)
  prefixesRef.current = keyPrefixes

  useEffect(() => {
    const listener = DeviceEventEmitter.addListener(NET_RETRY_SUCCESS_EVENT, (key: string) => {
      if (typeof key !== 'string') return
      if (!prefixesRef.current.some(prefix => key.startsWith(prefix))) return
      handlerRef.current()
    })
    return () => {
      listener.remove()
    }
  }, [])
}
