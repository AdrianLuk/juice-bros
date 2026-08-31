/**
 * Escape a string for interpolation into HTML text or a double-quoted
 * attribute — used when assembling notification emails by hand (`reminders.ts`,
 * `connection-request-email.ts`).
 *
 * Free of Next.js and Supabase imports so the email formatters that use it stay
 * unit-testable under `node --test`.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
