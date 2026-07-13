// Offline-tolerant, idempotent attendance queue (T-007).
//
// This is the hardest sub-flow in T-007 (planner's risk note) — built and unit-tested
// FIRST, before any UI. It has to guarantee: a tap commits optimistically, survives a
// reconnect, and a double-tap or replay never duplicates a check-in/check-out.
//
// Two layers of idempotency, on purpose:
//   1. HERE (client, pure): `enqueue` dedupes by a stable key
//      `${sessionId}::${childId}::${action}` — a double-tap (two events for what the
//      user perceives as one tap, both reading the same not-yet-re-rendered status)
//      builds the identical item and collapses to a single queue entry.
//   2. In `recordAttendance` (app/web/src/repository/api.ts): the DB write itself is
//      first-write-wins (INSERT for check_in, guarded UPDATE ... WHERE checked_out_at
//      IS NULL for check_out), so even a REPLAYED write (queue re-hydrated from
//      localStorage after a crash, a retried request whose first attempt actually
//      landed, etc.) is a safe no-op, never a duplicate/duplicated timestamp.
// Layer 1 avoids a wasted round-trip in the common case; layer 2 is the real
// guarantee and is what's exercised end-to-end once the live schema is up.
//
// Pure, no I/O, no Supabase import — storage is injected (same pattern as
// features/signup/wizard.mjs) so this is fully unit-testable with `node --test`.

export const STORAGE_KEY = 'amityx.attendanceQueue.v1'

/** Stable idempotency key for one attendance write. */
export function attendanceKey(sessionId, childId, action) {
  return `${sessionId}::${childId}::${action}`
}

/** Server-reported status for a (session, child) pair from its attendance row, if any. */
export function serverStatus(row) {
  if (!row) return 'not_checked_in'
  if (row.checked_out_at) return 'checked_out'
  if (row.checked_in_at) return 'checked_in'
  return 'not_checked_in'
}

/**
 * What a tap on the CURRENT status should do next. `checked_out` is terminal for the
 * session — matches the DB shape (checked_in_at/checked_out_at are each set exactly
 * once, first-write-wins) and reads cleanly in a kiosk: once a child is checked out
 * for this class, the tile shows "Checked out" and stops accepting taps (no confusing
 * un-checkout, no accidental re-trigger).
 */
export function nextAction(status) {
  if (status === 'not_checked_in') return 'check_in'
  if (status === 'checked_in') return 'check_out'
  return null
}

/** All queue items (any status) touching one (session, child) pair. */
export function itemsForPair(queue, sessionId, childId) {
  return queue.filter((i) => i.sessionId === sessionId && i.childId === childId)
}

/**
 * Overlay not-yet-confirmed local queue items onto the server status, so the UI can
 * render the optimistic state immediately (and while offline, indefinitely).
 */
export function overlayStatus(baseStatus, pairItems) {
  if (pairItems.some((i) => i.action === 'check_out')) return 'checked_out'
  if (pairItems.some((i) => i.action === 'check_in')) return 'checked_in'
  return baseStatus
}

/** Derive the status to render for a (session, child) pair from server + queue. */
export function deriveStatus(row, queue, sessionId, childId) {
  return overlayStatus(serverStatus(row), itemsForPair(queue, sessionId, childId))
}

/** Build the queue item a tap should enqueue, or null if `status` is terminal.
 * `hubId` rides along only as write payload (recordAttendance needs it) — it plays
 * no part in the idempotency key, which stays exactly (session, child, action). */
export function buildTapItem({ sessionId, childId, hubId, status, clientTs, method }) {
  const action = nextAction(status)
  if (!action) return null
  return {
    key: attendanceKey(sessionId, childId, action),
    sessionId,
    childId,
    hubId: hubId ?? null,
    action,
    clientTs,
    method: method ?? 'staff',
    status: 'pending',
    attempts: 0,
  }
}

/**
 * Idempotent enqueue: if an item with the same key is already queued (in ANY status —
 * pending, syncing, or mid-retry), this exact write is already in flight, so a
 * double-tap/replay is a no-op, never a second entry.
 */
export function enqueue(queue, item) {
  if (!item) return queue
  if (queue.some((i) => i.key === item.key)) return queue
  return [...queue, item]
}

export function markSyncing(queue, key) {
  return queue.map((i) => (i.key === key ? { ...i, status: 'syncing' } : i))
}

/** A failed sync goes back to 'pending' (retried on the next pass) with attempts++. */
export function markFailed(queue, key) {
  return queue.map((i) => (i.key === key ? { ...i, status: 'pending', attempts: i.attempts + 1 } : i))
}

export function removeByKey(queue, key) {
  return queue.filter((i) => i.key !== key)
}

export function pendingItems(queue) {
  return queue.filter((i) => i.status === 'pending')
}

/**
 * Drain every pending item through `writer` IN ORDER, one at a time (never in
 * parallel) — order matters because a check_out write targets the row a check_in
 * write creates; syncing a child's items out of order would strand the check_out.
 * `writer(item)` resolves to 'applied' | 'noop' (both are success — 'noop' means the
 * DB already had this exact write, i.e. the idempotency guard fired) and REJECTS on a
 * real error (offline/network/RLS), which requeues the item instead of losing it.
 */
export async function syncOnce(queue, writer) {
  let next = queue
  const results = []
  for (const item of pendingItems(queue)) {
    next = markSyncing(next, item.key)
    try {
      const outcome = await writer(item)
      next = removeByKey(next, item.key)
      results.push({ key: item.key, outcome })
    } catch (error) {
      next = markFailed(next, item.key)
      results.push({ key: item.key, outcome: 'error', error })
    }
  }
  return { queue: next, results }
}

// ─── persistence (storage injected; survives an offline page reload) ────────
function isValidItem(i) {
  return (
    i &&
    typeof i.key === 'string' &&
    typeof i.sessionId === 'string' &&
    typeof i.childId === 'string' &&
    (i.action === 'check_in' || i.action === 'check_out')
  )
}

export function loadQueue(storage) {
  try {
    const raw = storage?.getItem?.(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isValidItem) : []
  } catch {
    return []
  }
}

export function saveQueue(storage, queue) {
  try {
    storage?.setItem?.(STORAGE_KEY, JSON.stringify(queue))
  } catch {
    /* storage full/unavailable — non-fatal; the queue still works in-memory this tab */
  }
}

export function clearQueue(storage) {
  try {
    storage?.removeItem?.(STORAGE_KEY)
  } catch {
    /* non-fatal */
  }
}
