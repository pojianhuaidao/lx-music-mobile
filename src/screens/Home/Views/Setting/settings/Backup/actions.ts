import { LIST_IDS, storageDataPrefix } from '@/config/constant'
import defaultSetting from '@/config/defaultSetting'
import { createList, getListMusics, overwriteList, overwriteListFull, overwriteListMusics } from '@/core/list'
import { filterMusicList, fixNewMusicInfoQuality, toNewMusicInfo } from '@/utils'
import { log } from '@/utils/log'
import { confirmDialog, handleReadFile, handleSaveFile, showImportTip, toast } from '@/utils/tools'
import listState from '@/store/list/state'
import settingState from '@/store/setting/state'
import { saveData } from '@/plugins/storage'
import { getLocalMusicList, getUserApiList, getUserApiScript, saveLocalMusicList } from '@/utils/data'
import { importUserApi, removeUserApi } from '@/core/userApi'
import { getTheme } from '@/theme/themes'
import { applyTheme } from '@/core/theme'

export interface BackupSelectOptions {
  playList: boolean
  localMusicList: boolean
  userApi: boolean
  setting: boolean
}

const getAllLists = async() => {
  const lists = []
  lists.push(await getListMusics(listState.defaultList.id).then(musics => ({ ...listState.defaultList, list: musics })))
  lists.push(await getListMusics(listState.loveList.id).then(musics => ({ ...listState.loveList, list: musics })))

  for await (const list of listState.userList) {
    lists.push(await getListMusics(list.id).then(musics => ({ ...list, list: musics })))
  }

  return lists
}
const importOldListData = async(lists: any[]) => {
  const allLists = await getAllLists()
  for (const list of lists) {
    try {
      const targetList = allLists.find(l => l.id == list.id)
      if (targetList) {
        targetList.list = filterMusicList((list.list as any[]).map(m => toNewMusicInfo(m)))
      } else {
        const listInfo = {
          name: list.name,
          id: list.id,
          list: filterMusicList((list.list as any[]).map(m => toNewMusicInfo(m))),
          source: list.source,
          sourceListId: list.sourceListId,
          locationUpdateTime: list.locationUpdateTime ?? null,
        }
        allLists.push(listInfo as LX.List.UserListInfoFull)
      }
    } catch (err) {
      console.log(err)
    }
  }
  const defaultList = allLists.shift()!.list
  const loveList = allLists.shift()!.list
  await overwriteListFull({ defaultList, loveList, userList: allLists as LX.List.UserListInfoFull[] })
}
const importNewListData = async(lists: Array<LX.List.MyDefaultListInfoFull | LX.List.MyLoveListInfoFull | LX.List.UserListInfoFull>) => {
  const allLists = await getAllLists()
  for (const list of lists) {
    try {
      const targetList = allLists.find(l => l.id == list.id)
      if (targetList) {
        targetList.list = filterMusicList(list.list).map(m => fixNewMusicInfoQuality(m))
      } else {
        const data = {
          name: list.name,
          id: list.id,
          list: filterMusicList(list.list).map(m => fixNewMusicInfoQuality(m)),
          source: (list as LX.List.UserListInfoFull).source,
          sourceListId: (list as LX.List.UserListInfoFull).sourceListId,
          locationUpdateTime: (list as LX.List.UserListInfoFull).locationUpdateTime ?? null,
        }
        allLists.push(data as LX.List.UserListInfoFull)
      }
    } catch (err) {
      console.log(err)
    }
  }
  const defaultList = allLists.shift()!.list
  const loveList = allLists.shift()!.list
  await overwriteListFull({ defaultList, loveList, userList: allLists as LX.List.UserListInfoFull[] })
}

/**
 * 导入单个列表
 * @param listData
 * @param position
 * @returns
 */
export const handleImportListPart = async(listData: LX.ConfigFile.MyListInfoPart['data'], position: number = listState.userList.length) => {
  const targetList = listState.allList.find(l => l.id === listData.id)
  if (targetList) {
    const confirm = await confirmDialog({
      message: global.i18n.t('list_import_part_confirm', { importName: listData.name, localName: targetList.name }),
      cancelButtonText: global.i18n.t('list_import_part_button_cancel'),
      confirmButtonText: global.i18n.t('list_import_part_button_confirm'),
      bgClose: false,
    })
    if (confirm) {
      listData.name = targetList.name
      void overwriteList(listData).then(() => {
        toast(global.i18n.t('setting_backup_part_import_list_tip_success'))
      }).catch((err) => {
        log.error(err)
        toast(global.i18n.t('setting_backup_part_import_list_tip_error'))
      })
      return
    }
    listData.id += `__${Date.now()}`
  }
  const userList = listData as LX.List.UserListInfoFull
  void createList({
    name: userList.name,
    id: userList.id,
    list: userList.list,
    source: userList.source,
    sourceListId: userList.sourceListId,
    position: Math.max(position, -1),
  }).then(() => {
    toast(global.i18n.t('setting_backup_part_import_list_tip_success'))
  }).catch((err) => {
    log.error(err)
    toast(global.i18n.t('setting_backup_part_import_list_tip_error'))
  })
}

