export type AttendanceAction = 'check_in' | 'check_out'
export type AttendanceStatus = 'not_checked_in' | 'checked_in' | 'checked_out'
export type QueueItemStatus = 'pending' | 'syncing'

export interface AttendanceRow {
  checked_in_at: string | null
  checked_out_at: string | null
}

export interface AttendanceQueueItem {
  key: string
  sessionId: string
  childId: string
  hubId: string | null
  action: AttendanceAction
  clientTs: string
  method: 'staff' | 'kiosk'
  status: QueueItemStatus
  attempts: number
}

export type SyncOutcome = 'applied' | 'noop'
export type SyncWriter = (item: AttendanceQueueItem) => Promise<SyncOutcome>

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const STORAGE_KEY: string

export function attendanceKey(sessionId: string, childId: string, action: AttendanceAction): string
export function serverStatus(row: AttendanceRow | null | undefined): AttendanceStatus
export function nextAction(status: AttendanceStatus): AttendanceAction | null
export function itemsForPair(
  queue: AttendanceQueueItem[],
  sessionId: string,
  childId: string,
): AttendanceQueueItem[]
export function overlayStatus(baseStatus: AttendanceStatus, pairItems: AttendanceQueueItem[]): AttendanceStatus
export function deriveStatus(
  row: AttendanceRow | null | undefined,
  queue: AttendanceQueueItem[],
  sessionId: string,
  childId: string,
): AttendanceStatus
export function buildTapItem(input: {
  sessionId: string
  childId: string
  hubId?: string | null
  status: AttendanceStatus
  clientTs: string
  method?: 'staff' | 'kiosk'
}): AttendanceQueueItem | null
export function enqueue(queue: AttendanceQueueItem[], item: AttendanceQueueItem | null): AttendanceQueueItem[]
export function markSyncing(queue: AttendanceQueueItem[], key: string): AttendanceQueueItem[]
export function markFailed(queue: AttendanceQueueItem[], key: string): AttendanceQueueItem[]
export function removeByKey(queue: AttendanceQueueItem[], key: string): AttendanceQueueItem[]
export function pendingItems(queue: AttendanceQueueItem[]): AttendanceQueueItem[]
export function syncOnce(
  queue: AttendanceQueueItem[],
  writer: SyncWriter,
): Promise<{ queue: AttendanceQueueItem[]; results: Array<{ key: string; outcome: SyncOutcome | 'error'; error?: unknown }> }>
export function loadQueue(storage: StorageLike | null | undefined): AttendanceQueueItem[]
export function saveQueue(storage: StorageLike | null | undefined, queue: AttendanceQueueItem[]): void
export function clearQueue(storage: StorageLike | null | undefined): void
