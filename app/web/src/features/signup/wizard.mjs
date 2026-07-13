// Signup wizard state + persistence (T-006). The wizard progress is saved after
// every step so a drop-off resumes exactly where it left off — this is what
// protects the "reach a populated hub in <=15 min" criterion when a founder gets
// interrupted mid-signup. Storage is INJECTED (a Storage-like object) so the
// pure logic is unit-tested with a fake store, and the password is NEVER part of
// the persisted state.

export const STORAGE_KEY = 'amityx.signup.v1'

export const STEPS = ['account', 'verify', 'hub', 'activities', 'schedule', 'invites', 'done']
const STEP_SET = new Set(STEPS)
const DEFAULT_TZ = 'America/Los_Angeles'

export function defaultWizardState() {
  return {
    v: 1,
    step: 'account',
    email: '',
    ownerName: '',
    hub: { name: '', slug: '', timezone: DEFAULT_TZ },
    activities: [],
    schedule: null,
    invites: [],
    hubId: null,
    hubSlug: null,
  }
}

export function stepIndex(step) {
  const i = STEPS.indexOf(step)
  return i === -1 ? 0 : i
}

export function nextStep(step) {
  return STEPS[Math.min(stepIndex(step) + 1, STEPS.length - 1)]
}

export function prevStep(step) {
  return STEPS[Math.max(stepIndex(step) - 1, 0)]
}

/** Coerce any parsed/legacy blob into a valid state (defense against bad JSON). */
export function sanitizeWizardState(raw) {
  const base = defaultWizardState()
  if (!raw || typeof raw !== 'object') return base
  const out = { ...base }
  if (STEP_SET.has(raw.step)) out.step = raw.step
  if (typeof raw.email === 'string') out.email = raw.email
  if (typeof raw.ownerName === 'string') out.ownerName = raw.ownerName
  if (raw.hub && typeof raw.hub === 'object') {
    out.hub = {
      name: typeof raw.hub.name === 'string' ? raw.hub.name : '',
      slug: typeof raw.hub.slug === 'string' ? raw.hub.slug : '',
      timezone: typeof raw.hub.timezone === 'string' && raw.hub.timezone ? raw.hub.timezone : DEFAULT_TZ,
    }
  }
  if (Array.isArray(raw.activities)) out.activities = raw.activities.filter((a) => typeof a === 'string')
  if (raw.schedule && typeof raw.schedule === 'object') out.schedule = raw.schedule
  if (Array.isArray(raw.invites)) {
    out.invites = raw.invites
      .filter((iv) => iv && typeof iv.email === 'string')
      .map((iv) => ({ email: iv.email }))
  }
  if (typeof raw.hubId === 'string') out.hubId = raw.hubId
  if (typeof raw.hubSlug === 'string') out.hubSlug = raw.hubSlug
  return out
}

export function loadWizard(storage) {
  try {
    const rawText = storage?.getItem?.(STORAGE_KEY)
    if (!rawText) return defaultWizardState()
    return sanitizeWizardState(JSON.parse(rawText))
  } catch {
    return defaultWizardState()
  }
}

export function saveWizard(storage, state) {
  try {
    storage?.setItem?.(STORAGE_KEY, JSON.stringify(sanitizeWizardState(state)))
  } catch {
    /* storage full / unavailable — non-fatal; the wizard still works in-memory */
  }
}

export function clearWizard(storage) {
  try {
    storage?.removeItem?.(STORAGE_KEY)
  } catch {
    /* non-fatal */
  }
}

/**
 * Where to resume on load, reconciling persisted progress with the LIVE session
 * and hub state (which are the ground truth — localStorage can lie / be stale).
 *   - already has a hub  -> 'done' (signup complete; caller routes to /app)
 *   - signed in, no hub  -> resume in the provisioning steps (default 'hub')
 *   - not signed in      -> 'verify' if an account was started, else 'account'
 */
export function deriveResumeStep({ hasSession, hasHub, persistedStep }) {
  if (hasHub) return 'done'
  const provisioning = ['hub', 'activities', 'schedule', 'invites']
  if (hasSession) {
    return provisioning.includes(persistedStep) ? persistedStep : 'hub'
  }
  return persistedStep === 'verify' ? 'verify' : 'account'
}
