/**
 * The Club QR's shape, with a pure home.
 *
 * Drawing a QR is server work (`qr.ts` is `server-only`), but every board that
 * *renders* one only needs to know what the drawn thing looks like. Keeping
 * the type here is what stops a presentational component importing a
 * `server-only` module for a type alone — the same rule the fold's read model
 * follows (issue #514), and what lets the browser-only demo (#519) render the
 * floor screen with no database anywhere in its import graph.
 *
 * No imports, by design.
 */

/** The Club QR as drawn markup plus the link it encodes. */
export type ClubJoinQr = { url: string; svg: string };
