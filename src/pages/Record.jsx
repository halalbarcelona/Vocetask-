import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import { BackIcon, MicIcon } from '../components/icons'
import { parseConfidence, parseVoiceCommand } from '../utils/voiceParser'
import { findBestMatchingTask, parseVoiceAction } from '../utils/voiceAction'
import { fixSpeech } from '../utils/speechFix'
import { otherLang, useVoiceLang, VOICE_LANGS } from '../hooks/useVoiceLang'

// Speech engines rank alternatives by acoustic confidence, which handles
// code-switched Hindi-English badly — the top pick is often the one our
// parser can make least sense of. Asking for several and keeping the one
// that yields the most structure is a free accuracy win.
const MAX_ALTERNATIVES = 4

// Same phrases the Home empty state offers. Tapping one fills the transcript,
// so a user who won't speak in public can still see the Hinglish parsing work.
const VOICE_EXAMPLES = [
  'kal subah 9 baje call mummy',
  'aaj shaam 6 baje gym',
  'Team meeting tomorrow at 3pm',
]

// Every alternative is repaired before it is scored. Without that, the
// candidate that happens to contain "9 budget" scores zero and loses to a
// worse-heard one, even though the repaired form is the best of the batch.
// The engine's own confidence only breaks ties — it is the number that ranked
// the alternatives wrong in the first place.
function bestAlternative(result) {
  let best = ''
  let bestScore = -Infinity

  for (let i = 0; i < result.length; i++) {
    const candidate = result[i]?.transcript
    if (!candidate) continue
    const score = parseConfidence(fixSpeech(candidate)) + (result[i].confidence ?? 0) * 0.4
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }

  return best
}

const SpeechRecognitionAPI =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined

