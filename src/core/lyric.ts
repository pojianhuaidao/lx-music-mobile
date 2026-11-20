import {
  play as lrcPlay,
  setLyric as lrcSetLyric,
  pause as lrcPause,
  setPlaybackRate as lrcSetPlaybackRate,
  toggleTranslation as lrcToggleTranslation,
  toggleRoma as lrcToggleRoma,
  init as lrcInit,
} from '@/plugins/lyric'
import {
  playDesktopLyric,
  setDesktopLyric,
  pauseDesktopLyric,
  setDesktopLyricPlaybackRate,
  toggleDesktopLyricTranslation,
  toggleDesktopLyricRoma,
} from '@/core/desktopLyric'
import { getPosition } from '@/plugins/player'
import playerState from '@/store/player/state'
// import settingState from '@/store/setting/state'

/**
 * init lyric
 */
export const init = async() => {
  return lrcInit()
}

/**
 * set lyric
 * @param lyric lyric str
 * @param translation lyric translation
 */
const handleSetLyric = async(lyric: string, translation = '', romalrc = '') => {
  lrcSetLyric(lyric, translation, romalrc)
  // 桌面歌词属于可选能力（浮窗权限、原生模块异常等都可能失败），
  // 不能因为桌面歌词设置失败而抛出异常，否则会中断主歌词的后续流程
  try {
    await setDesktopLyric(lyric, translation, romalrc)
  } catch (err) {
    console.warn('[lyric] setDesktopLyric failed', err)
  }
}

/**
 * play lyric
 * @param time play time
 */
export const handlePlay = (time: number) => {
  if (!Number.isFinite(time)) {
    console.warn('[lyric] invalid lyric time, ignored:', time)
    return
  }
  lrcPlay(time)
  void playDesktopLyric(time).catch((err: unknown) => {
    console.warn('[lyric] playDesktopLyric failed', err)
  })
}

/**
 * pause lyric
 */
export const pause = () => {
  lrcPause()
  void pauseDesktopLyric()
}

/**
 * stop lyric
 */
export const stop = () => {
  void handleSetLyric('')
}

/**
 * set playback rate
 * @param playbackRate playback rate
 */
export const setPlaybackRate = async(playbackRate: number) => {
  lrcSetPlaybackRate(playbackRate)
  await setDesktopLyricPlaybackRate(playbackRate)
  if (playerState.isPlay) {
    setTimeout(() => {
      void getPosition().then((position) => {
        handlePlay(position * 1000)
      })
    })
  }
}

/**
 * toggle show translation
 * @param isShowTranslation is show translation
 */
export const toggleTranslation = async(isShowTranslation: boolean) => {
  lrcToggleTranslation(isShowTranslation)
  await toggleDesktopLyricTranslation(isShowTranslation)
  if (playerState.isPlay) play()
}

/**
 * toggle show roma lyric
 * @param isShowLyricRoma is show roma lyric
 */
export const toggleRoma = async(isShowLyricRoma: boolean) => {
  lrcToggleRoma(isShowLyricRoma)
  await toggleDesktopLyricRoma(isShowLyricRoma)
  if (playerState.isPlay) play()
}

export const play = () => {
  void getPosition().then((position) => {
    handlePlay(position * 1000)
  })
}

/**
 * 重新对齐歌词时间轴
 * 歌词内部时钟只在 handlePlay 时按播放位置重建，单纯 seek 播放器（拖动进度条、远程 seek、
 * 恢复播放进度）不会触发歌词重新定位，导致歌词停留在旧位置后不再滚动。
 * 因此在播放进度跳变后必须补一次 handlePlay。
 */
export const resync = () => {
  if (!playerState.isPlay) return
  void getPosition().then((position) => {
    handlePlay(position * 1000)
  }).catch((err: unknown) => {
    console.warn('[lyric] resync failed', err)
  })
}


export const setLyric = async() => {
  if (!playerState.musicInfo.id) return
  if (playerState.musicInfo.lrc) {
    let tlrc = ''
    let rlrc = ''
    if (playerState.musicInfo.tlrc) tlrc = playerState.musicInfo.tlrc
    if (playerState.musicInfo.rlrc) rlrc = playerState.musicInfo.rlrc
    await handleSetLyric(playerState.musicInfo.lrc, tlrc, rlrc)
  }

  // 换歌后必须按当前播放进度重建歌词时间轴。
  // 原实现只在 isPlay 为 true 时调用 play()：自动切歌（playerEnded -> playNext）时
  // isPlay 会因切源过程短暂为 false，于是歌词行号停在 -1，高亮与滚动都不再更新，
  // 直到用户手动操作才恢复。这里改为始终对齐：播放态继续走时钟，暂停态对齐行号后立刻停表。
  void getPosition().then((position) => {
    if (!Number.isFinite(position)) return
    const time = position * 1000
    if (playerState.isPlay) {
      handlePlay(time)
    } else {
      // 先同步对齐桌面歌词与行号，再立即停表，避免暂停态换歌后高亮停在 -1
      handlePlay(time)
      pause()
    }
  }).catch((err: unknown) => {
    console.warn('[lyric] realign after setLyric failed', err)
  })
}
