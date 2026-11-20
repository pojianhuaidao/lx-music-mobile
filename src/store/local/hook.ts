/**
 * 本地音乐模块 React Hooks
 */

import { useEffect, useMemo, useState } from 'react'
import localState, { type LocalMusicInfo, type FolderInfo } from './state'
import { filterLocalMusics, getLocalFilterOptions, hasActiveFilter, type LocalFilterOptions } from '@/utils/localFilter'

/**
 * 使用本地音乐列表
 */
export const useLocalList = () => {
  const [list, setList] = useState(localState.list)

  useEffect(() => {
    const handler = (newList: LocalMusicInfo[]) => {
      setList(newList)
    }

    global.state_event.on('localListChanged', handler)
    return () => {
      global.state_event.off('localListChanged', handler)
    }
  }, [])

  return list
}

/**
 * 使用文件夹列表
 */
export const useFolders = () => {
  const [folders, setFolders] = useState(localState.folders)

  useEffect(() => {
    const handler = (newFolders: FolderInfo[]) => {
      setFolders(newFolders)
    }

    global.state_event.on('localFoldersChanged', handler)
    return () => {
      global.state_event.off('localFoldersChanged', handler)
    }
  }, [])

  return folders
}

/**
 * 使用扫描状态
 */
export const useScanning = () => {
  const [isScanning, setIsScanning] = useState(localState.isScanning)

  useEffect(() => {
    const handler = (scanning: boolean) => {
      setIsScanning(scanning)
    }

    global.state_event.on('localScanningChanged', handler)
    return () => {
      global.state_event.off('localScanningChanged', handler)
    }
  }, [])

  return isScanning
}

/**
 * 使用扫描进度
 */
export const useScanProgress = () => {
  const [progress, setProgress] = useState(localState.scanProgress)

  useEffect(() => {
    const handler = (newProgress: typeof localState.scanProgress) => {
      setProgress(newProgress)
    }

    global.state_event.on('localScanProgressChanged', handler)
    return () => {
      global.state_event.off('localScanProgressChanged', handler)
    }
  }, [])

  return progress
}

/**
 * 使用本地音乐统计
 */
export const useLocalStats = () => {
  const [stats, setStats] = useState({
    total: localState.list.length,
    totalSize: localState.list.reduce((acc, item) => acc + item.size, 0),
  })

  useEffect(() => {
    const handler = (newList: LocalMusicInfo[]) => {
      setStats({
        total: newList.length,
        totalSize: newList.reduce((acc, item) => acc + item.size, 0),
      })
    }

    global.state_event.on('localListChanged', handler)
    return () => {
      global.state_event.off('localListChanged', handler)
    }
  }, [])

  return stats
}

/**
 * 使用排序设置
 */
export const useSortSetting = () => {
  const [sortType, setSortType] = useState(localState.sortType)
  const [sortOrder, setSortOrder] = useState(localState.sortOrder)

  useEffect(() => {
    const handler = () => {
      setSortType(localState.sortType)
      setSortOrder(localState.sortOrder)
    }

    global.state_event.on('localListChanged', handler)
    return () => {
      global.state_event.off('localListChanged', handler)
    }
  }, [])

  return { sortType, sortOrder }
}

/**
 * 使用本地音乐过滤选项（订阅 configUpdated 实时刷新）
 */
export const useLocalFilterOptions = (): LocalFilterOptions => {
  const [options, setOptions] = useState(getLocalFilterOptions)

  useEffect(() => {
    const handler = () => {
      setOptions(getLocalFilterOptions())
    }

    global.state_event.on('configUpdated', handler)
    return () => {
      global.state_event.off('configUpdated', handler)
    }
  }, [])

  return options
}

/**
 * 使用过滤后的本地音乐列表（列表展示与播放队列同源）
 */
export const useFilteredLocalList = (): LocalMusicInfo[] => {
  const list = useLocalList()
  const options = useLocalFilterOptions()

  return useMemo(() => filterLocalMusics(list, options), [list, options])
}

/**
 * 使用过滤命中统计
 */
export const useLocalFilterStats = () => {
  const list = useLocalList()
  const options = useLocalFilterOptions()

  return useMemo(() => {
    const filtered = filterLocalMusics(list, options)
    return {
      total: list.length,
      matched: filtered.length,
      totalSize: list.reduce((acc, item) => acc + item.size, 0),
      matchedSize: filtered.reduce((acc, item) => acc + item.size, 0),
      active: hasActiveFilter(options),
    }
  }, [list, options])
}
