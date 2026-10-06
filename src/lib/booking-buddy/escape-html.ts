/**
 * Escape a string for interpolation into HTML text or a double-quoted
 * attribute — used when assembling notification emails by hand (the shared
 * email layout, `email-layout.ts`).
 *
 * Free of Next.js and Supabase imports so the email formatters that use it stay
 * unit-testable under `node --test`.
 */
export function escapeHtml(value: string): string {
  return escapeHtmlText(value).replace(/'/g, "&#39;");
}

/**
 * Escape a string for an HTML text node (or a double-quoted attribute), leaving
 * apostrophes as they are. A text node can't be broken out of with `'`, and
 * email copy is full of "you'll" / "don't": keeping them literal keeps the
 * plain-text fallback some clients derive from the HTML readable.
 */
export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
