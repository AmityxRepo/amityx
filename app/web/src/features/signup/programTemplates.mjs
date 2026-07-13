// Activity templates for the signup picker (T-006). `type` values are the exact
// program_type enum (schema-precise); `label`/`description` are the P.9 canonical
// UI copy shown to the owner. `preChecked` are the sensible defaults (rule 7:
// "defaults work") — the two lowest-setup activities almost every toddler &
// preschool hub runs — the owner toggles the rest. This module is not scanned by
// lint:vocab (it lives under src/features), but its copy still honors the P.9
// vocabulary so the picker reads clean.

export const ACTIVITY_TEMPLATES = [
  { type: 'art',       label: 'Art',       description: 'Painting, crafts, and messy creative time.', ageMinMonths: 18, ageMaxMonths: 96, preChecked: true },
  { type: 'open_play', label: 'Open play', description: 'Free play in a safe indoor space.',          ageMinMonths: 0,  ageMaxMonths: 60, preChecked: true },
  { type: 'swim',      label: 'Swim',      description: 'Water lessons for little ones.',              ageMinMonths: 6,  ageMaxMonths: 96, preChecked: false },
  { type: 'karate',    label: 'Karate',    description: 'Beginner martial arts and movement.',        ageMinMonths: 36, ageMaxMonths: 96, preChecked: false },
  { type: 'daycare',   label: 'Daycare',   description: 'Full or half-day care.',                     ageMinMonths: 6,  ageMaxMonths: 60, preChecked: false },
  { type: 'bootcamp',  label: 'Boot camp', description: 'Active play and simple fitness.',            ageMinMonths: 36, ageMaxMonths: 96, preChecked: false },
  { type: 'camp',      label: 'Camp',      description: 'School-break and seasonal day camp.',         ageMinMonths: 36, ageMaxMonths: 96, preChecked: false },
]

export const ACTIVITY_TYPES = ACTIVITY_TEMPLATES.map((t) => t.type)

/** The types checked by default when the picker first opens. */
export function defaultSelectedTypes() {
  return ACTIVITY_TEMPLATES.filter((t) => t.preChecked).map((t) => t.type)
}

/** Look up a template by its program_type. */
export function templateFor(type) {
  return ACTIVITY_TEMPLATES.find((t) => t.type === type) ?? null
}

/**
 * Build the `p_activities` payload for provision_hub from the selected types,
 * seeding each with its template name + default age band.
 */
export function activitiesPayload(selectedTypes) {
  return (selectedTypes ?? [])
    .map((type) => templateFor(type))
    .filter(Boolean)
    .map((t) => ({
      type: t.type,
      name: t.label,
      age_min_months: t.ageMinMonths,
      age_max_months: t.ageMaxMonths,
    }))
}
