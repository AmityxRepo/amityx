#!/usr/bin/env node
/**
 * Amityx — roster/schedule/notes pure-logic unit tests (T-007).
 * Covers capacity/waitlist decisions, Today's now/next categorization, and the
 * daily-note quick-tag composer. No network, no DB. Run:
 *   cd app/web && node --test scripts/roster-logic.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { decideEnrollmentStatus, capacityLabel, isFull } from '../src/features/roster/capacity.mjs'
import { categorizeSessions, DEFAULT_SESSION_MINUTES } from '../src/features/schedule/today.mjs'
import { QUICK_TAGS, isValidTag, toggleTag, composeNoteBody } from '../src/features/notes/quickTags.mjs'

// ─── capacity / waitlist ──────────────────────────────────────────────
test('decideEnrollmentStatus: unlimited capacity is always active', () => {
  assert.equal(decideEnrollmentStatus({ capacity: null, activeCount: 999 }), 'active')
  assert.equal(decideEnrollmentStatus({ capacity: undefined, activeCount: 0 }), 'active')
})

test('decideEnrollmentStatus: under capacity is active, at/over capacity waitlists (never rejects)', () => {
  assert.equal(decideEnrollmentStatus({ capacity: 10, activeCount: 9 }), 'active')
  assert.equal(decideEnrollmentStatus({ capacity: 10, activeCount: 10 }), 'waitlisted')
  assert.equal(decideEnrollmentStatus({ capacity: 10, activeCount: 11 }), 'waitlisted')
  assert.equal(decideEnrollmentStatus({ capacity: 0, activeCount: 0 }), 'waitlisted') // zero-capacity edge case
})

test('isFull mirrors decideEnrollmentStatus at the boundary', () => {
  assert.equal(isFull({ capacity: 5, activeCount: 4 }), false)
  assert.equal(isFull({ capacity: 5, activeCount: 5 }), true)
  assert.equal(isFull({ capacity: null, activeCount: 1000 }), false)
})

test('capacityLabel is plain language, never raw schema words, and surfaces the waitlist count', () => {
  assert.equal(capacityLabel({ capacity: 10, activeCount: 7 }), '7 / 10 spots')
  assert.equal(capacityLabel({ capacity: null, activeCount: 3 }), '3 signed up')
  assert.match(capacityLabel({ capacity: 10, activeCount: 10, waitlistCount: 2 }), /waitlist/)
  assert.doesNotMatch(capacityLabel({ capacity: 10, activeCount: 1, waitlistCount: 0 }), /waitlist/)
})

// ─── Today: now/next categorization ───────────────────────────────────
test('categorizeSessions splits happening-now vs coming-up-next and drops past sessions', () => {
  const now = '2026-07-12T10:00:00.000Z'
  const sessions = [
    { id: 'past', starts_at: '2026-07-12T07:00:00.000Z', ends_at: '2026-07-12T08:00:00.000Z' },
    { id: 'now', starts_at: '2026-07-12T09:30:00.000Z', ends_at: '2026-07-12T10:30:00.000Z' },
    { id: 'later', starts_at: '2026-07-12T14:00:00.000Z', ends_at: null },
    { id: 'soonest-next', starts_at: '2026-07-12T11:00:00.000Z', ends_at: null },
  ]
  const { now: nowList, next } = categorizeSessions(sessions, now)
  assert.deepEqual(nowList.map((s) => s.id), ['now'])
  assert.deepEqual(next.map((s) => s.id), ['soonest-next', 'later']) // ordered soonest-first
})

test('a session with no ends_at falls back to DEFAULT_SESSION_MINUTES for "now" detection', () => {
  const starts = '2026-07-12T10:00:00.000Z'
  const stillRunning = new Date(new Date(starts).getTime() + (DEFAULT_SESSION_MINUTES - 5) * 60_000).toISOString()
  const alreadyOver = new Date(new Date(starts).getTime() + (DEFAULT_SESSION_MINUTES + 5) * 60_000).toISOString()
  assert.equal(categorizeSessions([{ id: 'x', starts_at: starts, ends_at: null }], stillRunning).now.length, 1)
  assert.equal(categorizeSessions([{ id: 'x', starts_at: starts, ends_at: null }], alreadyOver).now.length, 0)
})

test('categorizeSessions caps the "next" list at nextLimit', () => {
  const now = '2026-07-12T00:00:00.000Z'
  const sessions = Array.from({ length: 8 }, (_, i) => ({
    id: `s${i}`,
    starts_at: new Date(new Date(now).getTime() + (i + 1) * 3_600_000).toISOString(),
  }))
  const { next } = categorizeSessions(sessions, now, { nextLimit: 3 })
  assert.equal(next.length, 3)
  assert.equal(next[0].id, 's0')
})

test('categorizeSessions tolerates empty/undefined input', () => {
  assert.deepEqual(categorizeSessions(undefined, '2026-07-12T00:00:00Z'), { now: [], next: [] })
  assert.deepEqual(categorizeSessions([], '2026-07-12T00:00:00Z'), { now: [], next: [] })
})

// ─── daily note quick tags (≤3-tap, autosave) ─────────────────────────
test('QUICK_TAGS is a small, plain-language catalog', () => {
  assert.ok(QUICK_TAGS.length >= 4)
  for (const t of QUICK_TAGS) {
    assert.equal(typeof t.id, 'string')
    assert.equal(typeof t.label, 'string')
    assert.ok(isValidTag(t.id))
  }
  assert.equal(isValidTag('not_a_real_tag'), false)
})

test('toggleTag adds then removes, and never duplicates', () => {
  let sel = toggleTag([], 'great_day')
  assert.deepEqual(sel, ['great_day'])
  sel = toggleTag(sel, 'great_day')
  assert.deepEqual(sel, [])
  sel = toggleTag(toggleTag([], 'ate_well'), 'ate_well')
  assert.deepEqual(sel, [])
})

test('composeNoteBody: tags-only is exactly 2 required taps worth of content (open + tag)', () => {
  assert.equal(composeNoteBody({ tags: ['great_day'], text: '' }), 'Great day')
})

test('composeNoteBody: combines tags + free text, drops invalid/unknown tag ids silently', () => {
  const body = composeNoteBody({ tags: ['great_day', 'made_a_friend', 'nonsense'], text: '  Painted a bird.  ' })
  assert.equal(body, 'Great day · Made a friend\nPainted a bird.')
})

test('composeNoteBody: text-only and empty-everything are both well-formed', () => {
  assert.equal(composeNoteBody({ tags: [], text: 'Quiet nap today.' }), 'Quiet nap today.')
  assert.equal(composeNoteBody({ tags: [], text: '' }), '')
})
