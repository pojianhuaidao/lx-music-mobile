import { Platform } from 'react-native'
import { getData, saveData, getDataMultiple } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import { addUserApis, getUserApiList } from '@/utils/data'
import { removeUserApi } from '../userApi'
import { readAssetFile } from '@/utils/fs'

const MAX_USER_API = 40
const ASSET_DIR = 'lx-builtin-user-api'

/**
 * 内置音源注册表（2026-10-07 更新：集成 36 个用户音源）。
 * - qdy/sixyin/flower/grass 四个条目为同名替换：资产文件内容已更新为
 *   用户提供的最新版（全豆要[聚合音源]/六音音源/野花🌷/野草🌾），id/file 保持不变；
 * - 其余为新增注册（file 与 assets 文件名完全一致，含 emoji/×/括号/空格等特殊字符）；
 * - 同名（normalizeName 后）的内置条目视为重复：先注册者生效，后注册者由注入去重跳过。
 */
const BUILTIN_USER_APIS = [
  { id: 'qdy', file: 'qdy.js', name: '全豆要[聚合音源]' },
  { id: 'sixyin', file: 'sixyin.js', name: '六音音源' },
  { id: 'flower', file: 'flower.js', name: '野花🌷' },
  { id: 'grass', file: 'grass.js', name: '野草🌾' },
  { id: 'huibq', file: 'huibq.js', name: 'Huibq_lxmusic源' },
  { id: 'fish_music', file: 'fish_music.js', name: 'fish_music' },
  { id: 'gdstudio', file: 'gdstudio音乐源.js', name: 'gdstudio音乐源' },
  { id: 'ikun_hk', file: 'ikun音源（中国香港服务器).js', name: 'ikun音源（中国香港服务器)' },
  { id: 'index', file: 'index.js', name: 'index.js' },
  { id: 'kh_test', file: 'K×H测试.js', name: 'K×H测试' },
  { id: 'kuwo', file: 'KuwoDES.js', name: 'KuwoDES' },
  { id: 'lx', file: 'lx.js', name: 'lx.js' },
  { id: 'monster', file: 'monster🐱‍🐉.js', name: 'monster🐱‍🐉' },
  { id: 'djsy', file: '独家音源.js', name: '独家音源' },
  { id: 'feichangdao', file: '非常刀.js', name: '非常刀' },
  { id: 'juhe_cf', file: '聚合API接口 (CF).js', name: '聚合API接口 (CF)' },
  { id: 'juhe', file: '聚合API接口.js', name: '聚合API接口' },
  { id: 'hires', file: '聚合Hi-Res音乐音源v1.0.js', name: '聚合Hi-Res音乐音源v1.0' },
  { id: 'luoxue_music', file: '洛雪音乐源.js', name: '洛雪音乐源' },
  { id: 'luoxue1', file: '洛雪音源1.js', name: '星海音乐源' },
  { id: 'luoxue2', file: '洛雪音源2.js', name: '长青SVIP音源(二改修复版)' },
  { id: 'luoxue3', file: '洛雪音源3.js', name: '杰翔聚合音源' },
  { id: 'luoxue4', file: '洛雪音源4.js', name: '墨澜聚合音源' },
  { id: 'luoxue5', file: '洛雪音源5.js', name: '野草🌾' },
  { id: 'luoxue6', file: '洛雪音源6.js', name: 'K×H测试' },
  { id: 'luoxue7', file: '洛雪音源7.js', name: '野花🌷' },
  { id: 'luoxue8', file: '洛雪音源8.js', name: 'HYWmusic_beta_公益测试' },
  { id: 'luoxue9', file: '洛雪音源9.js', name: '聚合API接口 (CF)' },
  { id: 'luoxue10', file: '洛雪音源10.js', name: 'lx-玉宁熙-Pro' },
  { id: 'luoxue11', file: '洛雪音源11.js', name: '屿溪-终章' },
  { id: 'qdy2', file: '全豆要.js', name: '全豆要' },
  { id: 'collect_lx', file: '收集の聚合接口(LX版).js', name: '收集の聚合接口(LX版)' },
  { id: 'suyin', file: '溯音音源.js', name: '溯音音源' },
  { id: 'stable', file: '稳定版音源 v1.0.3.js', name: '稳定版音源 v1.0.3' },
  { id: 'wuming', file: '無名.js', name: '無名' },
  { id: 'xingkong', file: '星空源.js', name: '星空源' },
  { id: 'cloud', file: '云端音源(免费版).js', name: '云端音源(免费版)' },
] as const

