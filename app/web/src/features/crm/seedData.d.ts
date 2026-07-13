export interface PilotArchetype {
  slot: number
  archetype: string
  whySlot: string
  freeLayerHook: string
}

export interface SeedRow {
  id: string
  slug: string
  name: string
  slot: number
  archetype: string
  whySlot: string
  freeLayerHook: string
  notes: string
}

export const PILOT_ARCHETYPES: PilotArchetype[]
export function buildSeedRows(): SeedRow[]
