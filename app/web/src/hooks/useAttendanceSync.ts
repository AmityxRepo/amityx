import { useCallback, useEffect, useRef, useState } from 'react'
import { repository } from '../repository'
import {
  buildTapItem,
  deriveStatus,
  enqueue,
  loadQueue,
  saveQueue,
  syncOnce,
} from '../features/attendance/queue'
import type { AttendanceQueueItem, AttendanceRow, AttendanceStatus } from '../features/attendance/queue'

/**
 * Wraps the pure offline queue (features/attendance/queue.mjs) with the bits that
 * need the browser/network: localStorage persistence, an online/offline listener,
 * and a periodic retry so a missed 'online' event doesn't strand queued taps.
 *
 * A tap NEVER waits on the network: `tap()` updates the queue (and therefore what
 * `statusFor` returns) synchronously, then fires a sync attempt in the background.
 */
export function useAttendanceSync() {
  const [queue, setQueue] = useState<AttendanceQueueItem[]>(() => loadQueue(window.localStorage))
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const queueRef = useRef(queue)
  queueRef.current = queue
  const syncingRef = useRef(false)

  useEffect(() => {
    saveQueue(window.localStorage, queue)
  }, [queue])

  const flush = useCallback(async () => {
    if (!repository) return
    if (syncingRef.current) return
    if (queueRef.current.length === 0) return
    syncingRef.current = true
    try {
      const { queue: after } = await syncOnce(queueRef.current, async (item: AttendanceQueueItem) => {
        const result = await repository!.recordAttendance({
          hubId: item.hubId ?? '',
          sessionId: item.sessionId,
          childId: item.childId,
          action: item.action,
          clientTs: item.clientTs,
          method: item.method,
        })
        if (!result.ok) throw new Error(result.reason)
        return result.outcome
      })
      // Update the ref synchronously too — setQueue's re-render hasn't committed
      // yet, and a tap right after this flush must see the post-sync queue, not a
      // stale snapshot (React batches state updates asynchronously).
      queueRef.current = after
      setQueue(after)
    } finally {
      syncingRef.current = false
    }
  }, [])

  useEffect(() => {
    function goOnline() {
      setOnline(true)
      void flush()
    }
    function goOffline() {
      setOnline(false)
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    // Try immediately on mount (covers the common "already online" case), then
    // retry periodically — belt-and-braces in case a browser suppresses the
    // 'online' event (some in-app/kiosk webviews do).
    void flush()
    const interval = window.setInterval(() => void flush(), 5000)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.clearInterval(interval)
    }
  }, [flush])

  const statusFor = useCallback(
    (sessionId: string, childId: string, row: AttendanceRow | null | undefined): AttendanceStatus =>
      deriveStatus(row, queue, sessionId, childId),
    [queue],
  )

  const tap = useCallback(
    (input: { sessionId: string; childId: string; hubId: string; status: AttendanceStatus; method?: 'staff' | 'kiosk' }) => {
      const item = buildTapItem({
        sessionId: input.sessionId,
        childId: input.childId,
        hubId: input.hubId,
        status: input.status,
        clientTs: new Date().toISOString(),
        method: input.method ?? 'staff',
      })
      if (!item) return
      // Update the ref synchronously (see the comment in `flush`) so an immediate
      // flush right after this tap sees the item that was just enqueued.
      const next = enqueue(queueRef.current, item)
      queueRef.current = next
      setQueue(next)
      void flush()
    },
    [flush],
  )

  const pendingCount = queue.filter((i) => i.status === 'pending' || i.status === 'syncing').length

  return { statusFor, tap, online, pendingCount }
}
