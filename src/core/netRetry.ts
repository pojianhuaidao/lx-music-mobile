import { AppState, DeviceEventEmitter } from 'react-native'
import { log } from '@/utils/log'

/**
 * 网络失败自动重试
 *
 * 场景：车机刚开机 ROM 网络未就绪（常见数十秒空档），此时所有联网请求都会失败。
 * 请求失败后登记一个退避重试任务（5s/10s/20s/30s/60s...），网络一旦恢复，
 * 重试成功即发出 NET_RETRY_SUCCESS_EVENT，界面监听后自动刷新，用户无需手动重试。
 */
export const NET_RETRY_SUCCESS_EVENT = 'lxNetRetrySuccess'

const DELAYS = [5000, 10000, 20000, 30000, 60000, 120000, 180000, 300000]

interface RetryTask {
  fn: () => Promise<boolean>
  attempt: number
  timer: ReturnType<typeof setTimeout> | null
  running: boolean
}

const tasks = new Map<string, RetryTask>()
let appStateListening = false

const schedule = (key: string) => {
  const task = tasks.get(key)
  if (!task) return
  const delay = DELAYS[Math.min(task.attempt, DELAYS.length - 1)]
  task.timer = setTimeout(() => {
    task.timer = null
    void run(key)
  }, delay)
}

const run = async(key: string) => {
  const task = tasks.get(key)
  if (!task || task.running) return
  task.running = true
  let ok = false
  try {
    ok = await task.fn()
  } catch (err: any) {
    log.error('netRetry task error:', key, err?.message)
    ok = false
  } finally {
    task.running = false
  }
  if (ok) {
    tasks.delete(key)
    DeviceEventEmitter.emit(NET_RETRY_SUCCESS_EVENT, key)
    return
  }
  const current = tasks.get(key)
  if (!current) return
  current.attempt++
  if (current.attempt >= DELAYS.length) {
    tasks.delete(key)
    return
  }
  schedule(key)
}

const listenAppState = () => {
  if (appStateListening) return
  appStateListening = true
  AppState.addEventListener('change', (state) => {
    if (state !== 'active' || !tasks.size) return
    // 回到前台（车机可能是从后台唤醒）立即把等待中的任务提前重试一次
    for (const key of [...tasks.keys()]) {
      const task = tasks.get(key)
      if (!task) continue
      if (task.timer) {
        clearTimeout(task.timer)
        task.timer = null
      }
      void run(key)
    }
  })
}

/**
 * 登记一个带退避的重试任务，fn 返回 true 表示网络已恢复、重试成功
 */
export const registerNetRetry = (key: string, fn: () => Promise<boolean>) => {
  if (tasks.has(key)) return
  tasks.set(key, { fn, attempt: 0, timer: null, running: false })
  listenAppState()
  schedule(key)
}

export const cancelNetRetry = (key: string) => {
  const task = tasks.get(key)
  if (!task) return
  if (task.timer) clearTimeout(task.timer)
  tasks.delete(key)
}

export const hasNetRetry = (key: string) => tasks.has(key)
