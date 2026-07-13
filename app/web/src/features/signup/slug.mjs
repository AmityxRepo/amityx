// Slug helpers for hub creation (T-006). Pure + framework-free so they run under
// `node --test` and in the browser. The server (provision_hub / slug_available)
// applies the SAME validity rule — keep them in sync.

/** Turn a hub name into a URL-safe slug candidate: lowercase, ASCII, hyphenated. */
export function slugify(name) {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics (café -> cafe)
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumerics -> hyphen
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .replace(/-{2,}/g, '-') // collapse runs
    .slice(0, 40)
    .replace(/-+$/g, '') // re-trim if the slice landed on a hyphen
}

/** Matches the server rule: a..z 0..9 hyphen-separated, length 3..40. */
export function isValidSlug(slug) {
  const s = String(slug ?? '')
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length >= 3 && s.length <= 40
}

/** Append a numeric suffix, keeping the whole slug within the 40-char cap. */
export function withSuffix(base, n) {
  const suffix = `-${n}`
  const trimmed = String(base).slice(0, 40 - suffix.length).replace(/-+$/g, '')
  return `${trimmed}${suffix}`
}

/**
 * First free candidate given an `isTaken(slug)` predicate (sync). Used in tests
 * and as the auto-suffix fallback; the live wizard checks availability against
 * the server (slug_available RPC) but reuses `withSuffix` for the suggestion.
 * Returns the base if free, else base-2, base-3, … up to `max` tries.
 */
export function nextAvailableSlug(base, isTaken, max = 50) {
  if (!isTaken(base)) return base
  for (let n = 2; n < max; n++) {
    const candidate = withSuffix(base, n)
    if (!isTaken(candidate)) return candidate
  }
  return withSuffix(base, Date.now() % 10000)
}