/**
 * 收集音源信息（含脚本内容）
 */
const getUserApisWithScript = async() => {
  const list = await getUserApiList()
  const result: Array<LX.UserApi.UserApiInfo & { script?: string }> = []
  for (const api of list) {
    try {
      const script = await getUserApiScript(api.id)
      result.push({ ...api, script })
    } catch (err) {
      log.error(err)
    }
  }
  return result
}

/**
 * 按勾选组装备份数据：
 * - 仅勾选播放列表时保持 playList_v2 兼容桌面版备份文件
 * - 勾选其它数据时导出 allData_v3（按字段可选）
 */
export const buildExportData = async(options: BackupSelectOptions): Promise<any> => {
  if (!options.playList && !options.localMusicList && !options.userApi && !options.setting) {
    throw new Error(global.i18n.t('setting_backup_part_export_empty_tip'))
  }
  if (options.playList && !options.localMusicList && !options.userApi && !options.setting) {
    return { type: 'playList_v2', data: await getAllLists() }
  }
  const data: any = {}
  if (options.playList) data.lists = await getAllLists()
  if (options.localMusicList) data.localMusicList = await getLocalMusicList()
  if (options.userApi) data.userApis = await getUserApisWithScript()
  if (options.setting) data.setting = JSON.parse(JSON.stringify({ ...settingState.setting }))
  return { type: 'allData_v3', data }
}

/**
 * 完全替换全部列表数据（默认/喜欢/用户列表）
 * 直接以备份列表为唯一数据源调用 overwriteListFull 全量覆盖：
 * 本地多余的列表会被删除，不保留备份中不存在的列表
 */
const replaceAllListData = async(lists: Array<LX.List.MyDefaultListInfoFull | LX.List.MyLoveListInfoFull | LX.List.UserListInfoFull>) => {
  const defaultList = filterMusicList(lists[0]?.list ?? []).map(m => fixNewMusicInfoQuality(m))
  const loveList = filterMusicList(lists[1]?.list ?? []).map(m => fixNewMusicInfoQuality(m))
  const userList = lists.slice(2).map((list) => {
    const l = list as LX.List.UserListInfoFull
    return {
      name: l.name,
      id: l.id,
      list: filterMusicList(l.list).map(m => fixNewMusicInfoQuality(m)),
      source: l.source,
      sourceListId: l.sourceListId,
      locationUpdateTime: l.locationUpdateTime ?? null,
    } as LX.List.UserListInfoFull
  })
  await overwriteListFull({ defaultList, loveList, userList })
}

/**
 * 完全替换设置：以默认设置为基底、备份设置整体覆盖（本地多余键不残留），
 * 写入内存（settingState.setting）并持久化（@setting_v1），
 * 通过 configUpdated 全键事件刷新依赖设置的模块
 *
 * 主题偏好例外：备份数据不覆盖用户当前主题（common.isAutoTheme 与 theme.* 系列键），
 * 避免恢复备份后"跟随系统"开关被旧备份值静默关闭/主题被固化；
 * 其余设置仍按完全替换语义覆盖
 */
const restoreSetting = async(settingData: Partial<LX.AppSetting>) => {
  const backupSetting = Object.fromEntries(
    Object.entries(settingData).filter(([key]) => key !== 'common.isAutoTheme' && !key.startsWith('theme.')),
  ) as Partial<LX.AppSetting>
  const merged = {
    ...JSON.parse(JSON.stringify(defaultSetting)),
    ...JSON.parse(JSON.stringify(backupSetting)),
    version: defaultSetting.version,
  } as LX.AppSetting
  settingState.setting = merged
  await saveData(storageDataPrefix.setting, merged)
  global.state_event.configUpdated(Object.keys(backupSetting) as Array<keyof LX.AppSetting>, backupSetting)
  // 恢复完成后主动重新应用主题，确保跟随系统/当前主题即时刷新
  void getTheme().then(applyTheme)
}

/**
 * 恢复 allData_v3 数据（完全替换语义）
 */
