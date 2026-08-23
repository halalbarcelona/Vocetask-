import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTasksContext } from '../hooks/TasksContext'
import { useCategoriesContext } from '../hooks/CategoriesContext'
import { useLabelsContext } from '../hooks/LabelsContext'
import { fixSpeech } from '../utils/speechFix'
import { parseVoiceCommand } from '../utils/voiceParser'
import { parseQuickAddSyntax } from '../utils/quickAddSyntax'

// Reached when the OS "Share to…" sheet sends text from another app here —
// the manifest's share_target hands title/text/url over as query params on a
// GET. Runs the shared text through the same #list @label !priority shorthand
// and Hinglish parser typed/voice input already get, so "kal 5pm #Work
// dentist" shared from a message parses a date, category, and title just like
// typing or saying it into the app would.
export default function ShareTarget() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { setDraftTask } = useTasksContext()
  const { categories } = useCategoriesContext()
  const { labels } = useLabelsContext()

  useEffect(() => {
    const title = params.get('title') ?? ''
    const text = params.get('text') ?? ''
    const url = params.get('url') ?? ''
    const combined = [text || title, url].filter(Boolean).join(' ').trim()
    const syntax = parseQuickAddSyntax(combined, { categories, labels: labels.map((l) => l.name) })
    const draft = parseVoiceCommand(fixSpeech(syntax.title || combined))
    setDraftTask({
      ...draft,
      category: syntax.category ?? draft.category,
      priority: syntax.priority ?? draft.priority,
      labels: syntax.labels,
      source: 'share',
    })
    navigate('/confirm', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
