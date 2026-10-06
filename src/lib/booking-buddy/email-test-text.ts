/**
 * Test helper for the Booking Buddy email formatters: what a recipient reads,
 * i.e. the HTML with comments and every tag (and its attributes) removed.
 *
 * Not a `*.test.ts` file, so `npm test` imports it but never runs it as a
 * suite. Relative imports only (none needed), so it works under `node --test`.
 */
export function visibleText(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}
