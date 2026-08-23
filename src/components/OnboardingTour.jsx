import { useState } from 'react'
import { LayersIcon, MicIcon, SparkIcon } from './icons'

// Set once, by CreateAccount, at the exact moment a brand-new account is
// created — never by anything else. Gating on that single event, rather than
// on "an aura-onboarding-seen flag is absent," is what keeps every account
// that already existed before this feature shipped from suddenly seeing a
// "Welcome to Aura Task" tour it has no business seeing. sessionStorage (not
// localStorage) so an abandoned signup doesn't leave the tour permanently
// pending across future sessions on the same device.
const JUST_CREATED_KEY = 'aura-just-created'

export function markAccountJustCreated() {
  try {
    sessionStorage.setItem(JUST_CREATED_KEY, 'true')
  } catch {
    // sessionStorage can be unavailable (private browsing); the tour simply
    // won't show, which is a safe fallback.
  }
}

const SLIDES = [
  {
    Icon: MicIcon,
    title: 'Speak it, don’t type it',
    body: '“Kal subah 9 baje call mummy” becomes a task with the right day and time — Hinglish and Hindi both work.',
  },
  {
    Icon: LayersIcon,
    title: 'Organize like you mean it',
    body: 'Lists, labels, sections and saved filters keep things findable once you have more than a handful of tasks.',
  },
  {
    Icon: SparkIcon,
    title: 'Free forever, Premium when ready',
    body: 'Basic tasks stay free, always. A 7-day trial unlocks everything else — no card needed to start it.',
  },
]

export function shouldShowOnboarding() {
  try {
    return sessionStorage.getItem(JUST_CREATED_KEY) === 'true'
  } catch {
    return false
  }
}

function markOnboardingSeen() {
  try {
    sessionStorage.removeItem(JUST_CREATED_KEY)
  } catch {
    // Nothing to clear if sessionStorage isn't available in the first place.
  }
}

export default function OnboardingTour({ onDone }) {
  const [step, setStep] = useState(0)
  const isLast = step === SLIDES.length - 1
  const { Icon, title, body } = SLIDES[step]

  const finish = () => {
    markOnboardingSeen()
    onDone()
  }

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-label="Welcome to Aura Task">
      <div className="onboarding__sheet">
        <button type="button" className="onboarding__skip" onClick={finish}>
          Skip
        </button>

        <div className="onboarding__icon">
          <Icon width={30} height={30} />
        </div>
        <h2 className="onboarding__title">{title}</h2>
        <p className="onboarding__body">{body}</p>

        <div className="onboarding__dots">
          {SLIDES.map((_, i) => (
            <span key={i} className={`onboarding__dot${i === step ? ' onboarding__dot--active' : ''}`} />
          ))}
        </div>

        <button
          type="button"
          className="button button--primary button--wide"
          onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
        >
          {isLast ? 'Get started' : 'Next'}
        </button>
      </div>
    </div>
  )
}
