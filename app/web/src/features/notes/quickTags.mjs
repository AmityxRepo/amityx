// Daily-note quick tags (T-007) — written AFTER class, ≤3 taps: open note (1) → tap
// a tag, which autosaves immediately (2) → close (not a "job" tap; autosave already
// happened). Free text remains available for anything a tag doesn't cover.

export const QUICK_TAGS = [
  { id: 'great_day', label: 'Great day' },
  { id: 'needs_rest', label: 'Needs rest' },
  { id: 'ate_well', label: 'Ate well' },
  { id: 'little_upset', label: 'A little upset' },
  { id: 'made_a_friend', label: 'Made a friend' },
  { id: 'call_me', label: 'Please call me' },
]

const TAG_IDS = new Set(QUICK_TAGS.map((t) => t.id))

export function isValidTag(id) {
  return TAG_IDS.has(id)
}

/** Toggle one tag id in/out of a selection (pure — the tap handler just calls this). */
export function toggleTag(selected, id) {
  const set = new Set(selected ?? [])
  if (set.has(id)) set.delete(id)
  else set.add(id)
  return [...set]
}

/** Compose the note body persisted to `child_notes.body` — tags render as a leading
 * line of plain words (never raw tag ids), followed by the free-text paragraph. */
export function composeNoteBody({ tags, text }) {
  const validTags = (tags ?? []).filter(isValidTag)
  const tagLine = validTags.map((id) => QUICK_TAGS.find((t) => t.id === id)?.label).filter(Boolean).join(' · ')
  const trimmedText = (text ?? '').trim()
  if (tagLine && trimmedText) return `${tagLine}\n${trimmedText}`
  return tagLine || trimmedText
}
