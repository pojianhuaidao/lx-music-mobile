import { localAction, type LocalMusicInfo } from '@/store/local'
import { scanAudioFiles, readMetadata, AUDIO_FILE_EXTS, type MusicMetadata, type MusicMetadataFull } from '@/utils/localMediaMetadata'
import { toast, confirmDialog } from '@/utils/tools'
import { stat, readDir, externalStorageDirectoryPath, getExternalStoragePaths } from '@/utils/fs'
import { isExternalStorageManager, requestManageExternalStorage } from '@/utils/nativeModules/utils'

const generateLocalMusicId = (filePath: string): string => {
  // Use a simple hash function to generate unique ID from file path
  let hash = 0
  for (let i = 0; i < filePath.length; i++) {
    const char = filePath.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return 'local_' + Math.abs(hash).toString(36) + '_' + filePath.length
}

const createLocalMusicInfo = async(filePath: string, metadata: MusicMetadataFull | null, fileSize: number): Promise<LocalMusicInfo> => {
  const fileName = filePath.split(/[/\\]/).pop() || ''
  const ext = fileName.split('.').pop() || ''
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '')

  let name = nameWithoutExt
  let singer = ''
  let albumName = ''
  let interval: string | null = null

  if (metadata) {
    name = metadata.name || nameWithoutExt
    singer = metadata.singer || ''
    albumName = metadata.albumName || ''
    if (metadata.interval) {
      const minutes = Math.floor(metadata.interval / 60)
      const seconds = Math.floor(metadata.interval % 60)
      interval = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
  } else {
    // Try to parse name and singer from filename (format: "singer - name" or "name - singer")
    if (nameWithoutExt.includes(' - ')) {
      const parts = nameWithoutExt.split(' - ')
      if (parts.length >= 2) {
        singer = parts[0].trim()
        name = parts.slice(1).join(' - ').trim()
      }
    }
  }

  return {
    id: generateLocalMusicId(filePath),
    name,
    singer,
    source: 'local',
    interval,
    meta: {
      songId: filePath,
      albumName,
      filePath,
      ext,
    },
    addTime: Date.now(),
    size: fileSize,
  }
}

// 支持的音频扩展名统一由 localMediaMetadata 提供（扩展名兜底判断，避免部分 ROM 返回 mimeType 为空导致漏识别）
// 递归深度上限：防止异常目录结构（符号链接环/超深目录）把扫描拖死
const MAX_SCAN_DEPTH = 16

// 扫描进度节流：大目录下逐文件上报会让 JS 线程空转，这里每 150ms 或每 100 个文件才上报一次
let lastProgressAt = 0
const reportScanProgress = (current: number, total: number, currentFile: string, force = false) => {
  const now = Date.now()
  if (!force && now - lastProgressAt < 150) return
  lastProgressAt = now
  localAction.updateScanProgress({ current, total, currentFile })
}

// Collect all audio files recursively（递归遍历所有层级子目录）
const collectAudioFiles = async(
  folderPath: string,
  allFiles: Array<{ path: string; name: string }>,
  depth: number = 0,
  visited: Set<string> = new Set(),
): Promise<void> => {
  if (depth > MAX_SCAN_DEPTH) return
  // 目录去重：某些 ROM 的符号链接会让同一目录被反复遍历
  const visitKey = folderPath.toLowerCase()
  if (visited.has(visitKey)) return
  visited.add(visitKey)

  let items: Awaited<ReturnType<typeof readDir>>
  try {
    items = await readDir(folderPath)
  } catch (e) {
    // 单个目录不可读（权限/坏目录）不影响其它子目录继续扫描
    return
  }

  for (const item of items) {
    const itemName = item.name || ''
    if (!itemName) continue
    const itemPath = item.path || (folderPath + '/' + itemName)

    // 优先用 isDirectory 判定；部分实现只提供 isFile，这里做双向兜底
    const isDirectory = item.isDirectory ?? (item.isFile === false)
    if (isDirectory) {
      // 跳过隐藏目录与系统目录（Android/data 等不可读，且不属于音乐库范围）
      if (itemName.startsWith('.') || itemName === 'Android' || itemName === 'LOST.DIR') continue
      await collectAudioFiles(itemPath, allFiles, depth + 1, visited)
      continue
    }

    const ext = itemName.split('.').pop()?.toLowerCase() || ''
    const isAudio = item.mimeType?.startsWith('audio/') || AUDIO_FILE_EXTS.includes(ext)
    if (!isAudio) continue

    allFiles.push({ path: itemPath, name: itemName })
    // 分层上报：total 用已发现数动态更新，让扫描进度尽早可见
    reportScanProgress(allFiles.length, allFiles.length, itemName)
  }
}

export const scanFolderFiles = async(folderPath: string, recursive: boolean = false): Promise<LocalMusicInfo[]> => {
  const results: LocalMusicInfo[] = []

  try {
    let filesToProcess: Array<{ path: string; name: string }> = []

    if (recursive) {
      // Recursive scan for all storage
      await collectAudioFiles(folderPath, filesToProcess)
    } else {
      // Non-recursive scan for specific folder
      const files = await scanAudioFiles(folderPath)
      filesToProcess = files.map(f => ({ path: f.path || (folderPath + '/' + f.name), name: f.name || '' }))
    }

    const total = filesToProcess.length
    localAction.updateScanProgress({ current: 0, total, currentFile: '' })

    // 限流并发处理（4 并发）：stat/readMetadata/createLocalMusicInfo 均为只读操作，可安全并发；
    // 结果按原文件顺序归位，保证 addMusics 行为与串行一致
    const CONCURRENCY = 4
    let processedCount = 0
    const processFile = async(index: number): Promise<LocalMusicInfo | null> => {
      const file = filesToProcess[index]
      try {
        const fileInfo = await stat(file.path).catch(() => null)
        const fileSize = fileInfo?.size || 0

        let metadata: MusicMetadataFull | null = null
        try {
          metadata = await readMetadata(file.path)
        } catch (e) {
          // Ignore metadata read errors
        }

        const musicInfo = await createLocalMusicInfo(file.path, metadata, fileSize)
        processedCount++
        localAction.updateScanProgress({
          current: processedCount,
          total,
          currentFile: file.name,
        })
        return musicInfo
      } catch (e) {
        console.error('Error processing file:', file.path, e)
        processedCount++
        localAction.updateScanProgress({
          current: processedCount,
          total,
          currentFile: file.name,
        })
        return null
      }
    }

    const resultsByIndex: Array<LocalMusicInfo | null> = new Array(filesToProcess.length).fill(null)
    let nextIndex = 0
    const workerCount = Math.min(CONCURRENCY, filesToProcess.length)
    const workers = Array.from({ length: workerCount }, async() => {
      while (true) {
        const index = nextIndex++
        if (index >= filesToProcess.length) break
        resultsByIndex[index] = await processFile(index)
      }
    })
    await Promise.all(workers)

    for (const info of resultsByIndex) {
      if (info) results.push(info)
    }
  } catch (e) {
    console.error('Error scanning folder:', folderPath, e)
  }

  return results
}

/**
 * 导入（或重新扫描）指定音乐文件夹。
 * 目录路径来自应用内置文件浏览器（ChoosePath 的 dirOnly 模式），不再拉起系统 SAF 目录选择器，
 * 车机上系统选择器常常进不去外部存储或返回 content:// 后无法读取。
 * 扫描固定递归（recursive=true），修复此前只扫一层、子目录里的音频识别不到的问题。
 */
export const importFolder = async(folderPath: string): Promise<void> => {
  if (!folderPath) return
  try {
    const folderName = folderPath.split(/[/\\]/).filter(Boolean).pop() || folderPath

    // Add folder to list
    localAction.addFolder({
      path: folderPath,
      name: folderName,
      addTime: Date.now(),
    })

    // folder already exists is ok, still proceed to scan for missing songs

    // Start scanning
    localAction.setScanning(true)

    try {
      const musics = await scanFolderFiles(folderPath, true)

      if (musics.length === 0) {
        toast(global.i18n.t('local_scan_empty'))
      } else {
        const addedCount = localAction.addMusics(musics, true)
        toast(global.i18n.t('local_scan_complete', { count: addedCount }))
      }
    } finally {
      localAction.setScanning(false)
      localAction.updateScanProgress({ current: 0, total: 0, currentFile: '' })
    }
  } catch (e) {
    console.error('Error scanning folder:', folderPath, e)
    localAction.setScanning(false)
    toast(global.i18n.t('open_storage_select_managed_folder_failed_tip', { msg: (e as Error)?.message ?? String(e) }))
  }
}

export const scanAllStorage = async(): Promise<void> => {
  // 检查是否有所有文件访问权限 (Android 11+)
  const hasPermission = await isExternalStorageManager()
  if (!hasPermission) {
    const grantPermission = await confirmDialog({
      message: global.i18n.t('local_storage_permission_tip'),
      confirmButtonText: global.i18n.t('local_storage_permission_grant'),
      cancelButtonText: global.i18n.t('cancel'),
    })
    if (grantPermission) {
      const granted = await requestManageExternalStorage()
      if (!granted) {
        toast(global.i18n.t('local_storage_permission_denied'))
        return
      }
      // 用户授权后需要重新检查
      const recheckPermission = await isExternalStorageManager()
      if (!recheckPermission) {
        toast(global.i18n.t('local_storage_permission_denied'))
        return
      }
    } else {
      return
    }
  }

  const confirmed = await confirmDialog({
    message: global.i18n.t('local_scan_all_tip'),
    confirmButtonText: global.i18n.t('local_scan_all_confirm'),
  })

  if (!confirmed) return

  localAction.setScanning(true)

  try {
    let totalAdded = 0
    const scannedPaths: string[] = []

    // Scan internal storage (recursive)
    if (externalStorageDirectoryPath) {
      try {
        const musics = await scanFolderFiles(externalStorageDirectoryPath, true)
        totalAdded += localAction.addMusics(musics, true)
        scannedPaths.push(externalStorageDirectoryPath)
      } catch (e) {
        console.error('Error scanning internal storage:', e)
      }
    }

    // Scan external SD cards (recursive)
    try {
      const externalPaths = await getExternalStoragePaths(true)
      for (const extPath of externalPaths) {
        if (scannedPaths.includes(extPath)) continue
        try {
          const musics = await scanFolderFiles(extPath, true)
          totalAdded += localAction.addMusics(musics, true)
          scannedPaths.push(extPath)
        } catch (e) {
          console.error('Error scanning external storage:', extPath, e)
        }
      }
    } catch (e) {
      console.error('Error getting external storage paths:', e)
    }

    if (totalAdded === 0) {
      toast(global.i18n.t('local_scan_empty'))
    } else {
      toast(global.i18n.t('local_scan_complete', { count: totalAdded }))
    }
  } finally {
    localAction.setScanning(false)
    localAction.updateScanProgress({ current: 0, total: 0, currentFile: '' })
  }
}
