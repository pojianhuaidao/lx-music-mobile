import musicSdk from '@/utils/musicSdk'
import { toNewMusicInfo } from '@/utils'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { LIST_IDS } from '@/config/constant'
import settingAction from '@/store/setting/action'

// 推荐聚合数据源：kg 每日推荐歌单 + mg 推荐歌单广场 + 各平台热榜
const RECOMMEND_SOURCES: LX.OnlineSource[] = ['kw', 'kg', 'tx', 'wy', 'mg']
const RECOMMEND_TEMP_ID = 'recommend'
// 每个推荐歌单源最多取前 N 个歌单
const SOURCE_LIST_LIMIT = 2
// 每个平台热榜最多取前 N 个榜单
const BOARD_LIMIT = 1
// 每个数据源单页最多保留的歌曲数
const PAGE_SONG_LIMIT = 30

// 歌名/歌手归一化（参考 musicSdk 搜索去重逻辑）
const singerSplitRegx = /、|&|;|；|\/|,|，|\|/
const sortSinger = (singer: string) => singerSplitRegx.test(singer) ? singer.split(singerSplitRegx).sort((a, b) => a.localeCompare(b)).join('、') : singer
const filterName = (str: string) => str.replace(/\s|'|\.|,|，|&|"|、|\(|\)|（|）|`|~|-|<|>|\||\/|\]|\[|!|！/g, '')
const getMusicKey = (music: LX.Music.MusicInfoOnline) => `${filterName(music.name).toLowerCase()}|${filterName(sortSinger(music.singer)).toLowerCase()}`

/** 按「歌名+歌手」归一化去重，保留首次出现的歌曲 */
const deduplicationByName = (list: LX.Music.MusicInfoOnline[]) => {
  const keys = new Set<string>()
  return list.filter(music => {
    const key = getMusicKey(music)
    if (keys.has(key)) return false
    keys.add(key)
    return true
  })
}

/** 将音源原始歌曲结构转换为标准歌曲信息（缺失 source 时补充） */
const toStandardMusic = (rawMusic: any, source: LX.OnlineSource): LX.Music.MusicInfoOnline => {
  return toNewMusicInfo({
    ...rawMusic,
    source: rawMusic.source ?? source,
  }) as LX.Music.MusicInfoOnline
}

/** 拉取歌单列表内前 N 个歌单的第一页歌曲 */
const fetchSongListPage = async(source: LX.OnlineSource, list: Array<{ id: string }>, limit: number): Promise<LX.Music.MusicInfoOnline[]> => {
  const result: LX.Music.MusicInfoOnline[] = []
  for (const item of list.slice(0, limit)) {
    try {
      const detail = await musicSdk[source].songList.getListDetail(item.id, 1) as { list: any[] }
      if (detail?.list?.length) result.push(...detail.list.slice(0, PAGE_SONG_LIMIT).map((m: any) => toStandardMusic(m, source)))
    } catch (err) {
      console.warn(`[recommend] 歌单详情拉取失败 source=${source} id=${item.id}`, err)
    }
  }
  return result
}

/** 拉取平台热榜前 N 个榜单的第一页歌曲 */
const fetchLeaderboardPage = async(source: LX.OnlineSource, boardLimit: number): Promise<LX.Music.MusicInfoOnline[]> => {
  const result: LX.Music.MusicInfoOnline[] = []
  try {
    const boards = await musicSdk[source].leaderboard.getBoards() as { list: Array<{ bangid: string }> }
    if (!boards?.list?.length) return result
    for (const board of boards.list.slice(0, boardLimit)) {
      try {
        const detail = await musicSdk[source].leaderboard.getList(board.bangid, 1) as { list: any[] }
        if (detail?.list?.length) result.push(...detail.list.slice(0, PAGE_SONG_LIMIT).map((m: any) => toStandardMusic(m, source)))
      } catch (err) {
        console.warn(`[recommend] 榜单歌曲拉取失败 source=${source} bangid=${board.bangid}`, err)
      }
    }
  } catch (err) {
    console.warn(`[recommend] 榜单列表拉取失败 source=${source}`, err)
  }
  return result
}

/**
 * 获取聚合推荐歌曲列表
 * 数据源：kg 每日推荐歌单 + mg 推荐歌单广场 + kw/kg/tx/wy/mg 热歌榜
 * 按「歌名+歌手」归一化去重后返回
 */
export const getRecommendList = async(): Promise<LX.Music.MusicInfoOnline[]> => {
  const list: LX.Music.MusicInfoOnline[] = []

  // kg 每日推荐歌单
  try {
    const kgList = await musicSdk.kg.songList.getSongListRecommend() as Array<{ id: string }>
    if (kgList?.length) list.push(...await fetchSongListPage('kg', kgList, SOURCE_LIST_LIMIT))
  } catch (err) {
    console.warn('[recommend] kg 每日推荐歌单拉取失败', err)
  }

  // mg 推荐歌单广场
  try {
    const mgList = await musicSdk.mg.songList.getList(musicSdk.mg.songList.sortList[0].id, null, 1) as { list: Array<{ id: string }> }
    if (mgList?.list?.length) list.push(...await fetchSongListPage('mg', mgList.list, SOURCE_LIST_LIMIT))
  } catch (err) {
    console.warn('[recommend] mg 推荐歌单广场拉取失败', err)
  }

  // 各平台热榜
  for (const source of RECOMMEND_SOURCES) {
    list.push(...await fetchLeaderboardPage(source, BOARD_LIMIT))
  }

  return deduplicationByName(list)
}

/**
 * 聚合推荐并随机播放：写入临时列表 → 切换随机播放模式 → 播放
 */
export const playRecommendList = async(): Promise<LX.Music.MusicInfoOnline[]> => {
  const list = await getRecommendList()
  if (!list.length) throw new Error('推荐歌曲拉取失败，请稍后重试')
  await setTempList(RECOMMEND_TEMP_ID, list)
  settingAction.updateSetting({ 'player.togglePlayMethod': 'random' })
  await playList(LIST_IDS.TEMP, 0)
  return list
}
