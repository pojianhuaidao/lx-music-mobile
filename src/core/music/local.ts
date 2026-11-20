
import { saveLyric, saveMusicUrl } from '@/utils/data'
import { updateListMusics } from '@/core/list'
import {
  buildLyricInfo,
  getCachedLyricInfo,
  getOnlineOtherSourceLyricByLocal,
  getOnlineOtherSourceLyricInfo,
  getOnlineOtherSourceMusicUrl,
  getOnlineOtherSourceMusicUrlByLocal,
  getOnlineOtherSourcePicByLocal,
  getOnlineOtherSourcePicUrl,
  getOtherSource,
} from './utils'
import { getLocalFilePath } from '@/utils/music'
import { readLyric, readPic } from '@/utils/localMediaMetadata'
import { stat } from '@/utils/fs'
import settingState from '@/store/setting/state'
import { getLocalDecodeBackend, getLocalFileExt, isLocalOnlyPlayback, toFFmpegPlayUri, toLocalPlayUri } from '@/core/localCodec'

const getOtherSourceByLocal = async<T>(musicInfo: LX.Music.MusicInfoLocal, handler: (infos: LX.Music.MusicInfoOnline[]) => Promise<T>) => {
  let result: LX.Music.MusicInfoOnline[] = []
  result = await getOtherSource(musicInfo)
  if (result.length) try { return await handler(result) } catch {}
  if (musicInfo.name.includes('-')) {
    const [name, singer] = musicInfo.name.split('-').map(val => val.trim())
    result = await getOtherSource({
      ...musicInfo,
      name,
      singer,
    }, true)
    if (result.length) try { return await handler(result) } catch {}
    result = await getOtherSource({
      ...musicInfo,
      name: singer,
      singer: name,
    }, true)
    if (result.length) try { return await handler(result) } catch {}
  }
  let fileName = (await stat(musicInfo.meta.filePath).catch(() => ({ name: null }))).name ?? musicInfo.meta.filePath.split(/\/|\\/).at(-1)
  if (fileName) {
    fileName = fileName.substring(0, fileName.lastIndexOf('.'))
    if (fileName != musicInfo.name) {
      if (fileName.includes('-')) {
        const [name, singer] = fileName.split('-').map(val => val.trim())
        result = await getOtherSource({
          ...musicInfo,
          name,
          singer,
        }, true)
        if (result.length) try { return await handler(result) } catch {}
        result = await getOtherSource({
          ...musicInfo,
          name: singer,
          singer: name,
        }, true)
      } else {
        result = await getOtherSource({
          ...musicInfo,
          name: fileName,
          singer: '',
        }, true)
      }
      if (result.length) try { return await handler(result) } catch {}
    }
  }

  throw new Error('source not found')
}

export const getMusicUrl = async({ musicInfo, isRefresh, allowToggleSource = true, onToggleSource = () => {} }: {
  musicInfo: LX.Music.MusicInfoLocal
  isRefresh: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
  allowToggleSource?: boolean
}): Promise<string> => {
  const isLocalOnly = isLocalOnlyPlayback()
  // 本地文件是本地歌曲的唯一播放来源：直接交给播放内核（Media3 ExoPlayer）解码，
  // 不做在线源解析，避免本地文件被静默替换成网络流
  if (isLocalOnly || !isRefresh) {
    const path = await getLocalFilePath(musicInfo)
    if (path) {
      // 内核三态判定：系统内核可解直连；需 FFmpeg 内核时返回专用伪 URI 交由播放层切换；
      // 不可解（系统内核无 Extractor 且 FFmpeg 不可用）才明确报错
      switch (getLocalDecodeBackend(path)) {
        case 'system':
          return toLocalPlayUri(path)
        case 'ffmpeg':
          return toFFmpegPlayUri(path)
        case 'unsupported':
        default:
          // 仅本地模式：明确报错，不静默换在线源
          if (isLocalOnly) throw new Error(global.i18n.t('local_play_unsupported_ext', { ext: getLocalFileExt(path) || '-' }))
          break
      }
    } else if (isLocalOnly) {
      throw new Error(global.i18n.t('local_play_file_missing'))
    }
  }

  try {
    return await getOnlineOtherSourceMusicUrlByLocal(musicInfo, isRefresh).then(({ url, quality, isFromCache }) => {
      if (!isFromCache) void saveMusicUrl(musicInfo, quality, url)
      return url
    })
  } catch {}

  if (!allowToggleSource) throw new Error('failed')

  onToggleSource()
  return getOtherSourceByLocal(musicInfo, async(otherSource) => {
    return getOnlineOtherSourceMusicUrl({ musicInfos: [...otherSource], onToggleSource, isRefresh }).then(({ url, quality: targetQuality, musicInfo: targetMusicInfo, isFromCache }) => {
      // saveLyric(musicInfo, data.lyricInfo)
      if (!isFromCache) void saveMusicUrl(targetMusicInfo, targetQuality, url)

      // TODO: save url ?
      return url
    })
  })
}

