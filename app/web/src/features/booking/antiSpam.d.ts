export function isHoneypotTripped(honeypotValue: unknown): boolean

export function isFillTooFast(openedAtMs: number, submittedAtMs: number, minMs?: number): boolean

export function shouldSilentlyDrop(input: {
  honeypotValue: unknown
  openedAtMs: number
  submittedAtMs: number
  minMs?: number
}): boolean
