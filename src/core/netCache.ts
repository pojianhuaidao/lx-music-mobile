import { getData, removeDataMultiple, saveDataMultiple } from '@/plugins/storage'
import { log } from '@/utils/log'

/**
 * 联网数据磁盘缓存（离线兜底）
 *
 * 背景：车机开机后 ROM 需要数十秒才拉起网络，期间应用发起的歌单/排行榜等请求
 * 必然失败，界面直接显示"联网失败"。这里把每次成功的联网结果写入磁盘，
 * 请求失败且无内存缓存时回退到磁盘数据，让界面先显示上次的内容，
 * 等网络恢复后由 netRetry 自动重新拉取并更新界面。
 */
const KEY_PREFIX = '@net_cache__'
const INDEX_KEY = '@net_cache__index__'
const MAX_ENTRIES = 60
const MAX_AGE = 7 * 24 * 60 * 60 * 1000

interface IndexItem { k: string, t: number }

let index: IndexItem[] | null = null
let loadingIndex: Promise<IndexItem[]> | null = null

const pendingSave = new Map<string, any>()
let persistTimer: ReturnType<typeof setTimeout> | null = null
let indexSaveTimer: ReturnType<typeof setTimeout> | null = null

const ensureIndex = async(): Promise<IndexItem[]> => {
  if (index) return index
  if (!loadingIndex) {
    loadingIndex = getData<IndexItem[]>(INDEX_KEY).then((data) => {
      index = Array.isArray(data)
        ? data.filter(item => item && typeof item.k === 'string' && typeof item.t === 'number')
        : []
      return index
    }).catch((err: any) => {
      log.error('netCache read index error:', err?.message)
      index = []
      return index
    }).finally(() => {
      loadingIndex = null
    })
  }
  return loadingIndex
}

const persistIndex = () => {
  indexSaveTimer = null
  if (!index) return
  void saveDataMultiple([[INDEX_KEY, index]]).catch((err: any) => {
    log.error('netCache save index error:', err?.message)
  })
}

const flushData = () => {
  persistTimer = null
  if (!pendingSave.size) return
  const datas: Array<[string, any]> = []
  for (const [key, value] of pendingSave) datas.push([`${KEY_PREFIX}${key}`, value])
  pendingSave.clear()
  void saveDataMultiple(datas).catch((err: any) => {
    log.error('netCache save data error:', err?.message)
  })
}

const touchIndex = async(key: string) => {
  const list = await ensureIndex()
  const rest = list.filter(item => item.k !== key)
  rest.unshift({ k: key, t: Date.now() })
  const removed = rest.splice(MAX_ENTRIES)
  index = rest
  if (indexSaveTimer) clearTimeout(indexSaveTimer)
  indexSaveTimer = setTimeout(persistIndex, 500)
  if (removed.length) {
    void removeDataMultiple(removed.map(item => `${KEY_PREFIX}${item.k}`)).catch(() => {})
  }
}

/**
 * 写入磁盘缓存（异步、批量合并落盘，不阻塞调用方）
 */
export const saveNetCache = (key: string, data: any) => {
  if (data == null) return
  pendingSave.set(key, data)
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(flushData, 300)
  void touchIndex(key)
}

/**
 * 读取磁盘缓存，返回数据与写入时间；未命中返回 null
 */
export const getNetCache = async<T = unknown>(key: string): Promise<{ data: T, time: number } | null> => {
  try {
    const list = await ensureIndex()
    const item = list.find(entry => entry.k === key)
    if (!item) return null
    if (Date.now() - item.t > MAX_AGE) return null
    const data = await getData<T>(`${KEY_PREFIX}${key}`)
    if (data == null) return null
    return { data, time: item.t }
  } catch (err: any) {
    log.error('netCache read data error:', key, err?.message)
    return null
  }
}

export const clearNetCache = async() => {
  const list = await ensureIndex()
  index = []
  if (indexSaveTimer) clearTimeout(indexSaveTimer)
  if (persistTimer) clearTimeout(persistTimer)
  pendingSave.clear()
  try {
    await removeDataMultiple([...list.map(item => `${KEY_PREFIX}${item.k}`), INDEX_KEY])
  } catch (err: any) {
    log.error('netCache clear error:', err?.message)
  }
}
