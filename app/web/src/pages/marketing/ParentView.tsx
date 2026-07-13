import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarClock, Image as ImageIcon, Megaphone, CircleAlert, Baby } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import { repository } from '../../repository'
import type { GuardianFeedResult } from '../../repository/schema'

type ReadyFeed = Extract<GuardianFeedResult, { ok: true }>
type LoadState = 'loading' | 'ready' | 'invalid' | 'expired' | 'revoked' | 'error'

function formatWhen(iso: string, end: string | null): string {
  const start = new Date(iso)
  const startLabel = start.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  if (!end) return startLabel
  const endLabel = new Date(end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${startLabel} – ${endLabel}`
}

/**
 * /g/{token} (T-011) — the no-account, no-install family view. A parent opens the
 * link they were emailed/texted and sees, for THEIR child(ren) only: upcoming
 * classes, the hub's updates, and photos. Everything is scoped + consent-filtered
 * server-side by the get_guardian_feed RPC (a child without photo permission never
 * appears here at all); photos load through short-lived signed URLs (the private
 * bucket is never public). PWA-installable like the rest of the app, but never
 * required.
 */
export default function ParentView() {
  const { token } = useParams<{ token: string }>()
  const [status, setStatus] = useState<LoadState>('loading')
  const [feed, setFeed] = useState<ReadyFeed | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const countedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!repository || !token) {
        setStatus('error')
        return
      }
      setStatus('loading')
      try {
        const result = await repository.getGuardianFeed(token)
        if (cancelled) return
        if (!result.ok) {
          setStatus(result.reason) // invalid | expired | revoked
          return
        }
        setFeed(result)
        setStatus('ready')

        // Sign every photo + update-image path in one call (private bucket).
        const paths = [
          ...result.photos.map((p) => p.storage_path),
          ...result.announcements.map((a) => a.image_path).filter((p): p is string => !!p),
        ]
        if (paths.length > 0) {
          const signed = await repository.signGuardianMedia(token, paths)
          if (!cancelled) setUrls(signed)
        }

        // Aggregate view count only — once per open (no per-family receipt rows).
        if (!countedRef.current && result.announcements.length > 0) {
          countedRef.current = true
          void repository.markGuardianAnnouncementsRead(
            token,
            result.announcements.map((a) => a.id),
          )
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [token])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-base text-muted-foreground" role="status">
          Loading…
        </p>
      </div>
    )
  }

  if (status !== 'ready' || !feed) {
    const copy =
      status === 'expired'
        ? { title: 'This link has expired', desc: 'Ask the hub to send you a fresh family link.' }
        : status === 'revoked'
          ? { title: 'This link was turned off', desc: 'Ask the hub to send you a new family link.' }
          : status === 'error'
            ? { title: 'Something went wrong', desc: 'Check your connection and open the link again.' }
            : { title: 'We couldn’t open that link', desc: 'Double-check the link, or ask the hub for a fresh one.' }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <EmptyState icon={CircleAlert} title={copy.title} description={copy.desc} />
      </div>
    )
  }

  const { hub, children, schedule, announcements, photos } = feed

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold">{hub.name}</h1>
          <p className="text-base text-muted-foreground">
            {children.length > 0
              ? `Updates for ${children.map((c) => c.display_name).join(' & ')}`
              : 'Your family view'}
          </p>
          <p className="text-sm text-muted-foreground">No account or app needed.</p>
        </header>

        {children.length === 0 && (
          <EmptyState
            icon={Baby}
            title="Nothing to show yet"
            description="Ask the hub to add your child and turn on photo sharing so their classes and photos appear here."
          />
        )}

        {/* ── Classes ── */}
        {children.length > 0 && (
          <section className="space-y-3" aria-labelledby="classes-heading">
            <h2 id="classes-heading" className="flex items-center gap-2 text-2xl font-semibold">
              <CalendarClock className="h-6 w-6 shrink-0" aria-hidden="true" /> Classes
            </h2>
            {schedule.length === 0 ? (
              <p className="text-base text-muted-foreground">No upcoming classes right now.</p>
            ) : (
              <ul className="space-y-2">
                {schedule.map((s) => (
                  <li key={`${s.session_id}-${s.child_id}`}>
                    <Card>
                      <CardContent className="flex items-center justify-between gap-3 p-4">
                        <div>
                          <p className="text-base font-semibold">{s.program_name}</p>
                          <p className="text-sm text-muted-foreground">{formatWhen(s.starts_at, s.ends_at)}</p>
                          {s.location && <p className="text-sm text-muted-foreground">{s.location}</p>}
                        </div>
                        <span className="shrink-0 text-sm font-medium text-muted-foreground">{s.child_name}</span>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ── Updates ── */}
        {children.length > 0 && (
          <section className="space-y-3" aria-labelledby="updates-heading">
            <h2 id="updates-heading" className="flex items-center gap-2 text-2xl font-semibold">
              <Megaphone className="h-6 w-6 shrink-0" aria-hidden="true" /> Updates
            </h2>
            {announcements.length === 0 ? (
              <p className="text-base text-muted-foreground">No updates yet.</p>
            ) : (
              <ul className="space-y-3">
                {announcements.map((a) => (
                  <li key={a.id}>
                    <Card>
                      <CardContent className="space-y-2 p-4">
                        <p className="text-lg font-semibold">{a.title}</p>
                        {a.body && <p className="whitespace-pre-wrap text-base text-muted-foreground">{a.body}</p>}
                        {a.image_path && urls[a.image_path] && (
                          <img
                            src={urls[a.image_path]}
                            alt={a.title}
                            loading="lazy"
                            className="mt-1 w-full rounded-lg border border-border object-cover"
                          />
                        )}
                        {a.published_at && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(a.published_at).toLocaleDateString()}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ── Photos ── */}
        {children.length > 0 && (
          <section className="space-y-3" aria-labelledby="photos-heading">
            <h2 id="photos-heading" className="flex items-center gap-2 text-2xl font-semibold">
              <ImageIcon className="h-6 w-6 shrink-0" aria-hidden="true" /> Photos
            </h2>
            {photos.length === 0 ? (
              <EmptyState
                icon={ImageIcon}
                title="No photos yet"
                description="When the hub shares a photo of your child, it’ll show up here."
              />
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((p) => (
                  <li key={p.id} className="space-y-1">
                    {urls[p.storage_path] ? (
                      <img
                        src={urls[p.storage_path]}
                        alt={p.caption ?? 'Class photo'}
                        loading="lazy"
                        className="aspect-square w-full rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                      </div>
                    )}
                    {p.caption && <p className="text-xs text-muted-foreground">{p.caption}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

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