/**
 * 已移除的内置音源（id + 资产脚本 hash + 展示名）。
 * 资产文件已删除，不再注入；但旧版升级设备上可能残留已注入项（其存储 id 为 user_api_xxx 随机 id，
 * 无法按内置固定 id 直接匹配），故启动时按「id 精确匹配」或「脚本内容 hash 匹配」或
 * 「name 归一化匹配（normalizeName）」清理残留：name 归一化可覆盖 hash 不同的网络默认源导入版
 * （如 juhe 网络版脚本内容与内置资产不一致），保证同类残留被彻底清除。
 * 2026-09-25 移除 lx（[独家音源]，即独家音源V4）与 ikun（ikun音源）：资产文件已删，
 * 旧版升级设备上的残留注入项（含用户已手动添加的同名网络版）按上述三判定一并清理。
 * 2026-10-07 用户重新集成 聚合API接口 (CF) / ikun音源（中国香港服务器) / 独家音源 / lx.js
 * 等音源，juhe/ikun/lx 三条已重新注册为内置源，故从本列表移除，避免启动时误清新注入项。
 */
type RemovedBuiltinUserApi = { id: string; name: string; hash: string }
const REMOVED_BUILTIN_USER_APIS: readonly RemovedBuiltinUserApi[] = []

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
 * 规范化音源名称：去除 emoji / 变体选择符 / 首尾空白，用于「同名即重复」判定。
 * 历史网络版（pdone flower/grass）与内置版的 @name 当前均带 emoji（野花🌷/野草🌾），
 * 但为防止历史版本 @name 存在变体（如无 emoji 的“野花”）导致同名清理失效，
 * 按规范化名称匹配，保证「不依赖网络版 name 与内置版完全一致」。
 */
