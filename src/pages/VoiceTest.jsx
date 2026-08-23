import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackIcon, MicIcon } from '../components/icons'
import { useVoiceLang, VOICE_LANGS } from '../hooks/useVoiceLang'
import { fixSpeech } from '../utils/speechFix'
import { parseVoiceCommand } from '../utils/voiceParser'

const SpeechRecognitionAPI =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined

// Shows every stage between the microphone and the saved task, because "it
// doesn't get it right" can break at any one of them and they need different
// fixes: the engine mis-heard, the correction table has no rule for it, or the
// parser didn't recognise a phrasing. Without seeing the stages you are
// guessing, and a guessed correction rule is worse than none.
export default function VoiceTest() {
  const navigate = useNavigate()
  const { lang, setLang } = useVoiceLang()
  const [alternatives, setAlternatives] = useState([])
  const [isListening, setIsListening] = useState(false)
  const [status, setStatus] = useState('')
  const [copied, setCopied] = useState(false)
  const recognitionRef = useRef(null)

  const supportsSpeech = Boolean(SpeechRecognitionAPI)

  useEffect(() => {
    if (!supportsSpeech) return undefined

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 5
    recognition.lang = lang

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1]
      const list = []
      for (let i = 0; i < result.length; i++) {
        list.push({ text: result[i].transcript, confidence: result[i].confidence ?? null })
      }
      setAlternatives(list)
      setStatus(list.length ? '' : 'Nothing came back.')
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = (event) => {
      setIsListening(false)
      setStatus(`Engine error: ${event.error}`)
    }

    recognitionRef.current = recognition
    return () => {
      recognition.onend = null
      recognition.stop()
      recognitionRef.current = null
    }
  }, [supportsSpeech, lang])

  const listen = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }
    setAlternatives([])
    setStatus('')
    setCopied(false)
    try {
      recognitionRef.current?.start()
      setIsListening(true)
    } catch {
      setStatus('Could not start the mic. Tap again.')
    }
  }

  const top = alternatives[0]?.text ?? ''
  const corrected = fixSpeech(top)
  const parsed = top ? parseVoiceCommand(corrected) : null

  const report = [
    `lang: ${lang}`,
    `ua: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'}`,
    '',
    'heard:',
    ...alternatives.map((a, i) => `  ${i + 1}. "${a.text}"${a.confidence == null ? '' : ` (${a.confidence.toFixed(2)})`}`),
    '',
    `corrected: "${corrected}"`,
    parsed
      ? `parsed: title="${parsed.title}" date=${parsed.date} time="${parsed.time}" category=${parsed.category} recurrence=${parsed.recurrence} priority=${parsed.priority}`
      : 'parsed: —',
  ].join('\n')

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setStatus('Couldn’t copy — select the text above instead.')
    }
  }

  return (
    <div className="screen">
      <header className="page-header">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
          <BackIcon />
        </button>
        <h1 className="page-header__title">Voice test</h1>
        <span className="icon-button icon-button--spacer" />
      </header>

      <main className="screen__content">
        <p className="confirm-hint">
          Say a task the way you normally would. This shows exactly what the mic heard and what the app
          made of it — so a wrong result can be traced to the step that got it wrong.
        </p>

        <div className="lang-row" role="group" aria-label="Voice language">
          {VOICE_LANGS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`lang-chip${lang === option.value ? ' lang-chip--active' : ''}`}
              onClick={() => setLang(option.value)}
              aria-pressed={lang === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`button button--primary button--wide${isListening ? ' button--listening' : ''}`}
          onClick={listen}
          disabled={!supportsSpeech}
        >
          <MicIcon width={16} height={16} /> {isListening ? 'Listening — tap to stop' : 'Tap and speak'}
        </button>

        {!supportsSpeech && (
          <p className="record-error">This browser has no speech recognition. Try Chrome, or Safari on iOS 14.5+.</p>
        )}
        {status && <p className="record-error">{status}</p>}

        {alternatives.length > 0 && (
          <>
            <section className="settings-group">
              <h2 className="section-title">What the mic heard</h2>
              <div className="card">
                {alternatives.map((alt, i) => (
                  <div key={`${alt.text}-${i}`} className="diag-row">
                    <span className="diag-row__value">“{alt.text}”</span>
                    {alt.confidence != null && (
                      <span className="diag-row__meta">{Math.round(alt.confidence * 100)}%</span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="settings-group">
              <h2 className="section-title">After correction</h2>
              <div className="card">
                <div className="diag-row">
                  <span className="diag-row__value">
                    {corrected === top ? `${corrected} (unchanged)` : corrected}
                  </span>
                </div>
              </div>
            </section>

            <section className="settings-group">
              <h2 className="section-title">What the app understood</h2>
              <div className="card">
                {[
                  ['Task', parsed.title || '—'],
                  ['Date', parsed.date],
                  ['Time', parsed.time || '—'],
                  ['List', parsed.category],
                  ['Repeat', parsed.recurrence],
                  ['Priority', parsed.priority],
                ].map(([label, value]) => (
                  <div key={label} className="diag-row">
                    <span className="diag-row__meta">{label}</span>
                    <span className="diag-row__value">{value}</span>
                  </div>
                ))}
              </div>
            </section>

            <button type="button" className="button button--light button--wide" onClick={copyReport}>
              {copied ? 'Copied' : 'Copy report'}
            </button>
            <p className="record-hint record-hint--upsell">
              Paste that anywhere to report a wrong result. It contains only this one phrase.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
