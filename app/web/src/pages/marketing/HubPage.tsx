import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapPin, Send, CalendarClock, CircleAlert } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import FormField from '../../components/ui/FormField'
import EmptyState from '../../components/ui/EmptyState'
import { repository } from '../../repository'
import type { PublicHubPageResult, PublicHubProgram, PublicHubSession } from '../../repository/schema'
import { capacityLabel, isFull } from '../../features/roster/capacity'
import { AGE_BANDS, ageBandLabel, ageRangeLabel } from '../../features/booking/ageBands'
import { shouldSilentlyDrop } from '../../features/booking/antiSpam'

type LoadState = 'loading' | 'ready' | 'not_found' | 'error'

/** Sets (and, on unmount, restores) document.title + a handful of <meta> tags so
 * a shared /h/{slug} link previews with the hub's own name — a lightweight,
 * dependency-free stand-in for react-helmet (this is a CSR SPA; a crawler that
 * doesn't execute JS still sees the site-wide default from index.html, same
 * limitation every route in this SPA has today). */
function usePageMeta(title: string | null, description: string | null) {
  useEffect(() => {
    if (!title) return
    const prevTitle = document.title
    const prevMeta = new Map<string, string | null>()

    function setMeta(selector: string, attr: string, key: string, content: string) {
      let el = document.head.querySelector<HTMLMetaElement>(selector)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
        prevMeta.set(selector, null) // marks "we created it" -> remove on cleanup
      } else if (!prevMeta.has(selector)) {
        prevMeta.set(selector, el.getAttribute('content'))
      }
      el.setAttribute('content', content)
    }

    document.title = title
    const desc = description ?? title
    setMeta('meta[name="description"]', 'name', 'description', desc)
    setMeta('meta[property="og:title"]', 'property', 'og:title', title)
    setMeta('meta[property="og:description"]', 'property', 'og:description', desc)
    setMeta('meta[property="og:url"]', 'property', 'og:url', window.location.href)

    return () => {
      document.title = prevTitle
      for (const [selector, prevContent] of prevMeta) {
        const el = document.head.querySelector<HTMLMetaElement>(selector)
        if (!el) continue
        if (prevContent === null) el.remove()
        else el.setAttribute('content', prevContent)
      }
    }
  }, [title, description])
}

interface Selection {
  programId: string
  sessionId: string | null
  label: string
}

