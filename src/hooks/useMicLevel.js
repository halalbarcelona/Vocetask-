import { useEffect, useRef, useState } from 'react'

const BAR_COUNT = 7

// Real amplitude sampled from the live mic stream, one value per waveform
// bar — not the decorative fixed-loop animation this replaces. A second,
// independent getUserMedia call alongside SpeechRecognition's own internal
// capture; browsers allow multiple concurrent consumers of the same mic, so
// this never competes with or interrupts recognition. If it can't get a
// stream (permission not yet granted, unsupported browser), it fails
// silently and the caller falls back to the old idle/looping visual —
// recognition itself doesn't depend on this hook at all.
export function useMicLevel(active) {
  const [levels, setLevels] = useState(() => new Array(BAR_COUNT).fill(0))
  const [isLive, setIsLive] = useState(false)
  const cleanupRef = useRef(null)

  useEffect(() => {
    if (!active) {
      setLevels(new Array(BAR_COUNT).fill(0))
      setIsLive(false)
      return undefined
    }

    let cancelled = false
    let rafId = null

    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        const audioCtx = new AudioContextClass()
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        const step = Math.floor(data.length / BAR_COUNT) || 1

        cleanupRef.current = () => {
          cancelAnimationFrame(rafId)
          stream.getTracks().forEach((track) => track.stop())
          audioCtx.close().catch(() => {})
        }

        const tick = () => {
          analyser.getByteTimeDomainData(data)
          // Time-domain samples centre on 128 during silence; distance from
          // centre is the actual instantaneous signal amplitude.
          const next = Array.from({ length: BAR_COUNT }, (_, i) => {
            const sample = data[i * step] ?? 128
            return Math.min(1, Math.abs(sample - 128) / 60)
          })
          setLevels(next)
          rafId = requestAnimationFrame(tick)
        }
        setIsLive(true)
        tick()
      })
      .catch(() => {
        // Leave levels at rest — the caller renders its own fallback state.
      })

    return () => {
      cancelled = true
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [active])

  return { levels, isLive }
}
