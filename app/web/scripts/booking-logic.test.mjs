#!/usr/bin/env node
/**
 * Amityx — public booking page pure-logic unit tests (T-010).
 * Covers age-band lookup and anti-spam (honeypot + min-fill-time) decisions.
 * No network, no DB. Run:  cd app/web && node --test scripts/booking-logic.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { AGE_BANDS, ageBandLabel, isValidAgeBand, ageRangeLabel } from '../src/features/booking/ageBands.mjs'
import { isHoneypotTripped, isFillTooFast, shouldSilentlyDrop } from '../src/features/booking/antiSpam.mjs'

// ─── age bands ─────────────────────────────────────────────────────────
test('AGE_BANDS covers the 0–5 core ICP plus a sibling band', () => {
  assert.ok(AGE_BANDS.length >= 5)
  assert.ok(AGE_BANDS.some((b) => b.key === 'under_1'))
  assert.ok(AGE_BANDS.some((b) => b.key === '5_plus'))
})

test('ageBandLabel resolves known keys and returns null for unknown keys', () => {
  assert.equal(ageBandLabel('2_3'), '2–3 years')
  assert.equal(ageBandLabel('nonsense'), null)
})

test('isValidAgeBand mirrors AGE_BANDS membership', () => {
  for (const b of AGE_BANDS) assert.equal(isValidAgeBand(b.key), true)
  assert.equal(isValidAgeBand('made-up'), false)
})

test('ageRangeLabel: null in -> null out; renders months under 2yr, years at/above', () => {
  assert.equal(ageRangeLabel(null, null), null)
  assert.equal(ageRangeLabel(undefined, undefined), null)
  assert.equal(ageRangeLabel(6, 18), '6 mo–18 mo')
  assert.equal(ageRangeLabel(24, 96), '2 yrs–8 yrs')
  assert.equal(ageRangeLabel(36, null), '3 yrs+')
  assert.equal(ageRangeLabel(null, 60), 'Up to 5 yrs')
})

// ─── anti-spam ─────────────────────────────────────────────────────────
test('isHoneypotTripped: empty/whitespace/undefined is a real human, anything else is a bot', () => {
  assert.equal(isHoneypotTripped(''), false)
  assert.equal(isHoneypotTripped('   '), false)
  assert.equal(isHoneypotTripped(undefined), false)
  assert.equal(isHoneypotTripped(null), false)
  assert.equal(isHoneypotTripped('http://spam.example'), true)
})

test('isFillTooFast: below the floor is too fast, at/above it is fine', () => {
  const opened = 1_000_000
  assert.equal(isFillTooFast(opened, opened + 500), true)
  assert.equal(isFillTooFast(opened, opened + 2000), false) // exactly at the default floor
  assert.equal(isFillTooFast(opened, opened + 5000), false)
  assert.equal(isFillTooFast(opened, opened + 100, 5000), true) // custom floor
})

test('shouldSilentlyDrop is true if EITHER signal trips, false for a plausible human submit', () => {
  const opened = 1_000_000
  assert.equal(
    shouldSilentlyDrop({ honeypotValue: 'bot', openedAtMs: opened, submittedAtMs: opened + 10_000 }),
    true,
  )
  assert.equal(
    shouldSilentlyDrop({ honeypotValue: '', openedAtMs: opened, submittedAtMs: opened + 200 }),
    true,
  )
  assert.equal(
    shouldSilentlyDrop({ honeypotValue: '', openedAtMs: opened, submittedAtMs: opened + 10_000 }),
    false,
  )
})
