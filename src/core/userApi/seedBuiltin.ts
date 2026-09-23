import { Platform } from 'react-native'
import { getData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import { addUserApis, getUserApiList } from '@/utils/data'
import { readAssetFile } from '@/utils/fs'

const MAX_USER_API = 20
const ASSET_DIR = 'lx-builtin-user-api'

const BUILTIN_USER_APIS = [
  { id: 'qdy', file: 'qdy.js', name: '全豆要[聚合音源]' },
  { id: 'ikun', file: 'ikun.js', name: 'ikun音源' },
  { id: 'juhe', file: 'juhe.js', name: '聚合API接口 (CF)' },
  { id: 'sixyin', file: 'sixyin.js', name: '六音音源' },
  { id: 'flower', file: 'flower.js', name: '野花🌷' },
  { id: 'grass', file: 'grass.js', name: '野草🌾' },
  { id: 'lx', file: 'lx.js', name: '[独家音源]' },
  { id: 'huibq', file: 'huibq.js', name: 'Huibq_lxmusic源' },
] as const

/**
 * 启动时注入 android/app/src/main/assets/lx-builtin-user-api/ 下的内置音源
 * - 已注入的音源 id 持久化于 storageDataPrefix.builtinUserApiSeed
 * - 用户手动删除某内置音源后，其 id 仍在 seeded 记录中，下次启动不再注入（防止“幽灵音源”复活）
 * - 原版默认音源（defaultMusicSources 机制）在调用本函数前已导入，两者共存
 */
export const seedBuiltinUserApis = async(): Promise<LX.UserApi.UserApiInfo[]> => {
  const list = await getUserApiList()
  if (Platform.OS !== 'android') return list

  const seeded = await getData<string[]>(storageDataPrefix.builtinUserApiSeed) ?? []
  const seededSet = new Set(seeded)
  const nextSeeded = [...seeded]
  let seededChanged = false

  // 仅处理未注入过、且未达上限的音源
  const pending = BUILTIN_USER_APIS.filter(item => !seededSet.has(item.id))
  const quota = Math.max(0, MAX_USER_API - list.length)
  const toSeed = pending.slice(0, quota)

  if (toSeed.length > 0) {
    // 并发读取 8 个资产脚本（并行 IO），再一次性批量写入，减少首启持久化 IPC 次数
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
      const infos = await addUserApis(scripts)
      // addUserApis 与 scripts 顺序对齐，失败项为 null（不标记 seeded，下次启动重试）
      for (let i = 0; i < infos.length; i++) {
        const info = infos[i]
        if (!info) {
          console.log('seed builtin user api failed', succeededItems[i].id)
          continue
        }
        list.push(info)
        nextSeeded.push(succeededItems[i].id)
        seededChanged = true
      }
    }
  }

  if (seededChanged) await saveData(storageDataPrefix.builtinUserApiSeed, nextSeeded)
  return list
}
