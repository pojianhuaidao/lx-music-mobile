import { collectMusic, dislikeMusic, pause, play, playNext, playPrev, togglePlay, uncollectMusic } from '@/core/player/player'

export type PlayerAction = 'play' | 'pause' | 'skipNext' | 'skipPrev' | 'togglePlay' | 'collect' | 'uncollect' | 'dislike'

export const handlePlayerAction = async(action: PlayerAction) => {
  switch (action) {
    case 'play':
      play()
      break
    case 'pause':
      void pause().catch((err) => {
        console.log('[playerAction] pause failed', err)
      })
      break
    case 'skipNext':
      void playNext().catch((err) => {
        console.log('[playerAction] playNext failed', err)
      })
      break
    case 'skipPrev':
      void playPrev().catch((err) => {
        console.log('[playerAction] playPrev failed', err)
      })
      break
    case 'togglePlay':
      togglePlay()
      break
    case 'collect':
      collectMusic()
      break
    case 'uncollect':
      uncollectMusic()
      break
    case 'dislike':
      void dislikeMusic().catch((err) => {
        console.log('[playerAction] dislikeMusic failed', err)
      })
      break
    // default: throw new Error('Unknown action: ' + (action as any ?? ''))
  }
}
