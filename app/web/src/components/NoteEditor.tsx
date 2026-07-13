import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import Textarea from './ui/Textarea'
import { repository } from '../repository'
import { QUICK_TAGS, toggleTag, composeNoteBody } from '../features/notes/quickTags'
import type { ChildNote } from '../repository/schema'

const AUTOSAVE_DELAY_MS = 500

/**
 * Per-child daily note (T-007): free text + quick-tags, ≤3 taps, autosaves. Written
 * AFTER class — embedded inline under a roster row (no navigation required to jot a
 * note). Tag taps and text both autosave via one shared debounced save.
 */
export default function NoteEditor({
  hubId,
  childId,
  sessionId,
  existingNote,
}: {
  hubId: string
  childId: string
  sessionId: string
  existingNote: ChildNote | null
}) {
  const [tags, setTags] = useState<string[]>([])
  const [text, setText] = useState('')
  const [noteId, setNoteId] = useState<string | null>(existingNote?.id ?? null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timeoutRef = useRef<number | null>(null)

  // Seed from an existing note’s body (best-effort split back into a first "tag
  // line" + remaining text — see composeNoteBody). Only runs once per note.
  useEffect(() => {
    if (!existingNote) return
    const [firstLine, ...rest] = existingNote.body.split('\n')
    const maybeTagLabels = firstLine.split(' · ')
    const matched = QUICK_TAGS.filter((t) => maybeTagLabels.includes(t.label))
    if (matched.length > 0) {
      setTags(matched.map((t) => t.id))
      setText(rest.join('\n'))
    } else {
      setText(existingNote.body)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function scheduleSave(nextTags: string[], nextText: string) {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    setSaveState('saving')
    timeoutRef.current = window.setTimeout(async () => {
      if (!repository) return
      const body = composeNoteBody({ tags: nextTags, text: nextText })
      try {
        const saved = await repository.saveChildNote({ hubId, childId, sessionId, noteId, body })
        setNoteId(saved.id)
        setSaveState('saved')
      } catch {
        setSaveState('idle')
      }
    }, AUTOSAVE_DELAY_MS)
  }

  useEffect(
    () => () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    },
    [],
  )

  function onToggleTag(id: string) {
    const next = toggleTag(tags, id)
    setTags(next)
    scheduleSave(next, text)
  }

  function onTextChange(value: string) {
    setText(value)
    scheduleSave(tags, value)
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap gap-2">
        {QUICK_TAGS.map((tag) => {
          const selected = tags.includes(tag.id)
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onToggleTag(tag.id)}
              aria-pressed={selected}
              className={`min-h-[44px] rounded-pill border px-3 text-sm font-medium transition-colors ${
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-foreground hover:bg-muted'
              }`}
            >
              {tag.label}
            </button>
          )
        })}
      </div>
      <Textarea
        placeholder="Anything else about their day?"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        rows={3}
      />
      <p className="flex items-center gap-1 text-sm text-muted-foreground" role="status">
        {saveState === 'saved' && (
          <>
            <Check className="h-4 w-4 text-success" aria-hidden="true" /> Saved
          </>
        )}
        {saveState === 'saving' && 'Saving…'}
      </p>
    </div>
  )
}
