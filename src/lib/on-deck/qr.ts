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

/** A downloadable rendering of the Club QR: the bytes plus how to serve them. */
export type ClubJoinQrImage = {
  url: string;
  body: string | Buffer;
  contentType: string;
};

export type ClubJoinQrFormat = "svg" | "png";

/**
 * The Club QR as a standalone file, for the two things an inline `<svg>` on a
 * page cannot do: hand a print shop something to work from, and paste the
 * code into a message. Served by the routes under `/on-deck/c/[clubId]/`.
 *
 * Deliberately *not* `clubJoinQr`: that one injects `aria-hidden` for the
 * labelled wrapper every on-page caller puts around it, which is exactly
 * wrong in a file that has no wrapper and is the whole document.
 *
 * The quiet zone is the other difference. On a page the padded white card
 * around the code supplies it; a file has nothing around it, so `margin: 4`
 * carries the four-module quiet zone the QR spec asks for. Without it a code
 * dropped straight onto a poster butts against whatever it is next to and
 * stops scanning.
 *
 * PNG comes from `qrcode` directly rather than by rasterising the SVG: it
 * keeps this off `sharp`, which is a devDependency here and so is not there
 * at runtime.
 */
export async function clubJoinQrImage(
  clubId: string,
  format: ClubJoinQrFormat,
): Promise<ClubJoinQrImage> {
  const url = await onDeckAbsoluteUrl(clubQrPath(clubId));
  const options = {
    errorCorrectionLevel: "M" as const,
    margin: 4,
    color: { dark: "#000000", light: "#ffffff" },
  };

  if (format === "png") {
    return {
      url,
      // 1024px square: large enough that a print shop scaling it to a poster
      // has pixels to work with, small enough to send in a message.
      body: await QRCode.toBuffer(url, { ...options, type: "png", width: 1024 }),
      contentType: "image/png",
    };
  }

  return {
    url,
    body: await QRCode.toString(url, { ...options, type: "svg" }),
    contentType: "image/svg+xml",
  };
}
