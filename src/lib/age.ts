/** Marcus's date of birth, `YYYY-MM-DD`. Single source of truth for the age. */
export const BIRTH_DATE = '2004-07-07'

/**
 * Whole years elapsed since a `YYYY-MM-DD` birth date on the local calendar.
 *
 * Pure and deterministic for a given `now`, so it produces the same value on
 * every render — no SSR/hydration drift, no flicker. Parses the date by its
 * numeric parts (not `new Date(string)`) to avoid the UTC-midnight off-by-one
 * that bites date-only strings near timezone boundaries.
 */
export function calculateAge(birthDate: string, now: Date = new Date()): number {
  const [year, month, day] = birthDate.split('-').map(Number)

  let age = now.getFullYear() - year
  const hadBirthdayThisYear =
    now.getMonth() + 1 > month ||
    (now.getMonth() + 1 === month && now.getDate() >= day)

  if (!hadBirthdayThisYear) age -= 1
  return age
}
