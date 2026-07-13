/** Plain-language age from a birthdate (P.9 vocabulary — never raw ISO dates in a
 * roster row). Under 24 months shows months (parents of infants/toddlers think in
 * months); 24+ shows years. */
export function ageLabel(birthdate: string | null): string | null {
  if (!birthdate) return null
  const birth = new Date(birthdate)
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (now.getDate() < birth.getDate()) months -= 1
  if (months < 0) return null
  if (months < 24) return `${months} mo`
  const years = Math.floor(months / 12)
  return `${years} yr${years === 1 ? '' : 's'}`
}
