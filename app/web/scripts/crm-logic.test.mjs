#!/usr/bin/env node
/**
 * Amityx — CRM pure-logic unit tests (T-008).
 *
 * Covers pipeline summarization (subscription/onboarding counts), overdue/
 * due-today follow-up detection, hubs-list search/filter, archive-consequence
 * copy, and the pilot seed data's shape/order/determinism — the "real,
 * testable code paths" the T-008 spec calls out as verifiable without the
 * live schema (schema/RLS apply is blocked — see T-005/T-008 Result).
 *
 * No network, no DB. Run:  cd app/web && node --test scripts/crm-logic.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ONBOARDING_STAGES,
  SUBSCRIPTION_STATUSES,
  summarizeBySubscriptionStatus,
  summarizeByOnboardingStage,
  isOverdue,
  isDueToday,
  followupUrgency,
  sortOpenFollowups,
  countOverdue,
  filterHubs,
  archiveConsequenceCopy,
} from '../src/features/crm/pipeline.mjs'
import { PILOT_ARCHETYPES, buildSeedRows } from '../src/features/crm/seedData.mjs'

// ─── pipeline summaries ───────────────────────────────────────
test('summarizeBySubscriptionStatus zero-fills every status and counts correctly', () => {
  const hubs = [
    { subscription_status: 'free' },
    { subscription_status: 'free' },
    { subscription_status: 'trial' },
    { subscription_status: 'active' },
  ]
  const out = summarizeBySubscriptionStatus(hubs)
  assert.deepEqual(Object.keys(out).sort(), [...SUBSCRIPTION_STATUSES].sort())
  assert.equal(out.free, 2)
  assert.equal(out.trial, 1)
  assert.equal(out.active, 1)
  assert.equal(out.paused, 0)
  assert.equal(out.canceled, 0)
})

test('summarizeByOnboardingStage counts prospect alongside the T-006 stages', () => {
  const hubs = [
    { onboarding_stage: 'prospect' },
    { onboarding_stage: 'prospect' },
    { onboarding_stage: 'signup' },
    { onboarding_stage: 'paid' },
  ]
  const out = summarizeByOnboardingStage(hubs)
  assert.deepEqual(Object.keys(out).sort(), [...ONBOARDING_STAGES].sort())
  assert.equal(out.prospect, 2)
  assert.equal(out.signup, 1)
  assert.equal(out.paid, 1)
  assert.equal(out.churned, 0)
})

test('summaries ignore unknown/garbage values rather than crash', () => {
  assert.equal(summarizeBySubscriptionStatus([{ subscription_status: 'not_a_status' }, null]).free, 0)
  assert.equal(summarizeByOnboardingStage([{ onboarding_stage: 'bogus' }]).prospect, 0)
})

// ─── overdue / due-today follow-up detection ─────────────────
test('isOverdue is true only for OPEN follow-ups with a past due_date', () => {
  const today = '2026-07-12'
  assert.equal(isOverdue({ status: 'open', due_date: '2026-07-01' }, today), true)
  assert.equal(isOverdue({ status: 'open', due_date: '2026-07-12' }, today), false) // today, not overdue
  assert.equal(isOverdue({ status: 'open', due_date: '2026-07-20' }, today), false) // future
  assert.equal(isOverdue({ status: 'done', due_date: '2026-01-01' }, today), false) // done = not overdue
  assert.equal(isOverdue({ status: 'snoozed', due_date: '2026-01-01' }, today), false)
})

test('isDueToday is exclusive of overdue', () => {
  const today = '2026-07-12'
  assert.equal(isDueToday({ status: 'open', due_date: '2026-07-12' }, today), true)
  assert.equal(isDueToday({ status: 'open', due_date: '2026-07-11' }, today), false)
})

test('followupUrgency buckets overdue > due_today > upcoming', () => {
  const today = '2026-07-12'
  assert.equal(followupUrgency({ status: 'open', due_date: '2026-07-01' }, today), 'overdue')
  assert.equal(followupUrgency({ status: 'open', due_date: '2026-07-12' }, today), 'due_today')
  assert.equal(followupUrgency({ status: 'open', due_date: '2026-08-01' }, today), 'upcoming')
})

test('sortOpenFollowups drops non-open items and sorts soonest-due first (overdue first)', () => {
  const list = [
    { id: 'a', status: 'open', due_date: '2026-08-01' },
    { id: 'b', status: 'done', due_date: '2026-01-01' },
    { id: 'c', status: 'open', due_date: '2026-06-01' }, // overdue relative to 'today' below
    { id: 'd', status: 'open', due_date: '2026-07-12' },
  ]
  const sorted = sortOpenFollowups(list)
  assert.deepEqual(sorted.map((f) => f.id), ['c', 'd', 'a'])
})

test('countOverdue counts only overdue open items', () => {
  const today = '2026-07-12'
  const list = [
    { status: 'open', due_date: '2026-07-01' },
    { status: 'open', due_date: '2026-07-20' },
    { status: 'done', due_date: '2026-01-01' },
  ]
  assert.equal(countOverdue(list, today), 1)
})

// ─── hubs list search/filter ──────────────────────────────────
test('filterHubs matches hub name, owner name, or owner email (case-insensitive)', () => {
  const hubs = [
    { hub_name: 'Sunny Sprouts', owner_name: 'Dana R.', owner_email: 'dana@x.com', subscription_status: 'free' },
    { hub_name: 'Tiny Tots Gym', owner_name: 'Alex P.', owner_email: 'alex@y.com', subscription_status: 'active' },
  ]
  assert.equal(filterHubs(hubs, { search: 'sunny' }).length, 1)
  assert.equal(filterHubs(hubs, { search: 'ALEX' }).length, 1)
  assert.equal(filterHubs(hubs, { search: 'y.com' }).length, 1)
  assert.equal(filterHubs(hubs, { search: 'zzz' }).length, 0)
})

test('filterHubs applies an exact subscription_status filter, "all" is a no-op', () => {
  const hubs = [
    { hub_name: 'A', subscription_status: 'free' },
    { hub_name: 'B', subscription_status: 'active' },
  ]
  assert.equal(filterHubs(hubs, { status: 'active' }).length, 1)
  assert.equal(filterHubs(hubs, { status: 'all' }).length, 2)
  assert.equal(filterHubs(hubs, {}).length, 2)
})

// ─── archive copy ─────────────────────────────────────────────
test('archiveConsequenceCopy states the consequence AND that it is reversible', () => {
  const archiving = archiveConsequenceCopy('Sunny Sprouts', true)
  assert.match(archiving, /Sunny Sprouts/)
  assert.match(archiving, /hidden/i)
  assert.match(archiving, /unarchive/i)
  const unarchiving = archiveConsequenceCopy('Sunny Sprouts', false)
  assert.match(unarchiving, /reappear/i)
})

// ─── pilot seed data ──────────────────────────────────────────
test('PILOT_ARCHETYPES has exactly 10 slots, numbered 1..10 in order', () => {
  assert.equal(PILOT_ARCHETYPES.length, 10)
  assert.deepEqual(PILOT_ARCHETYPES.map((r) => r.slot), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  for (const row of PILOT_ARCHETYPES) {
    assert.ok(row.archetype.length > 0)
    assert.ok(row.whySlot.length > 0)
    assert.ok(row.freeLayerHook.length > 0)
  }
})

test('buildSeedRows produces 10 rows with unique deterministic ids/slugs, in slot order', () => {
  const rows = buildSeedRows()
  assert.equal(rows.length, 10)
  assert.deepEqual(rows.map((r) => r.slot), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.equal(new Set(rows.map((r) => r.id)).size, 10)
  assert.equal(new Set(rows.map((r) => r.slug)).size, 10)
  for (const r of rows) {
    assert.match(r.id, /^[0-9a-f-]{36}$/)
    assert.match(r.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/) // same slug rule as hubs.slug
    assert.ok(r.notes.includes(r.archetype))
    assert.ok(r.notes.includes(r.freeLayerHook))
    assert.match(r.name, /TBD/) // placeholder name is honest about being a placeholder
  }
})

test('buildSeedRows is deterministic (idempotent seed re-runs produce the same ids)', () => {
  const a = buildSeedRows()
  const b = buildSeedRows()
  assert.deepEqual(a.map((r) => r.id), b.map((r) => r.id))
  assert.deepEqual(a.map((r) => r.slug), b.map((r) => r.slug))
})
