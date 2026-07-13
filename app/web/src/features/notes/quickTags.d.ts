export interface QuickTag {
  id: string
  label: string
}

export const QUICK_TAGS: QuickTag[]

export function isValidTag(id: string): boolean
export function toggleTag(selected: string[] | null | undefined, id: string): string[]
export function composeNoteBody(input: { tags: string[]; text: string }): string