export default function Record() {
  const navigate = useNavigate()
  const { tasks, setDraftTask, toggleDone, removeTask, updateTask } = useTasksContext()
  const { isPremium } = usePremiumContext()

  const location = useLocation()
  // Tapping an example on Home's empty state lands here with the phrase
  // already filled in, so the user can hit Done and see the parsing work.
  const [transcript, setTranscript] = useState(location.state?.prefill ?? '')
  const [isListening, setIsListening] = useState(false)
  const [micError, setMicError] = useState('')
  const recognitionRef = useRef(null)
  // The engine's onend fires for an ordinary silence gap as well as for a real
  // stop, and the handler can't tell them apart. This ref carries the user's
  // intent across that boundary.
  const wantsToListenRef = useRef(false)
  // Set when the recogniser is about to be rebuilt on a new language and should
  // start listening as soon as it exists.
  const autoStartRef = useRef(false)
  // Text finalised in earlier sessions. A restarted recogniser hands back an
  // empty results list, so anything already said has to be kept out here or the
  // next onresult overwrites it.
  const committedRef = useRef('')
  // Final text of the session running right now, so it can be committed at the
  // moment that session ends.
  const sessionFinalRef = useRef('')
  const restartTimerRef = useRef(null)
  // Guards against a recogniser that ends the instant it starts — Safari does
  // this when it has nothing to listen to, and an unthrottled restart spins.
  const emptyRestartsRef = useRef(0)

  const { lang, setLang } = useVoiceLang()
  const supportsSpeech = Boolean(SpeechRecognitionAPI)

  useEffect(() => {
    if (!supportsSpeech) return undefined

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = MAX_ALTERNATIVES
    recognition.lang = lang

    recognition.onresult = (event) => {
      const finalParts = []
      const interimParts = []
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        // Only finalised results carry meaningful alternatives; interim ones
        // change on every frame, so scoring them just causes flicker.
        if (result.isFinal) {
          finalParts.push(bestAlternative(result))
        } else {
          interimParts.push(result[0].transcript)
        }
      }
      // Joined, not concatenated: the engine does not promise leading spaces,
      // and two phrases run together are two words the parser will never match.
      const finalText = finalParts.join(' ')
      const interimText = interimParts.join(' ')
      emptyRestartsRef.current = 0
      sessionFinalRef.current = finalText
      setTranscript([committedRef.current, finalText, interimText].join(' ').replace(/\s+/g, ' ').trim())
    }

    // Chrome ends the session after a few seconds of silence, which cut people
    // off mid-sentence — they pause to think and the mic is simply gone. If the
    // user hasn't tapped stop, start it again.
    recognition.onend = () => {
      // Whatever this session finalised has to move somewhere durable first:
      // the next session's results start empty and would otherwise replace it.
      if (sessionFinalRef.current) {
        committedRef.current = `${committedRef.current} ${sessionFinalRef.current}`.replace(/\s+/g, ' ').trim()
        sessionFinalRef.current = ''
      }

      if (!wantsToListenRef.current) {
        setIsListening(false)
        return
      }

      // A session can end without hearing anything for two very different
      // reasons, and they need opposite responses.
      emptyRestartsRef.current += 1
      const heardSomething = Boolean(committedRef.current)

      // Already have words and the user has gone quiet for a while: they are
      // done talking. Stop cleanly — this is also how Safari behaves, where a
      // session ends after every single utterance rather than on silence.
      if (heardSomething && emptyRestartsRef.current > 3) {
        wantsToListenRef.current = false
        setIsListening(false)
        return
      }

      // Never heard anything at all: the engine is refusing to run rather than
      // waiting on speech. Say so instead of spinning.
      if (!heardSomething && emptyRestartsRef.current > 8) {
        wantsToListenRef.current = false
        setIsListening(false)
        setMicError('The mic isn’t picking anything up. Check your browser’s mic permission, or type the task below.')
        return
      }

      restartTimerRef.current = setTimeout(() => {
        if (!wantsToListenRef.current) return
        try {
          recognition.start()
        } catch {
          // start() throws while the previous session is still tearing down.
          // The next onend brings us back here.
        }
      }, 250)
    }

    recognition.onerror = (event) => {
      // no-speech and aborted are ordinary parts of a session — onend restarts
      // from them. Only a permission or device failure ends it, and that one
      // needs saying out loud instead of a mic that silently does nothing.
      if (event.error === 'no-speech' || event.error === 'aborted') return

      wantsToListenRef.current = false
      setIsListening(false)
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setMicError('Microphone access is blocked. Allow it in your browser settings, or type the task below.')
      } else if (event.error === 'network') {
        setMicError('Speech recognition needs a connection. Type the task below instead.')
      } else {
        setMicError('Didn’t catch that. Try again, or type it below.')
      }
    }

    recognitionRef.current = recognition

    if (autoStartRef.current) {
      autoStartRef.current = false
      setMicError('')
      committedRef.current = ''
      sessionFinalRef.current = ''
      emptyRestartsRef.current = 0
      wantsToListenRef.current = true
      try {
        recognition.start()
        setIsListening(true)
      } catch {
        wantsToListenRef.current = false
      }
    }

    return () => {
      wantsToListenRef.current = false
      clearTimeout(restartTimerRef.current)
      recognition.onend = null
      recognition.stop()
      recognitionRef.current = null
    }
  }, [supportsSpeech, lang])

  const stopListening = () => {
    wantsToListenRef.current = false
    clearTimeout(restartTimerRef.current)
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  const startListening = () => {
    const recognition = recognitionRef.current
    if (!recognition) return
    setMicError('')
    setTranscript('')
    committedRef.current = ''
    sessionFinalRef.current = ''
    emptyRestartsRef.current = 0
    wantsToListenRef.current = true
    try {
      recognition.start()
      setIsListening(true)
    } catch {
      // start() throws if the previous session hasn't fully ended yet.
      wantsToListenRef.current = false
    }
  }

  const toggleListening = () => (isListening ? stopListening() : startListening())

  // If nothing structural came out of what was heard — no time, no date, the
  // whole utterance sitting in the title — the most likely cause is the wrong
  // language model, not a bad phrasing. Say so at the moment it happens rather
  // than leaving a quiet link the user has no reason to notice.
  const looksMisheard = transcript.trim().length > 0 && parseConfidence(fixSpeech(transcript)) < 1

  // Retrying in the other model is the fastest fix for a bad transcript, so it
  // is one tap: switch the language and immediately listen again.
  const retryInOtherLang = () => {
    stopListening()
    setTranscript('')
    setMicError('')
    autoStartRef.current = true
    setLang(otherLang(lang))
  }

  const handleDone = () => {
    stopListening()

    // Everything downstream — actions, matching, the task parser — reads the
    // repaired transcript, never the raw one.
    const spoken = fixSpeech(transcript)
    const action = isPremium ? parseVoiceAction(spoken) : { type: 'create' }
    if (action.type !== 'create') {
      // Deleting is destructive, so demand a clearly stronger match than
      // completing or rescheduling before acting on it.
      const match = findBestMatchingTask(action.phrase, tasks, {
        minScore: action.type === 'delete' ? 0.7 : 0.5,
      })
      if (match) {
        if (action.type === 'complete') {
          toggleDone(match.id)
          navigate('/', { state: { toast: `Marked "${match.title}" as done` } })
        } else if (action.type === 'delete') {
          removeTask(match.id)
          navigate('/', { state: { toast: `Deleted "${match.title}"`, undoTask: match } })
        } else if (action.type === 'reschedule') {
          // Reuse the task parser's date logic so reschedule understands
          // every day word it does — "parso", weekday names, Devanagari.
          const { date } = parseVoiceCommand(action.newDay)
          updateTask(match.id, { date })
          navigate('/', { state: { toast: `Moved "${match.title}" to ${action.newDay}` } })
        }
        return
      }
    }

    const draft = parseVoiceCommand(spoken)
    setDraftTask({ ...draft, source: 'voice' })
    navigate('/confirm')
  }

  return (
    <div className="screen screen--record">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">Record task</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content screen__content--center">
        <button
          type="button"
          className={`mic-button${isListening ? ' mic-button--active' : ''}`}
          onClick={toggleListening}
          disabled={!supportsSpeech}
          aria-label={isListening ? 'Stop recording' : 'Start recording'}
        >
          <MicIcon width={40} height={40} />
        </button>

        <div className={`waveform${isListening ? ' waveform--active' : ''}`} aria-hidden="true">
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} className="waveform__bar" style={{ animationDelay: `${i * 0.09}s` }} />
          ))}
        </div>

        <p className="record-hint">
          {supportsSpeech
            ? isListening
              ? 'Listening… take your time, then tap the mic'
              : 'Tap the mic and say your task'
            : 'Voice recognition isn’t supported on this browser. Type your task instead.'}
        </p>

        {micError && <p className="record-error">{micError}</p>}

        {supportsSpeech && !isListening && (
          <div className="lang-row" role="group" aria-label="Voice language">
            {VOICE_LANGS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`lang-chip${lang === option.value ? ' lang-chip--active' : ''}`}
                onClick={() => setLang(option.value)}
                aria-pressed={lang === option.value}
                title={option.hint}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {/* Always editable. A transcript that is one word wrong is far faster to
            fix here than to re-record, and it is the difference between the mic
            feeling accurate and feeling broken. */}
        <textarea
          className="transcript-input"
          placeholder={supportsSpeech ? 'Your words appear here — edit anything that came out wrong' : 'e.g. Call mummy tomorrow at 3pm'}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={3}
        />

        {supportsSpeech && transcript.trim() && (
          <button
            type="button"
            className={looksMisheard ? 'retry-nudge' : 'link-button'}
            onClick={retryInOtherLang}
          >
            <MicIcon width={13} height={13} />
            {looksMisheard
              ? `Not what you said? Say it again in ${otherLang(lang) === 'hi-IN' ? 'हिंदी' : 'Hinglish'}`
              : `Came out wrong? Say it again in ${otherLang(lang) === 'hi-IN' ? 'हिंदी' : 'Hinglish'}`}
          </button>
        )}

        {supportsSpeech && !transcript.trim() && (
          <div className="record-examples">
            <p className="record-examples__label">Things you can say</p>
            {VOICE_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="example-chip"
                onClick={() => setTranscript(example)}
              >
                <MicIcon width={13} height={13} /> “{example}”
              </button>
            ))}
          </div>
        )}

        <button type="button" className="button button--primary button--wide" onClick={handleDone} disabled={!transcript.trim()}>
          Done
        </button>

        {!isPremium && (
          <p className="record-hint record-hint--upsell">
            Premium can also mark tasks done, delete, or reschedule them by voice.
          </p>
        )}
      </main>
    </div>
  )
}
