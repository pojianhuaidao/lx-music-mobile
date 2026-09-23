import { Platform } from 'react-native'
import { getData, saveData, getDataMultiple } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import { addUserApis, getUserApiList } from '@/utils/data'
import { removeUserApi } from '../userApi'
import { readAssetFile } from '@/utils/fs'

const MAX_USER_API = 20
const ASSET_DIR = 'lx-builtin-user-api'

const BUILTIN_USER_APIS = [
  { id: 'qdy', file: 'qdy.js', name: '全豆要[聚合音源]' },
  { id: 'ikun', file: 'ikun.js', name: 'ikun音源' },
  { id: 'sixyin', file: 'sixyin.js', name: '六音音源' },
  { id: 'flower', file: 'flower.js', name: '野花🌷' },
  { id: 'grass', file: 'grass.js', name: '野草🌾' },
  { id: 'lx', file: 'lx.js', name: '[独家音源]' },
  { id: 'huibq', file: 'huibq.js', name: 'Huibq_lxmusic源' },
] as const

/**
 * 已移除的内置音源（id + 资产脚本 hash）。
 * 资产文件已删除，不再注入；但旧版升级设备上可能残留已注入项（其存储 id 为 user_api_xxx 随机 id，
 * 无法按内置固定 id 直接匹配），故启动时按「id 精确匹配」或「脚本内容 hash 匹配」清理残留，不误删用户自建源。
 */
const REMOVED_BUILTIN_USER_APIS = [
  { id: 'juhe', name: '聚合API接口 (CF)', hash: '6f788e66' },
] as const

/**
 * FNV-1a 32 位哈希（纯 JS，用于脚本内容一致性标识；非加密用途）。
 * 内置音源头部均无 @sourceUrl 元信息（UserApiInfo 类型亦无 sourceUrl 字段），
 * 故自动去重以「脚本内容 hash」为判据。
 */
const fnv1a32 = (input: string): string => {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16)
}

/**
 * 启动时注入 android/app/src/main/assets/lx-builtin-user-api/ 下的内置音源
 * - 已注入的音源 id 持久化于 storageDataPrefix.builtinUserApiSeed
 * - 用户手动删除某内置音源后，其 id 仍在 seeded 记录中，下次启动不再注入（防止“幽灵音源”复活）
 * - 原版默认音源（defaultMusicSources 机制）在调用本函数前已导入，两者共存
 * - 自动去重：注入前按脚本内容 hash 与已有 userApi 列表比对，存在同脚本项则跳过注入并标记 seeded，
 *   保证历史重复（升级前用户已手动添加的相同音源）不叠加、后续每次更新注入不产生重复
 */
export const seedBuiltinUserApis = async(): Promise<LX.UserApi.UserApiInfo[]> => {
  const list = await getUserApiList()
  if (Platform.OS !== 'android') return list

  // === 清理已移除内置源在旧版升级设备上的残留注入项 ===
  // 注入项存储 id 为 user_api_xxx 随机 id，无法按内置固定 id 直接匹配；
  // 以「id 精确匹配内置 id」或「脚本内容 hash 匹配已移除源」双判定，避免误删用户自建源
  const removedIds: string[] = []
  if (list.length > 0) {
    const datas = await getDataMultiple(list.map(item => `${storageDataPrefix.userApi}${item.id}`))
    for (let i = list.length - 1; i >= 0; i--) {
      const item = list[i]
      const script = datas[i]?.[1]
      const hit = REMOVED_BUILTIN_USER_APIS.find(r =>
        r.id === item.id || (typeof script === 'string' && r.hash === fnv1a32(script)),
      )
      if (hit) {
        removedIds.push(item.id)
        list.splice(i, 1)
      }
    }
  }
  if (removedIds.length > 0) {
    await removeUserApi(removedIds)
  }

  const seeded = await getData<string[]>(storageDataPrefix.builtinUserApiSeed) ?? []
  const seededSet = new Set(seeded)
  const nextSeeded = [...seeded]
  let seededChanged = false

  // 仅处理未注入过、且未达上限的音源
  const pending = BUILTIN_USER_APIS.filter(item => !seededSet.has(item.id))
  const quota = Math.max(0, MAX_USER_API - list.length)
  const toSeed = pending.slice(0, quota)

  if (toSeed.length > 0) {
    // 并发读取资产脚本（并行 IO），再一次性批量写入，减少首启持久化 IPC 次数
    const readResults = await Promise.allSettled(
      toSeed.map(item => readAssetFile(`${ASSET_DIR}/${item.file}`)),
    )
    const scripts: string[] = []
    const succeededItems: typeof toSeed = []
    for (let i = 0; i < toSeed.length; i++) {
      const r = readResults[i]
      if (r.status === 'fulfilled') {
        scripts.push(r.value)
        succeededItems.push(toSeed[i])
      } else {
        console.log('seed builtin user api failed', toSeed[i].id, r.reason)
      }
    }

    if (scripts.length > 0) {
      // === 自动去重：按脚本内容 hash 比对已有 userApi 列表 ===
      const builtinHashes = new Map<string, string>() // 内置源 id -> 脚本 hash
      for (let i = 0; i < succeededItems.length; i++) {
        builtinHashes.set(succeededItems[i].id, fnv1a32(scripts[i]))
      }
      const builtinDupIds = new Set<string>() // 与已有列表重复的内置源 id
      if (list.length > 0) {
        // 批量读取已注入项脚本（一次 multiGet，避免 N 次 IPC）
        const datas = await getDataMultiple(list.map(item => `${storageDataPrefix.userApi}${item.id}`))
        list.forEach((item, idx) => {
          const script = datas[idx]?.[1]
          if (typeof script !== 'string') return
          const h = fnv1a32(script)
          for (const [bid, bh] of builtinHashes) {
            if (bh === h) builtinDupIds.add(bid)
          }
        })
      }

      const finalScripts: string[] = []
      const finalItems: typeof succeededItems = []
      for (let i = 0; i < succeededItems.length; i++) {
        const item = succeededItems[i]
        if (builtinDupIds.has(item.id)) {
          // 已有同脚本项（用户自加或历史注入）：跳过注入避免重复，并标记 seeded 视为已处理
          nextSeeded.push(item.id)
          seededChanged = true
          console.log('seed builtin user api skipped (duplicate exists)', item.id)
        } else {
          finalScripts.push(scripts[i])
          finalItems.push(item)
        }
      }

      if (finalScripts.length > 0) {
        const infos = await addUserApis(finalScripts)
        // addUserApis 与 finalScripts 顺序对齐，失败项为 null（不标记 seeded，下次启动重试）
        for (let i = 0; i < infos.length; i++) {
          const info = infos[i]
          if (!info) {
            console.log('seed builtin user api failed', finalItems[i].id)
            continue
          }
          list.push(info)
          nextSeeded.push(finalItems[i].id)
          seededChanged = true
        }
      }
    }
  }

  if (seededChanged) await saveData(storageDataPrefix.builtinUserApiSeed, nextSeeded)
  return list
}
