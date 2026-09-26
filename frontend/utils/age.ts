// utils/age.ts — birthday and age rules for the alcohol safeguard.
//
// Birthdays are stored as 'YYYY-MM-DD' strings (no time zone surprises).
// Someone born on Feb 29 turns a year older on Mar 1 in non-leap years,
// the stricter of the two common readings. The database uses the same rule
// (backend migration 20261001000000_age_safeguard.sql).

/** The US legal drinking age. Recipes made with alcohol need this. */
export const LEGAL_DRINKING_AGE = 21;

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Today's date in the phone's time zone as 'YYYY-MM-DD'. */
export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function parts(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export type BirthDateResult = { ok: true; iso: string } | { ok: false; error: string };

/** Checks what was typed in the month / day / year boxes. */
export function parseBirthDate(month: string, day: string, year: string, today = todayIso()): BirthDateResult {
  const m = Number(month);
  const d = Number(day);
  const y = Number(year);
  if (!month || !day || !year) return { ok: false, error: 'Enter your month, day and year.' };
  if (!Number.isInteger(m) || m < 1 || m > 12) return { ok: false, error: 'Month should be 1 to 12.' };
  if (!Number.isInteger(y) || year.length !== 4) return { ok: false, error: 'Year should have 4 digits, like 2004.' };
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (!Number.isInteger(d) || d < 1 || d > daysInMonth) {
    return { ok: false, error: `${MONTH_NAMES[m - 1]} ${y} has ${daysInMonth} days.` };
  }
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  if (iso > today) return { ok: false, error: "That date hasn't happened yet." };
  if (y < 1900) return { ok: false, error: 'Check the year.' };
  return { ok: true, iso };
}

/** Whole years between the birthday and `on` (default today). */
export function ageOn(birthIso: string, on = todayIso()): number {
  const b = parts(birthIso);
  const t = parts(on);
  if (!b || !t) return 0;
  let age = t[0] - b[0];
  // Birthday not reached yet this year (Feb 29 counts as reached on Mar 1).
  if (t[1] < b[1] || (t[1] === b[1] && t[2] < b[2])) age -= 1;
  return age;
}

/** false when the birthday is unknown: the safeguard fails closed. */
export function isOfDrinkingAge(birthIso: string | null | undefined, on = todayIso()): boolean {
  return !!birthIso && ageOn(birthIso, on) >= LEGAL_DRINKING_AGE;
}

/** "March 4, 2004" */
export function formatBirthDate(iso: string): string {
  const p = parts(iso);
  return p ? `${MONTH_NAMES[p[1] - 1]} ${p[2]}, ${p[0]}` : iso;
}
