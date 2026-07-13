#!/usr/bin/env node
/**
 * Amityx — signup pure-logic unit tests (T-006).
 *
 * Covers the slug rules, password rule, the forgiving auth-error mapping
 * (duplicate email / weak password / SMTP failure / not-confirmed / rate limit),
 * the activity template catalog, and the resumable wizard state machine — the
 * "real, testable code paths" the T-006 spec requires for its error behavior.
 *
 * No network, no DB. Run:  cd app/web && node --test scripts/signup-logic.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { slugify, isValidSlug, withSuffix, nextAvailableSlug } from '../src/features/signup/slug.mjs'
import { checkPassword, MIN_PASSWORD_LENGTH } from '../src/features/signup/password.mjs'
import { mapAuthError, interpretSignUp } from '../src/features/signup/authErrors.mjs'
import {
  ACTIVITY_TEMPLATES,
  ACTIVITY_TYPES,
  defaultSelectedTypes,
  activitiesPayload,
  templateFor,
} from '../src/features/signup/programTemplates.mjs'
import {
  defaultWizardState,
  sanitizeWizardState,
  loadWizard,
  saveWizard,
  clearWizard,
  nextStep,
  prevStep,
  deriveResumeStep,
  STORAGE_KEY,
} from '../src/features/signup/wizard.mjs'

// ─── slug ────────────────────────────────────────────────────
test('slugify normalizes a hub name', () => {
  assert.equal(slugify('Sunny Sprouts!'), 'sunny-sprouts')
  assert.equal(slugify('  Café Niños  '), 'cafe-ninos')
  assert.equal(slugify('A & B --- C'), 'a-b-c')
})

test('isValidSlug enforces the server rule (3..40, a-z0-9, hyphen-separated)', () => {
  assert.equal(isValidSlug('sunny-sprouts'), true)
  assert.equal(isValidSlug('ab'), false) // too short
  assert.equal(isValidSlug('-bad'), false) // leading hyphen
  assert.equal(isValidSlug('bad--slug'), false) // double hyphen
  assert.equal(isValidSlug('Bad'), false) // uppercase
  assert.equal(isValidSlug('a'.repeat(41)), false) // too long
})

test('nextAvailableSlug auto-suffixes on collision and stays valid', () => {
  const taken = new Set(['sunny-sprouts', 'sunny-sprouts-2'])
  const chosen = nextAvailableSlug('sunny-sprouts', (s) => taken.has(s))
  assert.equal(chosen, 'sunny-sprouts-3')
  assert.equal(isValidSlug(chosen), true)
  assert.equal(nextAvailableSlug('free-slug', () => false), 'free-slug')
})

test('withSuffix respects the 40-char cap', () => {
  const long = 'a'.repeat(40)
  const out = withSuffix(long, 12)
  assert.ok(out.length <= 40)
  assert.ok(out.endsWith('-12'))
})

// ─── password ────────────────────────────────────────────────
test('checkPassword enforces the min length with a plain-language rule', () => {
  const weak = checkPassword('short')
  assert.equal(weak.ok, false)
  assert.match(weak.message, /at least 8 characters/i)
  assert.equal(checkPassword('a'.repeat(MIN_PASSWORD_LENGTH)).ok, true)
})

// ─── auth error mapping (forgiving paths) ────────────────────
test('mapAuthError routes each Supabase failure to a next-step message', () => {
  assert.equal(mapAuthError({ message: 'User already registered' }).kind, 'duplicate_email')
  assert.equal(mapAuthError({ code: 'weak_password' }).kind, 'weak_password')
  assert.equal(mapAuthError({ message: 'Email not confirmed' }).kind, 'email_not_confirmed')
  assert.equal(mapAuthError({ message: 'Invalid login credentials' }).kind, 'invalid_credentials')
  assert.equal(mapAuthError({ message: 'Error sending confirmation email' }).kind, 'smtp')
  assert.equal(mapAuthError({ status: 429 }).kind, 'rate_limited')
  assert.equal(mapAuthError({ message: 'Failed to fetch' }).kind, 'network')
  assert.equal(mapAuthError(null).kind, 'generic')
  // every mapping carries a human message
  for (const e of [{ code: 'weak_password' }, { status: 429 }, { message: 'Error sending confirmation email' }]) {
    assert.ok(mapAuthError(e).message.length > 0)
  }
})

test('duplicate-email is detected even when Supabase returns "success" with empty identities', () => {
  const dup = interpretSignUp({ data: { user: { id: 'x', identities: [] }, session: null }, error: null })
  assert.equal(dup.kind, 'duplicate_email')
  assert.equal(dup.action, 'signin')
})

test('interpretSignUp flags needsVerification when there is no session', () => {
  const fresh = interpretSignUp({ data: { user: { id: 'x', identities: [{ id: 'i' }] }, session: null }, error: null })
  assert.equal(fresh.kind, 'ok')
  assert.equal(fresh.needsVerification, true)

  const instant = interpretSignUp({ data: { user: { id: 'x', identities: [{ id: 'i' }] }, session: { access_token: 't' } }, error: null })
  assert.equal(instant.kind, 'ok')
  assert.equal(instant.needsVerification, false)
})

// ─── activity templates ──────────────────────────────────────
test('activity catalog covers exactly the program_type enum', () => {
  const expected = ['art', 'swim', 'karate', 'daycare', 'bootcamp', 'open_play', 'camp'].sort()
  assert.deepEqual([...ACTIVITY_TYPES].sort(), expected)
  assert.equal(ACTIVITY_TEMPLATES.length, 7)
})

test('defaults are sensible (some pre-checked, not all) and payload is well-formed', () => {
  const pre = defaultSelectedTypes()
  assert.ok(pre.length >= 1 && pre.length < ACTIVITY_TYPES.length)
  const payload = activitiesPayload(pre)
  assert.equal(payload.length, pre.length)
  for (const item of payload) {
    assert.ok(templateFor(item.type))
    assert.equal(typeof item.name, 'string')
    assert.equal(typeof item.age_min_months, 'number')
    assert.ok(item.age_max_months >= item.age_min_months)
  }
  // unknown types are dropped, not crashed on
  assert.equal(activitiesPayload(['not_a_type']).length, 0)
})

// ─── wizard state machine + persistence ──────────────────────
function fakeStorage() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  }
}

test('wizard save/load round-trips and never persists a password', () => {
  const store = fakeStorage()
  const state = { ...defaultWizardState(), step: 'hub', email: 'a@b.com', hub: { name: 'X', slug: 'x-hub', timezone: 'America/Los_Angeles' } }
  saveWizard(store, state)
  const loaded = loadWizard(store)
  assert.equal(loaded.step, 'hub')
  assert.equal(loaded.email, 'a@b.com')
  assert.equal(loaded.hub.slug, 'x-hub')
  assert.ok(!('password' in loaded))
  assert.ok(!store._map.get(STORAGE_KEY).toLowerCase().includes('password'))
  clearWizard(store)
  assert.equal(store.getItem(STORAGE_KEY), null)
})

test('sanitizeWizardState rejects a garbage blob and falls back to defaults', () => {
  const s = sanitizeWizardState({ step: 'not-a-step', activities: [1, 'art', {}], invites: [{ email: 'ok@x.com' }, { nope: 1 }] })
  assert.equal(s.step, 'account')
  assert.deepEqual(s.activities, ['art'])
  assert.deepEqual(s.invites, [{ email: 'ok@x.com' }])
  assert.equal(loadWizard({ getItem: () => 'not json{' }).step, 'account')
})

test('nextStep / prevStep are clamped to the ends', () => {
  assert.equal(nextStep('account'), 'verify')
  assert.equal(prevStep('account'), 'account')
  assert.equal(nextStep('done'), 'done')
  assert.equal(prevStep('done'), 'invites')
})

test('deriveResumeStep reconciles persisted progress with live session/hub truth', () => {
  // has a hub already -> signup complete
  assert.equal(deriveResumeStep({ hasSession: true, hasHub: true, persistedStep: 'hub' }), 'done')
  // signed in, no hub -> resume in provisioning
  assert.equal(deriveResumeStep({ hasSession: true, hasHub: false, persistedStep: 'activities' }), 'activities')
  assert.equal(deriveResumeStep({ hasSession: true, hasHub: false, persistedStep: 'account' }), 'hub')
  // not signed in -> awaiting verification resumes at verify, else account
  assert.equal(deriveResumeStep({ hasSession: false, hasHub: false, persistedStep: 'verify' }), 'verify')
  assert.equal(deriveResumeStep({ hasSession: false, hasHub: false, persistedStep: 'schedule' }), 'account')
})
