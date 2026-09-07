import "server-only";

import QRCode from "qrcode";

/**
 * Renders the Club QR as an inline SVG string, server-side — no client JS,
 * no image request. Used by the Organizer's "Show the QR" screen (the
 * on-screen fallback for a day without the printed sign).
 */
export async function clubQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
