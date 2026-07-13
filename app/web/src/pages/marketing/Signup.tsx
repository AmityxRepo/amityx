import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { repository } from '../../repository'
import { loadWizard, saveWizard, deriveResumeStep } from '../../features/signup/wizard'
import type { WizardState, WizardStep } from '../../features/signup/wizard'
import type { StepProps } from './signup/stepProps'
import AccountStep from './signup/AccountStep'
import VerifyStep from './signup/VerifyStep'
import HubStep from './signup/HubStep'
import ActivitiesStep from './signup/ActivitiesStep'
import ScheduleStep from './signup/ScheduleStep'
import InviteStep from './signup/InviteStep'

const PROVISIONING_ORDER: WizardStep[] = ['hub', 'activities', 'schedule', 'invites']

/**
 * Hub owner self-serve signup wizard (T-006). One job per screen (P.9 rule 1);
 * progress persists to localStorage so an interrupted signup RESUMES where it
 * left off (protects the <=15-min criterion). The resume step is reconciled with
 * the LIVE session + hub state, which are the ground truth — a stale localStorage
 * never overrides "you already have a hub" or "you're not verified yet".
 */
export default function Signup() {
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const [state, setState] = useState<WizardState>(() => loadWizard(window.localStorage))
  const [resolving, setResolving] = useState(true)
  const resolvedRef = useRef(false)

  // Persist progress after every change.
  useEffect(() => {
    saveWizard(window.localStorage, state)
  }, [state])

  // Resolve the resume step once, as soon as auth state is known.
  useEffect(() => {
    if (loading || resolvedRef.current) return
    resolvedRef.current = true
    let active = true
    ;(async () => {
      let hasHub = false
      if (session && repository) {
        try {
          hasHub = !!(await repository.getMyHub())
        } catch {
          hasHub = false
        }
      }
      if (!active) return
      const persisted = loadWizard(window.localStorage)
      const step = deriveResumeStep({ hasSession: !!session, hasHub, persistedStep: persisted.step })
      if (step === 'done') {
        navigate('/app', { replace: true })
        return
      }
      setState((s) => ({ ...s, step }))
      setResolving(false)
    })()
    return () => {
      active = false
    }
  }, [loading, session, navigate])

  const stepProps: StepProps = {
    state,
    update: (patch) => setState((s) => ({ ...s, ...patch })),
    go: (step) => setState((s) => ({ ...s, step })),
    back: () =>
      setState((s) => {
        const i = PROVISIONING_ORDER.indexOf(s.step)
        return i > 0 ? { ...s, step: PROVISIONING_ORDER[i - 1] } : s
      }),
  }

  if (loading || resolving) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground" role="status">
          Loading…
        </p>
      </div>
    )
  }

  switch (state.step) {
    case 'account':
      return <AccountStep {...stepProps} />
    case 'verify':
      return <VerifyStep {...stepProps} />
    case 'hub':
      return <HubStep {...stepProps} />
    case 'activities':
      return <ActivitiesStep {...stepProps} />
    case 'schedule':
      return <ScheduleStep {...stepProps} />
    case 'invites':
      return <InviteStep {...stepProps} />
    case 'done':
    default:
      navigate('/app', { replace: true })
      return null
  }
}