export const getPicUrl = async({ musicInfo, listId, isRefresh, skipFilePic, onToggleSource = () => {} }: {
  musicInfo: LX.Music.MusicInfoLocal
  listId?: string | null
  isRefresh: boolean
  skipFilePic?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<string> => {
  if (!isRefresh && !skipFilePic) {
    let pic = await readPic(musicInfo.meta.filePath).catch(() => null)
    if (pic) {
      if (pic.startsWith('/')) pic = `file://${pic}`
      return pic
    }

    if (musicInfo.meta.picUrl) return musicInfo.meta.picUrl
  }

  // 关闭在线封面后不再发起网络请求，只保留文件内嵌封面与列表已缓存封面
  if (!settingState.setting['local.allowOnlinePic']) return musicInfo.meta.picUrl ?? ''

  try {
    return await getOnlineOtherSourcePicByLocal(musicInfo).then(({ url }) => {
      return url
    })
  } catch {}

  onToggleSource()
  return getOtherSourceByLocal(musicInfo, async(otherSource) => {
    return getOnlineOtherSourcePicUrl({ musicInfos: [...otherSource], onToggleSource, isRefresh }).then(({ url, musicInfo: targetMusicInfo, isFromCache }) => {
      if (listId) {
        musicInfo.meta.picUrl = url
        void updateListMusics([{ id: listId, musicInfo }])
      }

      return url
    })
  })
}

const getMusicFileLyric = async(filePath: string) => {
  const lyric = await readLyric(filePath).catch(() => null)
  if (!lyric) return null
  return {
    lyric,
  }
}
export const getLyricInfo = async({ musicInfo, isRefresh, skipFileLyric, onToggleSource = () => {} }: {
  musicInfo: LX.Music.MusicInfoLocal
  skipFileLyric?: boolean
  isRefresh: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<LX.Player.LyricInfo> => {
  if (!isRefresh && !skipFileLyric) {
    // const lyricInfo = await getCachedLyricInfo(musicInfo)
    // if (lyricInfo?.rawlrcInfo.lyric && lyricInfo.lyric != lyricInfo.rawlrcInfo.lyric) {
    //   // 存在已编辑歌词
    //   return buildLyricInfo(lyricInfo)
    // }

    // 尝试读取文件内歌词
    const rawlrcInfo = await getMusicFileLyric(musicInfo.meta.filePath)
    if (rawlrcInfo) return buildLyricInfo(rawlrcInfo)

    const lyricInfo = await getCachedLyricInfo(musicInfo)
    if (lyricInfo?.lyric) return buildLyricInfo(lyricInfo)
  }

  // 关闭在线歌词后不再发起网络请求，直接返回空歌词（播放页显示无歌词）
  if (!settingState.setting['local.allowOnlineLyric']) {
    return buildLyricInfo({ lyric: '', tlyric: '', rlyric: '', lxlyric: '' })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    return await getOnlineOtherSourceLyricByLocal(musicInfo, isRefresh).then(({ lyricInfo, isFromCache }) => {
      if (!isFromCache) void saveLyric(musicInfo, lyricInfo)
      return buildLyricInfo(lyricInfo)
    })
  } catch {}

  onToggleSource()
  return getOtherSourceByLocal(musicInfo, async(otherSource) => {
    return getOnlineOtherSourceLyricInfo({ musicInfos: [...otherSource], onToggleSource, isRefresh }).then(async({ lyricInfo, musicInfo: targetMusicInfo, isFromCache }) => {
      void saveLyric(musicInfo, lyricInfo)

      if (isFromCache) return buildLyricInfo(lyricInfo)
      void saveLyric(targetMusicInfo, lyricInfo)

      return buildLyricInfo(lyricInfo)
    })
  })
}
