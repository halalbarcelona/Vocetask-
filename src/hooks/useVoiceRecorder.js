import { useCallback, useRef, useState } from 'react'

// Capped so a note stays a quick memo, not a monologue — at ~1-2KB/sec for
// opus-encoded speech, 60s keeps the base64 payload well within what
// localStorage and a Postgres text column comfortably hold.
const MAX_SECONDS = 60

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

// Records a short voice memo and resolves it as a base64 data URL — no
// backend, no file handling, just a string that slots into a task like any
// other field. Voice notes stay device-local for now (not part of the
// tasks sync payload); syncing binary audio across devices is a bigger
// problem — bandwidth, storage limits — that deserves its own pass.
export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)

  const isSupported =
    typeof window !== 'undefined' && Boolean(window.MediaRecorder) && Boolean(navigator.mediaDevices?.getUserMedia)

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const start = useCallback(async () => {
    if (!isSupported || isRecording) return
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) recorder.stop()
          return s + 1
        })
      }, 1000)
    } catch {
      setError('mic-denied')
    }
  }, [isSupported, isRecording])

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        resolve(null)
        return
      }
      recorder.onstop = () => {
        clearInterval(timerRef.current)
        releaseStream()
        setIsRecording(false)
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        chunksRef.current = []
        const reader = new FileReader()
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
        reader.readAsDataURL(blob)
      }
      recorder.stop()
    })
  }, [])

  const cancel = useCallback(() => {
    clearInterval(timerRef.current)
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.stop()
    }
    releaseStream()
    chunksRef.current = []
    setIsRecording(false)
    setSeconds(0)
  }, [])

  return { isSupported, isRecording, seconds, error, start, stop, cancel, maxSeconds: MAX_SECONDS }
}
