/* eslint-disable @typescript-eslint/no-misused-promises */
import TrackPlayer, { State as TPState, Event as TPEvent } from 'react-native-track-player'
// import { store } from '@/store'
// import { action as playerAction, STATUS } from '@/store/modules/player'
import { isTempId, isEmpty } from './utils'
// import { play as lrcPlay, pause as lrcPause } from '@/core/lyric'
import { exitApp } from '@/core/common'
import { getCurrentTrackId } from './playList'
import { pause, play, playNext, playPrev } from '@/core/player/player'

let isInitialized = false

// let retryTrack: LX.Player.Track | null = null
// let retryGetUrlId: string | null = null
// let retryGetUrlNum = 0
// let errorTime = 0
// let prevDuration = 0
// let isPlaying = false

// 销毁播放器并退出
const handleExitApp = async(reason: string) => {
  global.lx.isPlayedStop = false
  exitApp(reason)
}


const registerPlaybackService = async() => {
  if (isInitialized) return

  console.log('reg services...')
  TrackPlayer.addEventListener(TPEvent.RemotePlay, () => {
    // console.log('remote-play')
    try {
      play()
    } catch (err) {
      console.log('[service] remote play failed', err)
    }
  })

  TrackPlayer.addEventListener(TPEvent.RemotePause, () => {
    // console.log('remote-pause')
    void pause().catch((err) => {
      console.log('[service] remote pause failed', err)
    })
  })

  TrackPlayer.addEventListener(TPEvent.RemoteNext, () => {
    // console.log('remote-next')
    void playNext().catch((err) => {
      console.log('[service] remote next playNext failed', err)
    })
  })

  TrackPlayer.addEventListener(TPEvent.RemotePrevious, () => {
    // console.log('remote-previous')
    void playPrev().catch((err) => {
      console.log('[service] remote prev playPrev failed', err)
    })
  })

  TrackPlayer.addEventListener(TPEvent.RemoteStop, () => {
    // console.log('remote-stop')
    void handleExitApp('Remote Stop').catch((err) => {
      console.log('[service] remote stop failed', err)
    })
  })

  // TrackPlayer.addEventListener(TPEvent.RemoteDuck, async({ permanent, paused, ducking }) => {
  //   console.log('remote-duck')
  //   if (paused) {
  //     store.dispatch(playerAction.setStatus({ status: STATUS.pause, text: '已暂停' }))
  //     lrcPause()
  //   } else {
  //     store.dispatch(playerAction.setStatus({ status: STATUS.playing, text: '播放中...' }))
  //     TrackPlayer.getPosition().then(position => {
  //       lrcPlay(position * 1000)
  //     })
  //   }
  // })

  TrackPlayer.addEventListener(TPEvent.PlaybackError, async(err: any) => {
    try {
      console.log('playback-error', err)
      global.app_event.error()
      global.app_event.playerError()
    } catch (e) {
      // 监听器内部异常兜底，避免 async 回调 unhandled rejection
      console.log('[service] playback-error handler failed', e)
    }
  })

  TrackPlayer.addEventListener(TPEvent.RemoteSeek, async({ position }) => {
    global.app_event.setProgress(position as number)
  })

  TrackPlayer.addEventListener(TPEvent.PlaybackState, async info => {
    try {
      if (global.lx.gettingUrlId || isTempId()) return
      // let currentIsPlaying = false

      switch (info.state) {
        case TPState.None:
          // console.log('state', 'State.NONE')
          break
        case TPState.Ready:
        case TPState.Stopped:
        case TPState.Paused:
          global.app_event.playerPause()
          global.app_event.pause()
          break
        case TPState.Playing:
          global.app_event.playerPlaying()
          global.app_event.play()
          break
        case TPState.Buffering:
          global.app_event.pause()
          global.app_event.playerWaiting()
          break
        case TPState.Connecting:
          global.app_event.playerLoadstart()
          break
        default:
          // console.log('playback-state', info)
          break
      }
      if (global.lx.isPlayedStop) return void handleExitApp('Timeout Exit').catch((err) => {
        console.log('[service] exitApp failed', err)
      })

      // console.log('currentIsPlaying', currentIsPlaying, global.lx.playInfo.isPlaying)
      // void updateMetaData(global.lx.store_playMusicInfo.musicInfo, currentIsPlaying)
    } catch (e) {
      console.log('[service] playback-state handler failed', e)
    }
  })
  TrackPlayer.addEventListener(TPEvent.PlaybackTrackChanged, async info => {
    try {
      // console.log('PlaybackTrackChanged====>', info)
      global.lx.playerTrackId = await getCurrentTrackId()
      if (info.track == null) return
      if (global.lx.isPlayedStop) return void handleExitApp('Timeout Exit').catch((err) => {
        console.log('[service] exitApp failed', err)
      })

      // console.log('global.lx.playerTrackId====>', global.lx.playerTrackId)
      if (isEmpty()) {
        // console.log('====TEMP PAUSE====')
        await TrackPlayer.pause()
        global.app_event.playerPause()
        global.app_event.pause()
        global.app_event.playerEnded()
        global.app_event.playerEmptied()
      }
    } catch (e) {
      console.log('[service] playback-track-changed handler failed', e)
    }
  })
  // TrackPlayer.addEventListener('playback-queue-ended', async info => {
  //   // console.log('playback-queue-ended', info)
  //   store.dispatch(playerAction.playNext())
  //   // if (!info.nextTrack) return
  //   // const track = await TrackPlayer.getTrack(info.nextTrack)
  //   // if (!track) return
  //   // // if (track.url == defaultUrl) {
  //   // //   TrackPlayer.pause()
  //   // //   getMusicUrl(track.original).then(url => {
  //   // //     TrackPlayer.updateMetadataForTrack(info.nextTrack, {
  //   // //       url,
  //   // //     })
  //   // //     TrackPlayer.play()
  //   // //   })
  //   // // }
  //   // if (!track.artwork) {
  //   //   getMusicPic(track.original).then(url => {
  //   //     console.log(url)
  //   //     TrackPlayer.updateMetadataForTrack(info.nextTrack, {
  //   //       artwork: url,
  //   //     })
  //   //   })
  //   // }
  // })
  // TrackPlayer.addEventListener('playback-destroy', async() => {
  //   console.log('playback-destroy')
  //   store.dispatch(playerAction.destroy())
  // })
  isInitialized = true
}


export default () => {
  if (global.lx.playerStatus.isRegisteredService) return
  console.log('handle registerPlaybackService...')
  TrackPlayer.registerPlaybackService(() => registerPlaybackService)
  global.lx.playerStatus.isRegisteredService = true
}
