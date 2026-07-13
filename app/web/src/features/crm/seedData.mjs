// The 10 pilot archetype slots (T-008), verbatim from docs/PILOT_TARGETS.md "The
// 10 slots" table, IN THE LISTED APPROACH ORDER (slot order is the GTM strategy —
// see R-002/P.8 — never re-sorted). Real business names are still placeholders
// per PILOT_TARGETS' Unknowns (founder fills them from his metro); this module is
// the single source of truth both the seed script and its unit test read from, so
// the two can never drift.
//
// Deterministic ids/slugs (crypto-free, pure JS) keep the seed idempotent across
// re-runs without needing a database round-trip to check "does this exist".

export const PILOT_ARCHETYPES = [
  {
    slot: 1,
    archetype: 'Multi-activity kids hub / enrichment center',
    whySlot: 'Bullseye ICP — the segment no incumbent fits (R-002); worst current tooling',
    freeLayerHook: 'Booking page: one link for ALL their programs',
  },
  {
    slot: 2,
    archetype: 'Multi-activity kids hub / enrichment center',
    whySlot: 'Bullseye ICP — the segment no incumbent fits (R-002); worst current tooling',
    freeLayerHook: 'Booking page: one link for ALL their programs',
  },
  {
    slot: 3,
    archetype: 'Play café / indoor playground with classes',
    whySlot: 'Booking + capacity pain daily; owner on-site and reachable',
    freeLayerHook: 'Booking/waitlist page + kiosk check-in',
  },
  {
    slot: 4,
    archetype: 'Swim school (parent-tot + preschool lessons)',
    whySlot: 'High-anxiety parents = highest photo/update value; skill-level comms later',
    freeLayerHook: 'Photo moments ("she put her face in!")',
  },
  {
    slot: 5,
    archetype: 'Dance studio with tiny-tots program',
    whySlot: 'Dee persona; recital-season chaos; dated DSP/Jackrabbit portals',
    freeLayerHook: 'Updates + photos; costume-prep announcements',
  },
  {
    slot: 6,
    archetype: 'Gymnastics gym with parent-tot classes',
    whySlot: 'iClassPro heartland — validate we can win here on simplicity',
    freeLayerHook: 'Kiosk check-in (front-desk bottleneck)',
  },
  {
    slot: 7,
    archetype: 'Martial arts with Little Dragons/Ninjas (3–5)',
    whySlot: 'Owner-operator, marketing-hungry, IG-active',
    freeLayerHook: 'Booking page as their link-in-bio',
  },
  {
    slot: 8,
    archetype: 'Kids art studio',
    whySlot: 'Small, spreadsheet-run, fast yes/no; photos = the product itself',
    freeLayerHook: 'Photo moments + requests inbox',
  },
  {
    slot: 9,
    archetype: "Church preschool / Mother's Day Out program",
    whySlot: 'Low budget but massive word-of-mouth density among target parents',
    freeLayerHook: 'Free forever layer; announcements',
  },
  {
    slot: 10,
    archetype: 'Drop-in hourly childcare / play space',
    whySlot: 'Check-in/out compliance need; closest to brightwheel turf — learn the boundary',
    freeLayerHook: 'Kiosk + daily notes',
  },
]

function slugifyArchetype(archetype, slot) {
  const base = String(archetype)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '')
  return `prospect-${String(slot).padStart(2, '0')}-${base}`
}

/** Deterministic UUID v4-shaped id for slot N — stable across re-runs (no
 * randomness), which is what makes the seed idempotent via upsert(onConflict:id). */
function deterministicId(slot) {
  const hex = String(slot).padStart(12, '0')
  return `00000000-0000-4000-b000-${hex}`
}

/** Builds the 10 seed rows: {id, slug, name, archetype, whySlot, freeLayerHook,
 * notes} — `notes` is the exact string written to crm_hub_profiles.notes (spec:
 * "archetype + free-layer hook in notes"). Placeholder `name` is intentionally
 * labeled as such (never presented as a real business) until the founder fills
 * the real name in per PILOT_TARGETS' sourcing playbook. */
export function buildSeedRows() {
  return PILOT_ARCHETYPES.map((row) => {
    const name = `Prospect #${row.slot} — ${row.archetype} (name TBD)`
    return {
      id: deterministicId(row.slot),
      slug: slugifyArchetype(row.archetype, row.slot),
      name,
      slot: row.slot,
      archetype: row.archetype,
      whySlot: row.whySlot,
      freeLayerHook: row.freeLayerHook,
      notes: `Archetype: ${row.archetype}. Free-layer hook: ${row.freeLayerHook}.`,
    }
  })
}
