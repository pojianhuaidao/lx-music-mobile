import { temporaryDirectoryPath, readDir, unlink, extname } from '@/utils/fs'
import { readPic as _readPic } from 'react-native-local-media-metadata'
export {
  type MusicMetadata,
  type MusicMetadataFull,
  readMetadata,
  writeMetadata,
  writePic,
  readLyric,
  writeLyric,
} from 'react-native-local-media-metadata'

let cleared = false
const picCachePath = temporaryDirectoryPath + '/local-media-metadata'

// 支持的音频扩展名。部分车机 ROM 的 FileSystem.ls 不返回 mimeType，
// 只按 mimeType 判定会整片漏识别（尤其 flac/wav/m4a），必须按扩展名兜底。
export const AUDIO_FILE_EXTS = [
  'mp3', 'flac', 'ogg', 'oga', 'opus', 'wav', 'm4a', 'aac', 'wma', 'ape',
  'aif', 'aiff', 'alac', 'mp2', 'mpga', 'm3u8',
]
// 递归深度上限，防止符号链接环/异常深目录把扫描拖死
const MAX_SCAN_DEPTH = 16

type DirEntry = Awaited<ReturnType<typeof readDir>>[number]

const isAudioEntry = (file: DirEntry) => {
  if (file.mimeType?.startsWith('audio/')) return true
  return AUDIO_FILE_EXTS.includes(extname(file?.name ?? '').toLowerCase())
}

// 递归收集所有层级子目录中的音频文件（原实现只扫目录第一层，子目录里的音频识别不到）
const collectAudioFiles = async(
  dirPath: string,
  result: DirEntry[],
  depth: number = 0,
  visited: Set<string> = new Set(),
): Promise<void> => {
  if (depth > MAX_SCAN_DEPTH) return
  const visitKey = dirPath.toLowerCase()
  if (visited.has(visitKey)) return
  visited.add(visitKey)

  let entries: DirEntry[]
  try {
    entries = await readDir(dirPath)
  } catch (e) {
    // 单个子目录不可读（权限/坏目录）不应中断整体扫描
    return
  }

  for (const file of entries) {
    const name = file.name ?? ''
    if (!name) continue
    // isDirectory 优先；部分实现只给 isFile，做双向兜底
    const isDirectory = file.isDirectory ?? (file.isFile === false)
    if (isDirectory) {
      // 隐藏目录、Android 受保护目录、回收站目录跳过
      if (name.startsWith('.') || name === 'Android' || name === 'LOST.DIR') continue
      await collectAudioFiles(file.path || (dirPath + '/' + name), result, depth + 1, visited)
      continue
    }
    if (isAudioEntry(file)) result.push(file)
  }
}

export const scanAudioFiles = async(dirPath: string, recursive = false) => {
  if (recursive) {
    const result: DirEntry[] = []
    await collectAudioFiles(dirPath, result)
    return result
  }
  const files = await readDir(dirPath)
  return files.filter(file => {
    if (file.mimeType?.startsWith('audio/')) return true
    if (extname(file?.name ?? '') === 'ogg') return true
    return false
  }).map(file => file)
}

const clearPicCache = async() => {
  await unlink(picCachePath)
  cleared = true
}

export const readPic = async(dirPath: string): Promise<string> => {
  if (!cleared) await clearPicCache()
  return _readPic(dirPath, picCachePath)
}

// export interface MusicMetadata {
//   type: 'mp3' | 'flac' | 'ogg' | 'wav'
//   bitrate: string
//   interval: number
//   size: number
//   ext: 'mp3' | 'flac' | 'ogg' | 'wav'
//   albumName: string
//   singer: string
//   name: string
// }
// export const readMetadata = async(filePath: string): Promise<MusicMetadata | null> => {
//   return LocalMediaModule.readMetadata(filePath)
// }

// export const readPic = async(filePath: string): Promise<string> => {
//   return LocalMediaModule.readPic(filePath)
// }

// export const readLyric = async(filePath: string): Promise<string> => {
//   return LocalMediaModule.readLyric(filePath)
// }


