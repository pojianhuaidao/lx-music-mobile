import { memo } from 'react'

import Section from '../../components/Section'
import VoiceEnabled from './VoiceEnabled'
import VoiceWakeWord from './VoiceWakeWord'
import VoiceSensitivity from './VoiceSensitivity'
import VoiceAutoStopAfterPlay from './VoiceAutoStopAfterPlay'
import VoiceWakeWordFree from './VoiceWakeWordFree'
import { useI18n } from '@/lang'

export default memo(() => {
  const t = useI18n()

  return (
    <Section title={t('setting_voice')}>
      <VoiceEnabled />
      <VoiceWakeWord />
      <VoiceWakeWordFree />
      <VoiceSensitivity />
      <VoiceAutoStopAfterPlay />
    </Section>
  )
})
