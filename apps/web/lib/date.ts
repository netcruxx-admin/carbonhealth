/**
 * Formats an ISO date string (or datetime string) as "8 Aug 2026".
 * Safe against null / undefined — returns `fallback` (default "—") when the
 * value is missing.  Always appends T00:00:00 before parsing so the local
 * timezone never shifts the date to the previous day.
 */
export function fmtDate(iso: string | null | undefined, fallback = '—'): string {
  if (!iso) return fallback;
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Whole years from an ISO date of birth to today. Returns `null` when the value
 * is missing, unparseable, or in the future — age is always derived from the
 * stored DOB, never stored itself, so it cannot go stale.
 */
export function ageFromDob(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const dob = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age < 0 ? null : age;
}

/**
 * Age as a short display string, e.g. "34 yrs". `fallback` (default "—") when
 * there is no usable date of birth.
 */
export function fmtAge(iso: string | null | undefined, fallback = '—'): string {
  const age = ageFromDob(iso);
  if (age === null) return fallback;
  return `${age} yr${age === 1 ? '' : 's'}`;
}
