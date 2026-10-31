import AsyncStorage from '@react-native-async-storage/async-storage'
import { log } from '@/utils/log'

const partKeyPrefix = '@___PART___'
const partKeyArrPrefix = '@___PART_A___'
const partKeyPrefixRxp = /^@___PART___/
const partKeyArrPrefixRxp = /^@___PART_A___/
const keySplit = ','
const limit = 500000

const buildData = (key: string, value: any, datas: Array<[string, string]>) => {
  let valueStr = JSON.stringify(value)
  if (valueStr.length <= limit) {
    datas.push([key, valueStr])
    return
  }

  const partKeys = []
  for (let i = 0, len = Math.floor(valueStr.length / limit); i <= len; i++) {
    let partKey = `${partKeyArrPrefix}${key}${i}`
    partKeys.push(partKey)
    datas.push([partKey, valueStr.substring(i * limit, (i + 1) * limit)])
  }
  datas.push([key, partKeyArrPrefix + JSON.stringify(partKeys)])
}

/**
 * 安全 JSON 解析：解析失败不抛错，记录日志并返回 null；由调用方决定是否移除损坏 key。
 */
const safeJSONParse = <T = unknown>(value: string): T | null => {
  try {
    return JSON.parse(value) as T
  } catch (e: any) {
    log.error('storage error[JSON.parse]:', e.message)
    return null
  }
}

// 1.4.0 之前的数据分片存储方式，存在key的内容与分隔符冲突的问题
// 1.4.0 开始改用数组存储，不再使用分隔符的方式
const handleGetDataOld = async<T>(partKeys: string): Promise<T | null> => {
  const keys = partKeys.replace(partKeyPrefixRxp, '').split(keySplit)

  return AsyncStorage.multiGet(keys).then(datas => {
    const data = safeJSONParse<T>(datas.map(data => data[1]).join(''))
    if (data == null) {
      // 分片内容损坏，移除主 key 与全部分片自愈
      void AsyncStorage.multiRemove([...keys, partKeys]).catch(() => {})
      return null
    }
    return data
  })
}

const handleGetData = async<T>(partKeys: string): Promise<T | null> => {
  if (partKeys.startsWith(partKeyPrefix)) return handleGetDataOld<T>(partKeys)

  const keys = safeJSONParse<string[]>(partKeys.replace(partKeyArrPrefixRxp, ''))
  if (keys == null) {
    // 损坏的 partKey 列表，移除主 key 自愈
    void AsyncStorage.removeItem(partKeys).catch(() => {})
    return null
  }
  return AsyncStorage.multiGet(keys).then(datas => {
    const data = safeJSONParse<T>(datas.map(data => data[1]).join(''))
    if (data == null) {
      // 分片内容损坏，移除主 key 与全部分片自愈
      void AsyncStorage.multiRemove([...keys, partKeys]).catch(() => {})
      return null
    }
    return data
  })
}

export const saveData = async(key: string, value: any) => {
  const datas: Array<[string, string]> = []
  buildData(key, value, datas)

  try {
    await removeData(key)
    await AsyncStorage.multiSet(datas)
  } catch (e: any) {
    // saving error
    log.error('storage error[saveData]:', key, e.message)
    throw e
  }
}

export const getData = async<T = unknown>(key: string): Promise<T | null> => {
  let value: string | null
  try {
    value = await AsyncStorage.getItem(key)
  } catch (e: any) {
    // error reading value
    log.error('storage error[getData]:', key, e.message)
    throw e
  }
  if (value && (partKeyPrefixRxp.test(value) || partKeyArrPrefixRxp.test(value))) {
    return handleGetData<T>(value)
  } else if (value == null) return value
  const data = safeJSONParse<T>(value)
  if (data == null) {
    // 存储值损坏，移除 key 自愈，避免 JSON.parse 抛错升级为全局异常
    void AsyncStorage.removeItem(key).catch(() => {})
    return null
  }
  return data
}