const normalizeName = (s: string): string =>
  s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').trim()

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
  // 注入项存储 id 为 user_api_xxx 随机 id，无法按内置固定 id 直接匹配。
  // 历史「聚合API接口 (CF)」存在两条残留路径且均非内置固定 id：
  //   1) 旧版 seedBuiltin 内置注入版 —— 脚本内容与内置资产一致（hash 6f788e66）；
  //   2) 旧版 defaultMusicSources 网络默认源导入版 —— 脚本内容为 pdone juhe/latest.js
  //      （与内置资产内容不同，hash 不同），且 @name 同为「聚合API接口 (CF)」。
  // 故按「id 精确匹配 或 脚本 hash 匹配 或 name 归一化匹配」三判定清理：
  // name 归一化（normalizeName 去 emoji/空白）匹配已移除源名称的项全部删除，
  // 保证内置版/网络版、id 随机与否均被彻底清除；其余源不受影响。
  const removedIds: string[] = []
  if (list.length > 0) {
    const datas = await getDataMultiple(list.map(item => `${storageDataPrefix.userApi}${item.id}`))
    for (let i = list.length - 1; i >= 0; i--) {
      const item = list[i]
      const script = datas[i]?.[1]
      const hit = REMOVED_BUILTIN_USER_APIS.find(r =>
        r.id === item.id
        || (typeof script === 'string' && r.hash === fnv1a32(script))
        || normalizeName(item.name) === normalizeName(r.name),
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

  // === 同名重复清理（覆盖已 seeded 项） ===
  // 场景：defaultSources（pdone 网络版 flower/grass）与 seedBuiltin（内置版）双路径注入，
  // 列表内可能出现同 name 多份。按 name 分组，多份时保留与内置脚本 hash 一致项
  // （历史注入的内置版），删除其余（网络版/用户自建同名项），从源头消除「野花/野草重复」。
  // 清理失败不中断启动：若此处抛错，seedBuiltin 整体 reject 会导致 init 链中
  // setUserApiList(await seedBuiltinUserApis()) 不执行，UI 保留含重复的原始列表。
  try {
  if (list.length > 0) {
    const datas = await getDataMultiple(list.map(item => `${storageDataPrefix.userApi}${item.id}`))
    const listHashes = datas.map(d => (typeof d?.[1] === 'string' ? fnv1a32(d[1] as string) : ''))
    const matchedBuiltin = BUILTIN_USER_APIS.filter(item => list.some(li => normalizeName(li.name) === normalizeName(item.name)))
    if (matchedBuiltin.length > 0) {
      const assetResults = await Promise.allSettled(matchedBuiltin.map(item => readAssetFile(`${ASSET_DIR}/${item.file}`)))
      const builtinHashes = new Map<string, string>() // 内置源 id -> 资产脚本 hash
      for (let i = 0; i < matchedBuiltin.length; i++) {
        const r = assetResults[i]
        if (r.status === 'fulfilled') builtinHashes.set(matchedBuiltin[i].id, fnv1a32(r.value))
      }
      const removeIds: string[] = []
      const reseedIds: string[] = [] // 需取消 seeded 标记的内置 id（内容更新后重新注入新版）
      for (const item of matchedBuiltin) {
        const bh = builtinHashes.get(item.id)
        const matchedIdx: number[] = []
        for (let i = 0; i < list.length; i++) {
          if (normalizeName(list[i].name) === normalizeName(item.name)) matchedIdx.push(i)
        }
        if (matchedIdx.length === 0) continue
        const keepIdx = bh ? matchedIdx.find(i => listHashes[i] === bh) : undefined
        if (keepIdx !== undefined) {
          // 存在与当前资产 hash 一致项（新版已注入），删除其余同名旧项/网络版
          for (const idx of matchedIdx) {
            if (idx !== keepIdx) removeIds.push(list[idx].id)
          }
        } else {
          // 无与当前资产 hash 一致项：全部为旧版内容（内置源更新场景）或网络版同名项。
          // 按「同名即重复、以新文件为准」删除全部同名项，并取消该内置 id 的 seeded 标记，
          // 使其在下方注入流程中按最新资产重新注入。
          for (const idx of matchedIdx) removeIds.push(list[idx].id)
          if (bh && seededSet.has(item.id)) {
            reseedIds.push(item.id)
            seededSet.delete(item.id)
          }
        }
      }
      if (removeIds.length > 0) {
        console.log('seed builtin user api cleanup duplicates', removeIds)
        // removeUserApi 不得改动调用方传入数组；此处显式传副本并基于 Set 同步 list，
        // 避免因 removeIds 被破坏导致 UI 列表残留已删除项（存储已删、列表未同步的“幽灵重复”）
        const removedIdSet = new Set(removeIds)
        await removeUserApi([...removeIds])
        for (let i = list.length - 1; i >= 0; i--) {
          if (removedIdSet.has(list[i].id)) list.splice(i, 1)
        }
      }
      if (reseedIds.length > 0) {
        console.log('seed builtin user api reseed after update', reseedIds)
        seededChanged = true
      }
    }
  }
  } catch (err) {
    console.log('seed builtin user api cleanup duplicates failed', err)
  }

  // 仅处理未注入过、且未达上限的音源
  const pending = BUILTIN_USER_APIS.filter(item => !seededSet.has(item.id))

  if (pending.length > 0) {
    // 并发读取资产脚本（并行 IO），再一次性批量写入，减少首启持久化 IPC 次数
    const readResults = await Promise.allSettled(
      pending.map(item => readAssetFile(`${ASSET_DIR}/${item.file}`)),
    )
    const scripts: string[] = []
    const succeededItems: typeof pending = []
    for (let i = 0; i < pending.length; i++) {
      const r = readResults[i]
      if (r.status === 'fulfilled') {
        scripts.push(r.value)
        succeededItems.push(pending[i])
      } else {
        console.log('seed builtin user api failed', pending[i].id, r.reason)
      }
    }

    if (succeededItems.length > 0) {
      // === 注入前去重：按「脚本内容 hash」或「名称」比对已有 userApi 列表，跳过已存在项 ===
      // 双判据覆盖两条注入路径：defaultSources 网络版与内置版脚本内容可能不同（hash 不同），
      // 仅 hash 比对会漏判，故叠加 name 精确匹配（用户明确要求同名即视为重复）。
      const builtinHashes = new Map<string, string>() // 内置源 id -> 脚本 hash
      for (let i = 0; i < succeededItems.length; i++) {
        builtinHashes.set(succeededItems[i].id, fnv1a32(scripts[i]))
      }
      const builtinDupIds = new Set<string>() // 与已有列表重复（同 hash 或同 name）的内置源 id
      if (list.length > 0) {
        // 批量读取已注入项脚本（一次 multiGet，避免 N 次 IPC）
        const datas = await getDataMultiple(list.map(item => `${storageDataPrefix.userApi}${item.id}`))
        list.forEach((item, idx) => {
          const script = datas[idx]?.[1]
          const h = typeof script === 'string' ? fnv1a32(script) : ''
          for (const item2 of succeededItems) {
            const bh = builtinHashes.get(item2.id)!
            if ((h && h === bh) || item.name === item2.name) builtinDupIds.add(item2.id)
          }
        })
      }

      // 去重命中项标记 seeded，视为已处理，不再注入（防止“幽灵音源”复活）
      for (const id of builtinDupIds) {
        if (!seededSet.has(id)) {
          nextSeeded.push(id)
          seededChanged = true
        }
        console.log('seed builtin user api skipped (duplicate exists)', id)
      }

      // 剩余项注入（配额基于清理后的列表计算）
      const quota = Math.max(0, MAX_USER_API - list.length)
      const toInject: typeof succeededItems = []
      const toInjectScripts: string[] = []
      for (let i = 0; i < succeededItems.length; i++) {
        const item = succeededItems[i]
        if (builtinDupIds.has(item.id)) continue
        if (toInject.length >= quota) break
        toInject.push(item)
        toInjectScripts.push(scripts[i])
      }
      if (toInject.length > 0) {
        const infos = await addUserApis(toInjectScripts)
        // addUserApis 与 toInjectScripts 顺序对齐，失败项为 null（不标记 seeded，下次启动重试）
        for (let i = 0; i < infos.length; i++) {
          const info = infos[i]
          if (!info) {
            console.log('seed builtin user api failed', toInject[i].id)
            continue
          }
          list.push(info)
          nextSeeded.push(toInject[i].id)
          seededChanged = true
        }
      }
    }
  }

  if (seededChanged) await saveData(storageDataPrefix.builtinUserApiSeed, nextSeeded)
  return list
}
