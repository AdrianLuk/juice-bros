/**
 * The group-chat message a copy control puts on the clipboard alongside the
 * Club QR link (issue #517) — plain text, written once so an Organizer never
 * has to explain On Deck to their own room.
 *
 * No path aliases or server imports, so it can be unit tested directly with
 * `node --test` rather than only through a browser.
 *
 * The link is the stable Club QR path (never per-Session), pinned once and
 * reused every week — the copy says nothing that only holds true "tonight".
 */
export function buildJoinMessage(clubName: string, url: string): string {
  return [
    `Join ${clubName}'s queue here: ${url}`,
    "No app, no sign-up. Just your name and how you play, then watch for your court.",
  ].join("\n");
}