export const removeData = async(key: string) => {
  let value: string | null
  try {
    value = await AsyncStorage.getItem(key)
  } catch (e: any) {
    // error reading value
    log.error('storage error[removeData]:', key, e.message)
    throw e
  }
  if (value) {
    if (partKeyPrefixRxp.test(value)) {
      let partKeys = value.replace(partKeyPrefixRxp, '').split(keySplit)
      partKeys.push(key)
      try {
        await AsyncStorage.multiRemove(partKeys)
      } catch (e: any) {
        // remove error
        log.error('storage error[removeData]:', key, e.message)
        throw e
      }
      return
    } else if (partKeyArrPrefixRxp.test(value)) {
      let partKeys = safeJSONParse<string[]>(value.replace(partKeyArrPrefixRxp, ''))
      if (partKeys == null) {
        // 损坏的 partKey 列表：仅删除主 key，避免 JSON.parse 抛错
        try {
          await AsyncStorage.removeItem(key)
        } catch (e: any) {
          log.error('storage error[removeData]:', key, e.message)
          throw e
        }
        return
      }
      partKeys.push(key)
      try {
        await AsyncStorage.multiRemove(partKeys)
      } catch (e: any) {
        // remove error
        log.error('storage error[removeData]:', key, e.message)
        throw e
      }
      return
    }
  }

  try {
    await AsyncStorage.removeItem(key)
  } catch (e: any) {
    // remove error
    log.error('storage error[removeData]:', key, e.message)
    throw e
  }
}

export const getAllKeys = async() => {
  let keys
  try {
    keys = await AsyncStorage.getAllKeys()
  } catch (e: any) {
    // read key error
    log.error('storage error[getAllKeys]:', e.message)
    throw e
  }

  return keys
}


export const getDataMultiple = async<T extends readonly string[]>(keys: T) => {
  type RawData = { [K in keyof T]: [T[K], string | null] }
  let datas: RawData
  try {
    datas = await AsyncStorage.multiGet(keys) as RawData
  } catch (e: any) {
    // read error
    log.error('storage error[getDataMultiple]:', e.message)
    throw e
  }
  const promises: Array<Promise<unknown>> = []
  for (const [key, value] of datas) {
    if (value && (partKeyPrefixRxp.test(value) || partKeyArrPrefixRxp.test(value))) {
      promises.push(handleGetData(value).then(v => v ?? null))
    } else if (value == null) {
      promises.push(Promise.resolve(null))
    } else {
      const data = safeJSONParse(value)
      if (data == null) {
        // 存储值损坏，移除 key 自愈
        void AsyncStorage.removeItem(key).catch(() => {})
        promises.push(Promise.resolve(null))
      } else {
        promises.push(Promise.resolve(data))
      }
    }
  }
  return Promise.all(promises).then(values => {
    return datas.map(([key], index) => ([key, values[index]])) as { [K in keyof T]: [T[K], unknown] }
  })
}

export const saveDataMultiple = async(datas: Array<[string, any]>) => {
  const allData: Array<[string, string]> = []
  for (const [key, value] of datas) {
    buildData(key, value, allData)
  }
  try {
    await removeDataMultiple(datas.map(k => k[0]))
    await AsyncStorage.multiSet(allData)
  } catch (e: any) {
    // save error
    log.error('storage error[saveDataMultiple]:', e.message)
    throw e
  }
}


export const removeDataMultiple = async(keys: string[]) => {
  if (!keys.length) return
  const datas = await AsyncStorage.multiGet(keys)
  let allKeys = []
  for (const [key, value] of datas) {
    allKeys.push(key)
    if (value) {
      if (partKeyPrefixRxp.test(value)) {
        allKeys.push(...value.replace(partKeyPrefixRxp, '').split(keySplit))
      } else if (partKeyArrPrefixRxp.test(value)) {
        const partKeys = safeJSONParse<string[]>(value.replace(partKeyArrPrefixRxp, ''))
        // 损坏的 partKey 列表：跳过分片，仅删除主 key
        if (partKeys != null) allKeys.push(...partKeys)
      }
    }
  }
  try {
    await AsyncStorage.multiRemove(allKeys)
  } catch (e: any) {
    // remove error
    log.error('storage error[removeDataMultiple]:', e.message)
    throw e
  }
}

export const clearAll = async() => {
  try {
    await AsyncStorage.clear()
  } catch (e: any) {
    // clear error
    log.error('storage error[clearAll]:', e.message)
    throw e
  }
}