const restoreV3Data = async(data: any) => {
  if (data.lists) await replaceAllListData(data.lists)
  if (data.localMusicList) await saveLocalMusicList(data.localMusicList)
  if (data.userApis) {
    // 完全替换音源：清空当前全部音源（含已注入的内置源）后，整体导入备份音源
    const currentList = await getUserApiList()
    if (currentList.length) await removeUserApi(currentList.map(api => api.id))
    for (const api of data.userApis) {
      if (!api.script) continue
      try {
        await importUserApi(api.script)
      } catch (err) {
        log.error(err)
      }
    }
    // 重置内置源 seed 记录：若不重置，重启时 seedBuiltin 会因 seed 残留而跳过内置源注入，
    // 导致内置源（野花/野草等）在清空后永久丢失。重置后重启会按需重新注入内置源；
    // 若备份中已含同脚本内置源，seedBuiltin 注入前会按 hash 去重跳过，不会重复注入或顶掉备份源。
    await saveData(storageDataPrefix.builtinUserApiSeed, [])
  }
  if (data.setting) await restoreSetting(data.setting)
}

const importData = async(path: string) => {
  let configData: any
  try {
    configData = await handleReadFile(path)
  } catch (error: any) {
    log.error(error.stack)
    throw error
  }

  switch (configData.type) {
    case 'defautlList': // 兼容0.6.2及以前版本的列表数据
      await overwriteListMusics(LIST_IDS.DEFAULT, filterMusicList((configData.data as LX.List.MyDefaultListInfoFull).list.map(m => toNewMusicInfo(m))))
      break
    case 'playList':
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await importOldListData(configData.data)
      break
    case 'playList_v2':
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await importNewListData(configData.data)
      break
    case 'allData':
      // 兼容0.6.2及以前版本的列表数据
      if (configData.defaultList) await overwriteListMusics(LIST_IDS.DEFAULT, filterMusicList((configData.defaultList as LX.List.MyDefaultListInfoFull).list.map(m => toNewMusicInfo(m))))
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      else await importOldListData(configData.playList)
      break
    case 'allData_v2':
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await importNewListData(configData.playList)
      break
    case 'allData_v3':
      await restoreV3Data(configData.data)
      break
    case 'playListPart':
      configData.data.list = filterMusicList((configData.data as LX.ConfigFile.MyListInfoPart['data']).list.map(m => toNewMusicInfo(m)))
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      void handleImportListPart(configData.data)
      return true
    case 'playListPart_v2':
      configData.data.list = filterMusicList((configData.data as LX.ConfigFile.MyListInfoPart['data']).list).map(m => fixNewMusicInfoQuality(m))
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      void handleImportListPart(configData.data)
      return true
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    default: showImportTip(configData.type)
  }
}

export const handleImportData = (path: string) => {
  console.log(path)
  toast(global.i18n.t('setting_backup_part_import_tip_running'))
  void importData(path).then((skipTip) => {
    if (skipTip) return
    toast(global.i18n.t('setting_backup_part_import_tip_success'))
  }).catch((err) => {
    log.error(err)
    toast(global.i18n.t('setting_backup_part_import_tip_failed'))
  })
}

/**
 * 导入已解析的备份数据（WebDAV 下载后调用）
 */
export const importDataFromJson = async(configData: any) => {
  switch (configData.type) {
    case 'defautlList':
      await overwriteListMusics(LIST_IDS.DEFAULT, filterMusicList((configData.data as LX.List.MyDefaultListInfoFull).list.map(m => toNewMusicInfo(m))))
      break
    case 'playList':
      await importOldListData(configData.data)
      break
    case 'playList_v2':
      await importNewListData(configData.data)
      break
    case 'allData':
      if (configData.defaultList) await overwriteListMusics(LIST_IDS.DEFAULT, filterMusicList((configData.defaultList as LX.List.MyDefaultListInfoFull).list.map(m => toNewMusicInfo(m))))
      else await importOldListData(configData.playList)
      break
    case 'allData_v2':
      await importNewListData(configData.playList)
      break
    case 'allData_v3':
      await restoreV3Data(configData.data)
      break
    case 'playListPart':
      configData.data.list = filterMusicList((configData.data as LX.ConfigFile.MyListInfoPart['data']).list.map(m => toNewMusicInfo(m)))
      void handleImportListPart(configData.data)
      break
    case 'playListPart_v2':
      configData.data.list = filterMusicList((configData.data as LX.ConfigFile.MyListInfoPart['data']).list).map(m => fixNewMusicInfoQuality(m))
      void handleImportListPart(configData.data)
      break
    default: showImportTip(configData.type)
  }
}

const exportDataToPath = async(path: string, options: BackupSelectOptions) => {
  const data = await buildExportData(options)
  const fileName = data.type === 'playList_v2' ? 'lx_list.lxmc' : 'lx_data.lxmc'
  await handleSaveFile(`${path}/${fileName}`, data)
}
export const handleExportData = (path: string, options: BackupSelectOptions) => {
  toast(global.i18n.t('setting_backup_part_export_tip_running'))
  void exportDataToPath(path, options).then(() => {
    toast(global.i18n.t('setting_backup_part_export_tip_success'))
  }).catch((err: any) => {
    log.error(err.message)
    toast(global.i18n.t('setting_backup_part_export_tip_failed') + ': ' + (err.message as string))
  })
}
