import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { usePremiumContext } from '../hooks/PremiumContext'
import { BackIcon, MicIcon } from '../components/icons'
import { parseVoiceCommand } from '../utils/voiceParser'
import { findBestMatchingTask, parseVoiceAction } from '../utils/voiceAction'
import { remainingFreeTasks } from '../utils/plan'
import { tomorrowISO, todayISO } from '../utils/dateUtils'

const SpeechRecognitionAPI =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined

export default function Record() {
  const navigate = useNavigate()
  const { tasks, setDraftTask, toggleDone, removeTask, updateTask } = useTasksContext()
  const { isPremium } = usePremiumContext()
  const outOfCredits = !isPremium && remainingFreeTasks(tasks) <= 0

  const location = useLocation()
  // Tapping an example on Home's empty state lands here with the phrase
  // already filled in, so the user can hit Done and see the parsing work.
  const [transcript, setTranscript] = useState(location.state?.prefill ?? '')
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef(null)

  const supportsSpeech = Boolean(SpeechRecognitionAPI)

  useEffect(() => {
    if (outOfCredits) navigate('/upgrade', { replace: true })
  }, [outOfCredits, navigate])

  useEffect(() => {
    if (!supportsSpeech) return undefined

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }
      setTranscript((finalText + ' ' + interimText).trim())
    }

    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognitionRef.current = recognition
    return () => {
      recognition.stop()
      recognitionRef.current = null
    }
  }, [supportsSpeech])

  const toggleListening = () => {
    const recognition = recognitionRef.current
    if (!recognition) return

    if (isListening) {
      recognition.stop()
      setIsListening(false)
    } else {
      setTranscript('')
      recognition.start()
      setIsListening(true)
    }
  }

  const handleDone = () => {
    recognitionRef.current?.stop()

    const action = isPremium ? parseVoiceAction(transcript) : { type: 'create' }
    if (action.type !== 'create') {
      const match = findBestMatchingTask(action.phrase, tasks)
      if (match) {
        if (action.type === 'complete') {
          toggleDone(match.id)
          navigate('/', { state: { toast: `Marked "${match.title}" as done` } })
        } else if (action.type === 'delete') {
          removeTask(match.id)
          navigate('/', { state: { toast: `Deleted "${match.title}"`, undoTask: match } })
        } else if (action.type === 'reschedule') {
          const newDate = action.newDay === 'tomorrow' ? tomorrowISO() : todayISO()
          updateTask(match.id, { date: newDate })
          navigate('/', { state: { toast: `Moved "${match.title}" to ${action.newDay}` } })
        }
        return
      }
    }

    const draft = parseVoiceCommand(transcript)
    setDraftTask({ ...draft, source: 'voice' })
    navigate('/confirm')
  }

  if (outOfCredits) return null

  return (
    <div className="screen screen--record">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">Record Task</h1>
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
              ? 'Listening… tap the mic to stop'
              : 'Tap the mic and say your task'
            : 'Voice recognition isn’t supported on this browser. Type your task instead.'}
        </p>

        {supportsSpeech ? (
          <p className="transcript">{transcript || '…'}</p>
        ) : (
          <textarea
            className="transcript-input"
            placeholder="e.g. Call mom tomorrow at 3pm"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={3}
          />
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
