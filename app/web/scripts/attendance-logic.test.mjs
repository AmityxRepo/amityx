#!/usr/bin/env node
/**
 * Amityx — attendance offline-queue / idempotency unit tests (T-007).
 *
 * Built and verified FIRST per the planner's risk note: kiosk + offline optimistic
 * sync is the hardest sub-flow in this task. No network, no DB. Run:
 *   cd app/web && node --test scripts/attendance-logic.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  attendanceKey,
  serverStatus,
  nextAction,
  overlayStatus,
  deriveStatus,
  buildTapItem,
  enqueue,
  markSyncing,
  markFailed,
  removeByKey,
  pendingItems,
  syncOnce,
  loadQueue,
  saveQueue,
  clearQueue,
  STORAGE_KEY,
} from '../src/features/attendance/queue.mjs'

// ─── status derivation ───────────────────────────────────────────────
test('serverStatus reads the attendance row shape', () => {
  assert.equal(serverStatus(null), 'not_checked_in')
  assert.equal(serverStatus(undefined), 'not_checked_in')
  assert.equal(serverStatus({ checked_in_at: '2026-07-12T10:00:00Z', checked_out_at: null }), 'checked_in')
  assert.equal(
    serverStatus({ checked_in_at: '2026-07-12T10:00:00Z', checked_out_at: '2026-07-12T11:00:00Z' }),
    'checked_out',
  )
})

test('nextAction cycles not_checked_in -> check_in -> check_out -> terminal', () => {
  assert.equal(nextAction('not_checked_in'), 'check_in')
  assert.equal(nextAction('checked_in'), 'check_out')
  assert.equal(nextAction('checked_out'), null) // terminal: no dead click, but no further write
})

test('overlayStatus lets a queued item optimistically override the server status', () => {
  const checkInItem = { key: 'a', sessionId: 's1', childId: 'c1', action: 'check_in' }
  const checkOutItem = { key: 'b', sessionId: 's1', childId: 'c1', action: 'check_out' }
  assert.equal(overlayStatus('not_checked_in', []), 'not_checked_in')
  assert.equal(overlayStatus('not_checked_in', [checkInItem]), 'checked_in')
  // a queued check_out always wins visually, even if a check_in is also present
  assert.equal(overlayStatus('not_checked_in', [checkInItem, checkOutItem]), 'checked_out')
})

test('deriveStatus combines a server row + the live queue for one (session, child) pair', () => {
  const queue = [{ key: attendanceKey('s1', 'c1', 'check_in'), sessionId: 's1', childId: 'c1', action: 'check_in' }]
  assert.equal(deriveStatus(null, queue, 's1', 'c1'), 'checked_in') // optimistic, not yet synced
  assert.equal(deriveStatus(null, queue, 's1', 'c2'), 'not_checked_in') // different child, untouched
})

// ─── buildTapItem / enqueue idempotency (the core guarantee) ─────────
test('buildTapItem returns null once a pair is checked_out (terminal — no further queue growth)', () => {
  assert.equal(buildTapItem({ sessionId: 's1', childId: 'c1', status: 'checked_out', clientTs: 't' }), null)
})

test('a double-tap (two events reading the identical, not-yet-re-rendered status) enqueues exactly once', () => {
  const tap = () => buildTapItem({ sessionId: 's1', childId: 'c1', status: 'not_checked_in', clientTs: '2026-07-12T09:00:00Z' })
  let queue = []
  queue = enqueue(queue, tap()) // first event of the "double tap"
  queue = enqueue(queue, tap()) // second event — same status snapshot, same key
  assert.equal(queue.length, 1)
  assert.equal(queue[0].action, 'check_in')
})

test('a deliberate check-in then a later check-out are two distinct, ordered queue entries', () => {
  let queue = []
  queue = enqueue(queue, buildTapItem({ sessionId: 's1', childId: 'c1', status: 'not_checked_in', clientTs: 't0' }))
  // status is recomputed from the updated queue before the second tap, as the UI would do
  const status = deriveStatus(null, queue, 's1', 'c1')
  assert.equal(status, 'checked_in')
  queue = enqueue(queue, buildTapItem({ sessionId: 's1', childId: 'c1', status, clientTs: 't1' }))
  assert.equal(queue.length, 2)
  assert.deepEqual(queue.map((i) => i.action), ['check_in', 'check_out'])
})

test('enqueue never duplicates an already-queued key regardless of item status', () => {
  const item = buildTapItem({ sessionId: 's1', childId: 'c1', status: 'not_checked_in', clientTs: 't0' })
  let queue = enqueue([], item)
  queue = markSyncing(queue, item.key)
  queue = enqueue(queue, { ...item }) // replay while it's mid-sync
  assert.equal(queue.length, 1)
  assert.equal(queue[0].status, 'syncing')
})

// ─── syncOnce: offline -> reconnect convergence, no data loss ────────
test('syncOnce requeues (never drops) an item when the writer rejects (offline/network error)', async () => {
  const item = buildTapItem({ sessionId: 's1', childId: 'c1', status: 'not_checked_in', clientTs: 't0' })
  const queue = enqueue([], item)
  const offlineWriter = async () => {
    throw new Error('network unavailable')
  }
  const { queue: after, results } = await syncOnce(queue, offlineWriter)
  assert.equal(after.length, 1)
  assert.equal(after[0].status, 'pending') // back to pending, ready for the next pass
  assert.equal(after[0].attempts, 1)
  assert.equal(results[0].outcome, 'error')
})

test('syncOnce converges to empty once the writer succeeds after reconnect', async () => {
  const item = buildTapItem({ sessionId: 's1', childId: 'c1', status: 'not_checked_in', clientTs: 't0' })
  let queue = enqueue([], item)

  // pass 1: offline
  ;({ queue } = await syncOnce(queue, async () => {
    throw new Error('offline')
  }))
  assert.equal(queue.length, 1)

  // pass 2: back online
  const onlineWriter = async () => 'applied'
  const result = await syncOnce(queue, onlineWriter)
  assert.equal(result.queue.length, 0)
  assert.equal(result.results[0].outcome, 'applied')
})

test('syncOnce processes a child\'s queued items in order (check_in before check_out)', async () => {
  let queue = []
  queue = enqueue(queue, buildTapItem({ sessionId: 's1', childId: 'c1', status: 'not_checked_in', clientTs: 't0' }))
  queue = enqueue(
    queue,
    buildTapItem({ sessionId: 's1', childId: 'c1', status: deriveStatus(null, queue, 's1', 'c1'), clientTs: 't1' }),
  )
  assert.equal(queue.length, 2)

  const order = []
  const writer = async (item) => {
    order.push(item.action)
    return 'applied'
  }
  const { queue: after } = await syncOnce(queue, writer)
  assert.equal(after.length, 0)
  assert.deepEqual(order, ['check_in', 'check_out']) // never out of order
})

// ─── the acceptance check, proven directly: replay/duplicate-proof via a fake
// server that mirrors the REAL recordAttendance guard (first-write-wins) ──────
function fakeAttendanceServer() {
  const rows = new Map() // key: `${sessionId}::${childId}` -> { checked_in_at, checked_out_at }
  return {
    rows,
    async write(item) {
      const rowKey = `${item.sessionId}::${item.childId}`
      const existing = rows.get(rowKey)
      if (item.action === 'check_in') {
        if (existing) return 'noop' // idempotent: checked_in_at is set exactly once
        rows.set(rowKey, { checked_in_at: item.clientTs, checked_out_at: null })
        return 'applied'
      }
      // check_out: only ever set once (guarded UPDATE ... WHERE checked_out_at IS NULL)
      if (!existing) throw new Error('not_checked_in')
      if (existing.checked_out_at) return 'noop'
      existing.checked_out_at = item.clientTs
      return 'applied'
    },
  }
}

test('replaying the exact same check-in write against the real-shaped server never duplicates', async () => {
  const server = fakeAttendanceServer()
  const item = buildTapItem({ sessionId: 's1', childId: 'c1', status: 'not_checked_in', clientTs: '2026-07-12T09:00:00Z' })

  // First sync: applies for real.
  const first = await syncOnce(enqueue([], item), (i) => server.write(i))
  assert.equal(first.results[0].outcome, 'applied')
  assert.equal(server.rows.size, 1)
  const rowAfterFirst = { ...server.rows.get('s1::c1') }

  // Replay: a stale duplicate of the SAME item resurfaces (e.g. a crash re-hydrated an
  // already-synced queue entry from localStorage before the removal was persisted).
  const replay = await syncOnce(enqueue([], { ...item }), (i) => server.write(i))
  assert.equal(replay.results[0].outcome, 'noop') // idempotent — not a second check-in
  assert.equal(server.rows.size, 1) // still exactly one attendance row
  assert.deepEqual(server.rows.get('s1::c1'), rowAfterFirst) // timestamp unchanged, no drift
})

test('the full offline double-tap scenario: two rapid taps, offline, then reconnect — exactly one check-in ever lands', async () => {
  const server = fakeAttendanceServer()
  let queue = []

  // Two rapid taps while offline, both reading the same pre-render status (fat-finger /
  // duplicate event dispatch) — must collapse to one queue entry.
  const tap = () => buildTapItem({ sessionId: 's1', childId: 'c1', status: 'not_checked_in', clientTs: '2026-07-12T09:00:00Z' })
  queue = enqueue(queue, tap())
  queue = enqueue(queue, tap())
  assert.equal(queue.length, 1)

  // Still offline: sync attempt fails, item is preserved for retry.
  ;({ queue } = await syncOnce(queue, async () => {
    throw new Error('offline')
  }))
  assert.equal(queue.length, 1)
  assert.equal(server.rows.size, 0)

  // Reconnect: syncs cleanly, exactly once.
  const after = await syncOnce(queue, (i) => server.write(i))
  assert.equal(after.queue.length, 0)
  assert.equal(server.rows.size, 1)
  assert.equal(server.rows.get('s1::c1').checked_out_at, null)
})

// ─── persistence (offline page reload must not lose queued taps) ────
function fakeStorage() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  }
}

test('save/load round-trips the queue through storage (survives an offline reload)', () => {
  const store = fakeStorage()
  const item = buildTapItem({ sessionId: 's1', childId: 'c1', status: 'not_checked_in', clientTs: 't0' })
  const queue = enqueue([], item)
  saveQueue(store, queue)
  const loaded = loadQueue(store)
  assert.equal(loaded.length, 1)
  assert.equal(loaded[0].key, item.key)
  clearQueue(store)
  assert.equal(store.getItem(STORAGE_KEY), null)
})

test('loadQueue is defensive against garbage/corrupt storage', () => {
  assert.deepEqual(loadQueue({ getItem: () => 'not json{' }), [])
  assert.deepEqual(loadQueue({ getItem: () => JSON.stringify([{ bogus: true }]) }), [])
  assert.deepEqual(loadQueue(null), [])
})

test('removeByKey and pendingItems are simple, pure filters', () => {
  const a = { key: 'a', status: 'pending' }
  const b = { key: 'b', status: 'syncing' }
  assert.deepEqual(pendingItems([a, b]), [a])
  assert.deepEqual(removeByKey([a, b], 'a'), [b])
})

test('markFailed increments attempts and returns the item to pending', () => {
  const item = { key: 'a', status: 'syncing', attempts: 0 }
  const [after] = markFailed([item], 'a')
  assert.equal(after.status, 'pending')
  assert.equal(after.attempts, 1)
})
