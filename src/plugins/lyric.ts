import { useEffect, useState } from 'react'
import Lyric, { type Lines } from 'lrc-file-parser'
// import { getStore, subscribe } from '@/store'
export type Line = Lines[number]
type PlayHook = (line: number, text: string) => void
type SetLyricHook = (lines: Lines) => void

const lrcTools = {
  isInited: false,
  lrc: null as Lyric | null,
  currentLineData: { line: 0, text: '' },
  currentLines: [] as Lines,
  playHooks: [] as PlayHook[],
  setLyricHooks: [] as SetLyricHook[],
  isPlay: false,
  // 最近一次播放位置（毫秒）。lrc-file-parser 的歌词解析是异步的，
  // 解析完成前调用的 play(time) 会被内部初始化流程吞掉，
  // 导致换歌后行号停在 0/旧行（观感就是「自动切歌后歌词不跟随」）。
  // 记录该时间，解析完成后在 onSetLyric 里补一次对齐。
  lastPlayTime: 0,
  isShowTranslation: false,
  isShowRoma: false,
  lyricText: '',
  translationText: '' as string | null | undefined,
  romaText: '' as string | null | undefined,
  init() {
    if (this.isInited) return
    this.isInited = true
    this.lrc = new Lyric({
      onPlay: this.onPlay.bind(this),
      onSetLyric: this.onSetLyric.bind(this),
      offset: 100, // offset time(ms), default is 150 ms
    })
  },
  onPlay(line: number, text: string) {
    this.currentLineData.line = line
    // console.log(line)
    this.currentLineData.text = text
    for (const hook of this.playHooks) hook(line, text)
  },
  onSetLyric(lines: Lines) {
    this.currentLines = lines
    this.currentLineData.line = -1
    this.currentLineData.text = ''
    for (const hook of this.playHooks) hook(-1, '')
    for (const hook of this.setLyricHooks) hook(lines)
    // 解析完成时按最后一次播放位置重建歌词时间轴。
    // lrc-file-parser 在歌词为空时 play() 会直接 return，解析期间到达的 play(time)
    // 因此被静默丢弃，行号永久停在 -1/0 —— 这正是「自动切歌后歌词不跟随」的根因。
    // 这里补一次对齐：播放态继续走时钟，暂停态对齐行号后立刻停表，
    // 避免暂停换歌/暂停态歌词晚到时高亮一直停在 -1。
    if (!lines.length) return
    const time = this.lastPlayTime
    setTimeout(() => {
      if (this.currentLines !== lines || !this.lrc) return
      this.lrc.play(time)
      if (!this.isPlay) this.lrc.pause()
    }, 0)
  },
  addPlayHook(hook: PlayHook) {
    this.playHooks.push(hook)
    hook(this.currentLineData.line, this.currentLineData.text)
  },
  removePlayHook(hook: PlayHook) {
    this.playHooks.splice(this.playHooks.indexOf(hook), 1)
  },
  addSetLyricHook(hook: SetLyricHook) {
    this.setLyricHooks.push(hook)
    hook(this.currentLines)
  },
  removeSetLyricHook(hook: SetLyricHook) {
    this.setLyricHooks.splice(this.setLyricHooks.indexOf(hook), 1)
  },
  setLyric() {
    const extendedLyrics = [] as string[]
    if (this.isShowTranslation && this.translationText) extendedLyrics.push(this.translationText)
    if (this.isShowRoma && this.romaText) extendedLyrics.push(this.romaText)
    this.lrc!.setLyric(this.lyricText, extendedLyrics)
  },
}


export const init = async() => {
  lrcTools.init()
}

export const setLyric = (lyric: string, translation?: string, romalrc?: string) => {
  // 不再无条件把 isPlay 置 false：换歌词时播放器可能仍在播放，
  // 清零后若核心层的 play() 早于歌词就绪，歌词时钟会永久停在暂停态。
  // 解析由 onSetLyric 统一按 lastPlayTime 恢复；只有清空歌词（停止播放）才真正停表。
  if (!lyric) {
    lrcTools.isPlay = false
    lrcTools.lastPlayTime = 0
  } else {
    // 新歌词从时间轴起点重新对齐：沿用上一首的最后位置会让恢复逻辑先跳到旧歌末尾行
    lrcTools.lastPlayTime = 0
  }
  lrcTools.lyricText = lyric
  lrcTools.translationText = translation
  lrcTools.romaText = romalrc
  lrcTools.setLyric()
}
export const setPlaybackRate = (playbackRate: number) => {
  lrcTools.lrc!.setPlaybackRate(playbackRate)
}
export const toggleTranslation = (isShow: boolean) => {
  lrcTools.isShowTranslation = isShow
  if (!lrcTools.lyricText) return
  lrcTools.setLyric()
}
export const toggleRoma = (isShow: boolean) => {
  lrcTools.isShowRoma = isShow
  if (!lrcTools.lyricText) return
  lrcTools.setLyric()
}
export const play = (time: number) => {
  // console.log(time)
  if (Number.isFinite(time)) lrcTools.lastPlayTime = time
  lrcTools.isPlay = true
  lrcTools.lrc!.play(time)
}
export const pause = () => {
  // console.log('pause')
  lrcTools.isPlay = false
  lrcTools.lrc!.pause()
}

// on lyric play hook
export const useLrcPlay = (autoUpdate = true) => {
  const [lrcInfo, setLrcInfo] = useState(lrcTools.currentLineData)
  useEffect(() => {
    if (!autoUpdate) return
    const setLrcCallback: SetLyricHook = () => {
      setLrcInfo({ line: 0, text: '' })
    }
    const playCallback: PlayHook = (line, text) => {
      setLrcInfo({ line, text })
    }
    lrcTools.addSetLyricHook(setLrcCallback)
    lrcTools.addPlayHook(playCallback)
    setLrcInfo(lrcTools.currentLineData)
    return () => {
      lrcTools.removeSetLyricHook(setLrcCallback)
      lrcTools.removePlayHook(playCallback)
    }
  }, [autoUpdate])

  return lrcInfo
}

// on lyric set hook
export const useLrcSet = () => {
  const [lines, setLines] = useState<Lines>(lrcTools.currentLines)
  useEffect(() => {
    const callback = (lines: Lines) => {
      setLines(lines)
    }
    lrcTools.addSetLyricHook(callback)
    return () => { lrcTools.removeSetLyricHook(callback) }
  }, [])

  return lines
}

