import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Camera, Megaphone, Send, Trash2, ImagePlus, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'
import FormField from '../../components/ui/FormField'
import EmptyState from '../../components/ui/EmptyState'
import { repository } from '../../repository'
import type { HubAnnouncement, HubPhotoMoment } from '../../repository/schema'
import type { RosterChild } from '../../repository/types'

type LoadState = 'loading' | 'ready' | 'nohub' | 'error'

/**
 * /app/share (T-011) — the staff capture surface, reached from More (secondary
 * jobs live behind More, never crowding the 4 daily tabs — P.9 rule 7). Two jobs:
 *  1. Share a photo with a child's family — pick the child(ren), snap/upload, send.
 *     Only children WITH photo permission are taggable; the server rejects the rest.
 *  2. Post an update to every family (with an optional general photo).
 * Photos compress to a small webp in the browser before upload (the adapter,
 * D-011), and land in a private bucket served only through signed links.
 */
export default function Share() {
  const [status, setStatus] = useState<LoadState>('loading')
  const [hubId, setHubId] = useState<string | null>(null)
  const [roster, setRoster] = useState<RosterChild[]>([])
  const [photoItems, setPhotoItems] = useState<HubPhotoMoment[]>([])
  const [updates, setUpdates] = useState<HubAnnouncement[]>([])

  async function load() {
    if (!repository) {
      setStatus('error')
      return
    }
    setStatus('loading')
    try {
      const hub = await repository.getMyHub()
      if (!hub) {
        setStatus('nohub')
        return
      }
      setHubId(hub.hub.id)
      const [r, m, u] = await Promise.all([
        repository.listRoster(hub.hub.id),
        repository.listHubPhotoMoments(hub.hub.id),
        repository.listHubAnnouncements(hub.hub.id),
      ])
      setRoster(r)
      setPhotoItems(m)
      setUpdates(u)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (status === 'loading') {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground" role="status">
          Loading…
        </p>
      </div>
    )
  }

  if (status === 'nohub' || status === 'error' || !hubId) {
    return (
      <div className="p-4">
        <EmptyState
          icon={RefreshCw}
          title="We couldn’t load this page"
          description="Check your connection and try again."
          action={
            <Button icon={RefreshCw} onClick={load}>
              Try again
            </Button>
          }
        />
      </div>
    )
  }

  const consented = roster.filter((r) => r.child.photo_consent)

  return (
    <div className="space-y-4 p-4">
      <Link to="/app/more" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
      </Link>

      <header>
        <h1 className="text-2xl font-semibold text-foreground">Photos &amp; updates</h1>
        <p className="text-sm text-muted-foreground">Share a photo with a family, or post an update to everyone.</p>
      </header>

      <SharePhotoCard
        hubId={hubId}
        consented={consented}
        totalChildren={roster.length}
        onSaved={() => void load()}
      />

      <PostUpdateCard hubId={hubId} onSaved={() => void load()} />

      <Card>
        <CardHeader>
          <CardTitle>Recent photos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {photoItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No photos shared yet.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photoItems.map((m) => (
                <li key={m.id} className="space-y-1">
                  {m.signedUrl ? (
                    <img
                      src={m.signedUrl}
                      alt={m.caption ?? 'Shared photo'}
                      loading="lazy"
                      className="aspect-square w-full rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted">
                      <Camera className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                    </div>
                  )}
                  <p className="truncate text-xs text-muted-foreground">
                    {m.tagged.map((t) => t.display_name).join(', ') || 'Group'}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    className="w-full"
                    onClick={async () => {
                      await repository!.deletePhotoMoment(m.id, m.storage_path)
                      void load()
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent updates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {updates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No updates posted yet.</p>
          ) : (
            <ul className="space-y-2">
              {updates.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-foreground">{u.title}</p>
                    <p className="truncate text-sm text-muted-foreground">{u.body}</p>
                  </div>
                  <Badge variant="neutral">{u.read_count} views</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SharePhotoCard({
  hubId,
  consented,
  totalChildren,
  onSaved,
}: {
  hubId: string
  consented: RosterChild[]
  totalChildren: number
  onSaved: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function onSend() {
    if (!repository || !file || picked.size === 0) return
    setBusy(true)
    setError(null)
    try {
      const result = await repository.capturePhotoMoment({
        hubId,
        file,
        childIds: [...picked],
        caption: caption.trim() || undefined,
      })
      if (!result.ok) {
        setError(
          result.reason === 'consent_required'
            ? `Photo permission is off for ${result.blocked ?? 'a selected child'}. Turn it on in their profile, or unpick them.`
            : 'Could not share that photo. Please try again.',
        )
        return
      }
      setFile(null)
      setPicked(new Set())
      setCaption('')
      if (fileRef.current) fileRef.current.value = ''
      setDone(true)
      setTimeout(() => setDone(false), 2500)
      onSaved()
    } catch {
      setError('Could not share that photo. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share a photo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {consented.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {totalChildren === 0
              ? 'Add a child to your roster first.'
              : 'No child has photo permission yet. Turn it on in a child’s profile to share photos with their family.'}
          </p>
        ) : (
          <>
            <FormField label="Choose a photo" htmlFor="share-photo">
              <input
                id="share-photo"
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="block w-full text-sm text-foreground file:mr-3 file:min-h-[44px] file:rounded-md file:border file:border-input file:bg-muted file:px-4 file:text-sm file:font-medium"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </FormField>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">Who’s in it?</legend>
              <div className="flex flex-wrap gap-2">
                {consented.map((r) => {
                  const on = picked.has(r.child.id)
                  return (
                    <button
                      key={r.child.id}
                      type="button"
                      onClick={() => toggle(r.child.id)}
                      aria-pressed={on}
                      className={`min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors ${
                        on
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-transparent text-foreground hover:bg-muted'
                      }`}
                    >
                      {r.child.display_name}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <FormField label="Add a note" htmlFor="share-caption" hint="Optional.">
              <Input
                id="share-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="e.g. Painting rainbows today!"
              />
            </FormField>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {done && <p className="text-sm text-primary">Shared with the family.</p>}

            <Button
              icon={Send}
              className="w-full"
              disabled={busy || !file || picked.size === 0}
              onClick={onSend}
            >
              {busy ? 'Sharing…' : 'Send to families'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function PostUpdateCard({ hubId, onSaved }: { hubId: string; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const imgRef = useRef<HTMLInputElement | null>(null)

  async function onPost() {
    if (!repository || !title.trim()) return
    setBusy(true)
    setError(null)
    try {
      await repository.postAnnouncement({ hubId, title: title.trim(), body: body.trim(), imageFile: image })
      setTitle('')
      setBody('')
      setImage(null)
      if (imgRef.current) imgRef.current.value = ''
      setDone(true)
      setTimeout(() => setDone(false), 2500)
      onSaved()
    } catch {
      setError('Could not post that update. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post an update</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <FormField label="Title" htmlFor="update-title" required>
          <Input id="update-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Closed Friday" />
        </FormField>
        <FormField label="Message" htmlFor="update-body">
          <Textarea id="update-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share the details…" />
        </FormField>
        <FormField
          label="Add a photo"
          htmlFor="update-image"
          hint="Optional. Everyone with a family link sees this — use a general photo, not a close-up of one child."
        >
          <input
            id="update-image"
            ref={imgRef}
            type="file"
            accept="image/*"
            className="block w-full text-sm text-foreground file:mr-3 file:min-h-[44px] file:rounded-md file:border file:border-input file:bg-muted file:px-4 file:text-sm file:font-medium"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />
        </FormField>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {done && <p className="text-sm text-primary">Posted to every family.</p>}

        <Button icon={image ? ImagePlus : Megaphone} className="w-full" disabled={busy || !title.trim()} onClick={onPost}>
          {busy ? 'Posting…' : 'Post to everyone'}
        </Button>
      </CardContent>
    </Card>
  )
}
