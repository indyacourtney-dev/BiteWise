// utils/validation.ts
//
// The signup guardrails. Pure functions with no UI so they can be unit
// tested, and so the rules live in exactly one place — the auth screen
// renders whatever these return.

// ============================================
// EMAIL
// ============================================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): string | null {
  const e = email.trim();
  if (!e) return 'Email is required.';
  if (!EMAIL_RE.test(e)) return 'That doesn’t look like a valid email address.';
  return null;
}

// ============================================
// USERNAME
// ============================================
// Rules: 3–20 characters, letters/numbers/underscores only, must start
// with a letter. Rejecting leading digits/underscores keeps usernames
// readable and avoids lookalike spoofing like "_admin".

const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{2,19}$/;

export function validateUsername(username: string): string | null {
  const u = username.trim();
  if (!u) return 'Username is required.';
  if (u.length < 3) return 'Username must be at least 3 characters.';
  if (u.length > 20) return 'Username must be 20 characters or fewer.';
  if (!/^[A-Za-z]/.test(u)) return 'Username must start with a letter.';
  if (!USERNAME_RE.test(u)) return 'Only letters, numbers, and underscores allowed.';
  return null;
}

// ============================================
// PASSWORD
// ============================================
// Returned as a checklist so the signup screen can show each rule
// flipping green as the user types, instead of a mystery rejection
// after they hit submit.

export interface PasswordCheck {
  label: string;
  ok: boolean;
}

export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'An uppercase letter (A–Z)', ok: /[A-Z]/.test(password) },
    { label: 'A lowercase letter (a–z)', ok: /[a-z]/.test(password) },
    { label: 'A number (0–9)', ok: /[0-9]/.test(password) },
    { label: 'A symbol (!@#$…)', ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function validatePassword(password: string): string | null {
  const failed = passwordChecks(password).filter(c => !c.ok);
  if (failed.length === 0) return null;
  return 'Password needs: ' + failed.map(c => c.label.toLowerCase()).join(', ') + '.';
}
