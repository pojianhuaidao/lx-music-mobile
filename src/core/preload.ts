import { AppState } from 'react-native'
import { getSongListSetting } from '@/utils/data'
import { log } from '@/utils/log'
import { getList, getTags } from './songlist'
import { getBoardsList } from './leaderboard'

/**
 * 离线缓存预加载
 *
 * 车机场景：熄火关机后，下次开机 ROM 需要几十秒才把网络拉起，这段时间内
 * 歌单、排行榜等联网页面都会请求失败。这里在 App 进入后台（用户熄火/切走，
 * 也就是“关闭前”）主动把首屏需要的数据再拉一次并落盘，下次开机即使完全没网
 * 也能立刻用缓存渲染，网络恢复后再由 netRetry 自动刷新成最新数据。
 */

const PRELOAD_INTERVAL = 5 * 60 * 1000
// 启动后延迟一段时间再预取，避免与首屏自身请求抢带宽
const STARTUP_PRELOAD_DELAY = 8000

let lastPreloadTime = 0
let isPreloading = false
let isStarted = false

export const preloadOfflineCache = async(force = false) => {
  if (isPreloading) return
  const now = Date.now()
  if (!force && now - lastPreloadTime < PRELOAD_INTERVAL) return
  isPreloading = true
  try {
    const info = await getSongListSetting()
    // 单个任务失败不影响其它任务；成功的会自动写入磁盘缓存
    await Promise.allSettled([
      getTags(info.source),
      getList(info.source, info.tagId, info.sortId, 1),
      getBoardsList(info.source),
    ])
    lastPreloadTime = Date.now()
    log.info('[preload] offline cache refreshed')
  } catch (err: any) {
    log.warn('[preload] offline cache refresh failed:', err?.message)
  } finally {
    isPreloading = false
  }
}

export const startOfflinePreload = () => {
  if (isStarted) return
  isStarted = true

  // 启动后预取一次，保证磁盘缓存与上次使用状态一致
  setTimeout(() => {
    void preloadOfflineCache(true)
  }, STARTUP_PRELOAD_DELAY)

  // 进入后台（熄火/切走/关屏）时预取，为下次开机准备离线缓存
  AppState.addEventListener('change', (state) => {
    if (state !== 'background' && state !== 'inactive') return
    void preloadOfflineCache()
  })

  // 车机熄火可能直接断电，后台预取来不及完成；
  // 因此在前台保持周期性预取，让磁盘缓存始终接近最新，断电也能兜住。
  setInterval(() => {
    if (AppState.currentState !== 'active') return
    void preloadOfflineCache()
  }, PRELOAD_INTERVAL)
}