function formatSessionTime(session: PublicHubSession, timezone: string): string {
  try {
    return new Date(session.starts_at).toLocaleString('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return new Date(session.starts_at).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }
}

/**
 * /h/{slug} (T-010) — public, unauthenticated, single scroll, no nav (P.9 rule 6).
 * One job: let a parent see this hub's activities and request a spot. Reads via
 * the get_public_hub_page RPC (curated anon read, see its migration); writes via
 * submitBookingRequest (anon INSERT, T-005's rate-limit trigger is the real gate).
 */
export default function HubPage() {
  const { slug } = useParams<{ slug: string }>()
  const [status, setStatus] = useState<LoadState>('loading')
  const [data, setData] = useState<Extract<PublicHubPageResult, { ok: true }> | null>(null)

  const [selection, setSelection] = useState<Selection | null>(null)
  const [childName, setChildName] = useState('')
  const [ageBand, setAgeBand] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const openedAtRef = useRef(Date.now())
  const formRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!repository || !slug) {
        setStatus('error')
        return
      }
      setStatus('loading')
      try {
        const result = await repository.getPublicHubPage(slug)
        if (cancelled) return
        if (!result.ok) {
          setStatus('not_found')
          return
        }
        setData(result)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [slug])

  const pageTitle = data ? `${data.hub.name} — Book a spot | Amityx` : null
  const pageDescription = data
    ? `See activities and request a spot at ${data.hub.name}${data.hub.city ? ` in ${data.hub.city}` : ''}.`
    : null
  usePageMeta(pageTitle, pageDescription)

  function chooseActivity(program: PublicHubProgram, session: PublicHubSession | null) {
    const label = session
      ? `${program.name} · ${formatSessionTime(session, data?.hub.timezone ?? 'America/Los_Angeles')}`
      : program.name
    setSelection({ programId: program.id, sessionId: session?.id ?? null, label })
    setFormError(null)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!repository || !data) return
    if (submitted || submitting) return // idempotent-friendly: a second tap just re-shows thank-you below

    if (!childName.trim() || !ageBand || !guardianName.trim() || !guardianEmail.trim()) {
      setFormError('Fill in the child’s name, age, your name, and your email to continue.')
      return
    }

    setFormError(null)
    setSubmitting(true)

    // Anti-spam (D-014, no paid captcha): a tripped honeypot or an implausibly
    // fast submit is dropped silently — the visitor still sees "thank you"
    // (never tip off a bot; the per-hub/day rate-limit trigger is the real gate).
    const dropSilently = shouldSilentlyDrop({
      honeypotValue: honeypot,
      openedAtMs: openedAtRef.current,
      submittedAtMs: Date.now(),
    })

    try {
      if (!dropSilently) {
        await repository.submitBookingRequest({
          hubId: data.hub.id,
          childName: childName.trim(),
          guardianName: guardianName.trim(),
          guardianEmail: guardianEmail.trim(),
          guardianPhone: guardianPhone.trim() || undefined,
          programId: selection?.programId,
          sessionId: selection?.sessionId ?? undefined,
          message: `Age band: ${ageBandLabel(ageBand)}`,
        })
      }
      setSubmitted(true)
    } catch {
      // A real failure (network, or the hub hit its daily request cap) — plain
      // language + what to do next (P.9 rule 8), form stays filled, never a wall.
      setFormError("That didn't go through. Check your connection and try again in a moment.")
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-base text-muted-foreground" role="status">
          Loading…
        </p>
      </div>
    )
  }

  if (status === 'not_found' || status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <EmptyState
          icon={CircleAlert}
          title="We couldn’t find that page"
          description="This booking link may be out of date. Double-check the link, or ask the hub for a fresh one."
        />
      </div>
    )
  }

  if (!data) return null
  const { hub, programs } = data

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{hub.name}</h1>
          {(hub.city || hub.state) && (
            <p className="flex items-center gap-1.5 text-base text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              {[hub.address, [hub.city, hub.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="text-base text-muted-foreground">Request a spot below — no account needed.</p>
        </header>

        <section className="space-y-4" aria-labelledby="activities-heading">
          <h2 id="activities-heading" className="text-2xl font-semibold">
            Activities
          </h2>

          {programs.length === 0 && (
            <EmptyState
              icon={CalendarClock}
              title="No activities listed yet"
              description="Check back soon, or use the form below to ask about a spot."
            />
          )}

          <ul className="space-y-4">
            {programs.map((program) => {
              const ageText = ageRangeLabel(program.age_min_months, program.age_max_months)
              const programFull = isFull({ capacity: program.capacity, activeCount: program.active_count })
              return (
                <li key={program.id}>
                  <Card>
                    <CardContent className="space-y-3 p-4">
                      <div>
                        <p className="text-lg font-semibold">{program.name}</p>
                        {program.description && <p className="text-sm text-muted-foreground">{program.description}</p>}
                        {ageText && (
                          <p className="mt-1 text-sm text-muted-foreground">Ages {ageText}</p>
                        )}
                      </div>

                      {program.sessions.length === 0 ? (
                        <div className="flex items-center justify-between gap-3">
                          <Badge variant={programFull ? 'warning' : 'neutral'}>
                            {capacityLabel({ capacity: program.capacity, activeCount: program.active_count })}
                          </Badge>
                          <Button
                            size="sm"
                            variant={programFull ? 'outline' : 'primary'}
                            icon={Send}
                            onClick={() => chooseActivity(program, null)}
                          >
                            {programFull ? 'Join waitlist' : 'Request to join'}
                          </Button>
                        </div>
                      ) : (
                        <ul className="space-y-2 border-t border-border pt-3">
                          {program.sessions.map((session) => {
                            const full = isFull({ capacity: session.capacity, activeCount: session.active_count })
                            return (
                              <li key={session.id} className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium">{formatSessionTime(session, hub.timezone)}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {session.location ? `${session.location} · ` : ''}
                                    {capacityLabel({ capacity: session.capacity, activeCount: session.active_count })}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant={full ? 'outline' : 'primary'}
                                  icon={Send}
                                  onClick={() => chooseActivity(program, session)}
                                >
                                  {full ? 'Join waitlist' : 'Request to join'}
                                </Button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </li>
              )
            })}
          </ul>
        </section>

        <section ref={formRef} className="space-y-4 scroll-mt-4" aria-labelledby="request-heading">
          <h2 id="request-heading" className="text-2xl font-semibold">
            Request a spot
          </h2>

          {submitted ? (
            <Card>
              <CardContent className="space-y-2 p-5 text-center">
                <p className="text-lg font-semibold">Thanks — request sent!</p>
                <p className="text-base text-muted-foreground">
                  {hub.name} will reach out to you soon. No account or app needed.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-4">
                <form className="space-y-4" onSubmit={onSubmit} noValidate>
                  {selection && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted p-3 text-sm">
                      <span>
                        Requesting: <strong>{selection.label}</strong>
                      </span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setSelection(null)}>
                        Change
                      </Button>
                    </div>
                  )}

                  <FormField label="Child’s first name" htmlFor="child-name" required>
                    <Input
                      id="child-name"
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      placeholder="e.g. Mia"
                      autoComplete="off"
                    />
                  </FormField>

                  <FormField label="Child’s age" htmlFor="child-age" required>
                    <Select id="child-age" value={ageBand} onChange={(e) => setAgeBand(e.target.value)}>
                      <option value="">Choose an age range…</option>
                      {AGE_BANDS.map((b) => (
                        <option key={b.key} value={b.key}>
                          {b.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  {!selection && programs.length > 0 && (
                    <FormField label="Which activity?" htmlFor="activity-pick" hint="Optional — pick one above, or tell us here.">
                      <Select
                        id="activity-pick"
                        value=""
                        onChange={(e) => {
                          const p = programs.find((pr) => pr.id === e.target.value)
                          if (p) chooseActivity(p, null)
                        }}
                      >
                        <option value="">Not sure yet</option>
                        {programs.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  )}

                  <FormField label="Your name" htmlFor="guardian-name" required>
                    <Input id="guardian-name" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} autoComplete="name" />
                  </FormField>

                  <FormField label="Your email" htmlFor="guardian-email" required>
                    <Input
                      id="guardian-email"
                      type="email"
                      value={guardianEmail}
                      onChange={(e) => setGuardianEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </FormField>

                  <FormField label="Your phone" htmlFor="guardian-phone" hint="Optional.">
                    <Input
                      id="guardian-phone"
                      type="tel"
                      value={guardianPhone}
                      onChange={(e) => setGuardianPhone(e.target.value)}
                      autoComplete="tel"
                    />
                  </FormField>

                  {/* Honeypot: a normal, still-focusable field a real visitor never sees
                   * (visually hidden off-screen, not display:none — see antiSpam.mjs). A
                   * naive bot that blindly fills every input trips this; a human never
                   * reaches it (tabIndex -1 + aria-hidden skip it for keyboard/AT users). */}
                  <div className="sr-only" aria-hidden="true">
                    <label htmlFor="hp-website">Leave this field blank</label>
                    <input
                      id="hp-website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>

                  {formError && (
                    <p className="text-sm text-destructive" role="alert">
                      {formError}
                    </p>
                  )}

                  <Button type="submit" icon={Send} disabled={submitting} className="w-full">
                    {submitting ? 'Sending…' : 'Request a spot'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </section>

        <footer className="border-t border-border pt-6 text-center">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Powered by Amityx
          </a>
        </footer>
      </div>
    </div>
  )
}
