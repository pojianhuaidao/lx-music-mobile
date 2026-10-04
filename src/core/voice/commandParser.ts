/**
 * 语音命令解析：唤醒后识别文本 → 播放/搜索指令
 * 支持前缀：播放 / 搜索 / 搜 / 来一首 / 来首 / 唱一首 / 唱 / 点一首 / 我要听 / 给我放 / 放一首 / 放
 * 例：'播放 周杰伦 晴天' → { type: 'search', keyword: '周杰伦 晴天' }
 */

export interface VoiceCommand {
  type: 'search'
  keyword: string
}

const ACTION_PREFIXES = [
  '播放',
  '搜索',
  '搜一下',
  '搜',
  '来一首',
  '来首',
  '唱一首',
  '唱',
  '点一首',
  '点歌',
  '我要听',
  '给我放',
  '放一首',
  '放',
] as const

const TRAILING_CHARS = /[。，、！？!?.;；\s]+$/g

export const parseVoiceCommand = (text: string): VoiceCommand | null => {
  const raw = (text || '').trim()
  if (!raw) return null

  for (const prefix of ACTION_PREFIXES) {
    if (raw.startsWith(prefix)) {
      const keyword = raw.slice(prefix.length).trim().replace(TRAILING_CHARS, '')
      if (keyword) return { type: 'search', keyword }
      return null
    }
  }
  return null
}
