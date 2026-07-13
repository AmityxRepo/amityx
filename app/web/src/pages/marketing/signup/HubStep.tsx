import { useEffect, useRef, useState } from 'react'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import FormField from '../../../components/ui/FormField'
import WizardShell from './WizardShell'
import type { StepProps } from './stepProps'
import { repository } from '../../../repository'
import { slugify, isValidSlug, withSuffix } from '../../../features/signup/slug'

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'unknown'

/** Step 3 — name the hub. The public address is auto-derived from the name,
 * collision-checked live, and editable; a taken address auto-suggests a free
 * alternative (P.9 rule 8 — never a dead end). */
export default function HubStep({ state, update, go }: StepProps) {
  const [name, setName] = useState(state.hub.name)
  const [slug, setSlug] = useState(state.hub.slug || slugify(state.hub.name))
  const [slugEdited, setSlugEdited] = useState(!!state.hub.slug)
  const [status, setStatus] = useState<SlugStatus>('idle')
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const seq = useRef(0)

  function onNameChange(value: string) {
    setName(value)
    if (!slugEdited) setSlug(slugify(value))
  }

  function onSlugChange(value: string) {
    setSlugEdited(true)
    setSlug(value.toLowerCase())
  }

  // Debounced live availability check against the slug_available RPC.
  useEffect(() => {
    setSuggestion(null)
    if (!slug) {
      setStatus('idle')
      return
    }
    if (!isValidSlug(slug)) {
      setStatus('invalid')
      return
    }
    if (!repository) {
      setStatus('unknown')
      return
    }
    const repo = repository
    const mine = ++seq.current
    setStatus('checking')
    const t = setTimeout(async () => {
      try {
        const ok = await repo.isSlugAvailable(slug)
        if (mine !== seq.current) return
        if (ok) {
          setStatus('available')
        } else {
          setStatus('taken')
          void suggestFree(slug, mine, repo)
        }
      } catch {
        // RPC not reachable yet (schema not applied) — let provisioning be the
        // final arbiter instead of blocking the wizard here.
        if (mine === seq.current) setStatus('unknown')
      }
    }, 400)
    return () => clearTimeout(t)
  }, [slug])

  async function suggestFree(base: string, mine: number, repo: NonNullable<typeof repository>) {
    for (let n = 2; n < 8; n++) {
      const candidate = withSuffix(base, n)
      try {
        if (await repo.isSlugAvailable(candidate)) {
          if (mine === seq.current) setSuggestion(candidate)
          return
        }
      } catch {
        return
      }
    }
  }

  const canContinue = name.trim().length >= 2 && isValidSlug(slug) && (status === 'available' || status === 'unknown')

  function onContinue() {
    update({ hub: { name: name.trim(), slug, timezone: state.hub.timezone }, step: 'activities' })
    go('activities')
  }

  const host = typeof window !== 'undefined' ? window.location.host : 'amityx.app'

  return (
    <WizardShell
      stepNumber={3}
      totalSteps={6}
      title="Name your hub"
      description="Your business name is what families see on your booking page."
      footer={
        <Button type="button" onClick={onContinue} disabled={!canContinue}>
          Continue
        </Button>
      }
    >
      <FormField label="Hub name" htmlFor="hubName" required hint="For example, Sunny Sprouts.">
        <Input id="hubName" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Sunny Sprouts" required />
      </FormField>

      <FormField
        label="Public address"
        htmlFor="hubSlug"
        required
        hint={`Families will book at ${host}/${slug || 'your-hub'}`}
        error={
          status === 'invalid'
            ? 'Use 3–40 lowercase letters, numbers, and hyphens.'
            : status === 'taken'
              ? 'That address is already taken. Pick another below.'
              : undefined
        }
      >
        <Input
          id="hubSlug"
          value={slug}
          onChange={(e) => onSlugChange(e.target.value)}
          invalid={status === 'invalid' || status === 'taken'}
          placeholder="sunny-sprouts"
        />
      </FormField>

      <p className="text-sm" aria-live="polite">
        {status === 'checking' && <span className="text-muted-foreground">Checking availability…</span>}
        {status === 'available' && <span className="text-success">This address is available.</span>}
        {status === 'unknown' && <span className="text-muted-foreground">We'll confirm this address when your hub is created.</span>}
      </p>

      {suggestion && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setSlugEdited(true)
            setSlug(suggestion)
          }}
        >
          Use {suggestion}
        </Button>
      )}
    </WizardShell>
  )
}
