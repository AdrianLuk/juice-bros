import "server-only";

import QRCode from "qrcode";

import { onDeckAbsoluteUrl } from "./request-origin.ts";
import { clubQrPath } from "./routes.ts";

/** The Club QR as drawn markup plus the link it encodes. */
export type ClubJoinQr = { url: string; svg: string };

/**
 * The Club QR as an inline SVG plus the link it encodes, rendered server-side
 * — no client JS, no image request. Every on-screen QR in On Deck goes
 * through here so they all encode the *same* stable Club link the printed
 * sign carries, never a per-Session one.
 *
 * The `margin: 1` quiet zone is deliberately tight: every surface that draws
 * this sits it on a padded white card, which supplies the rest of the quiet
 * zone the scanner needs against a dark arena panel.
 */
export async function clubJoinQr(clubId: string): Promise<ClubJoinQr> {
  const url = await onDeckAbsoluteUrl(clubQrPath(clubId));
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });

  // A bare `<svg>` carries an implicit `img` role, so the drawn code would
  // announce itself a second time with no name of its own. Every caller wraps
  // it in an element that *is* labelled — this hides the duplicate.
  return { url, svg: svg.replace("<svg", '<svg aria-hidden="true"') };
}
