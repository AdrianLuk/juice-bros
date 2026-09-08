import "server-only";

import { clubJoinQrImage, type ClubJoinQrFormat } from "./qr.ts";

/** A club id has to look like the uuid the table issues before it is drawn. */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The shared body of the two Club QR file routes (issue #463).
 *
 * Open on purpose, and it gives away nothing that the sign on the wall does
 * not: it encodes `clubQrPath(clubId)`, a link whose entire job is to be
 * photographed by strangers, and it reads no database. The `clubQrPath` page
 * itself already answers for an unknown Club with "nothing running right
 * now", so this does not look one up either — it only insists the id is
 * shaped like a real one, so the endpoint cannot be turned into a generator
 * of QR codes for arbitrary text.
 *
 * Cached hard because the answer never changes: one Club, one link, for the
 * life of the Club. That is the same premise the printed sign rests on.
 */
export async function clubQrImageResponse(
  clubId: string,
  format: ClubJoinQrFormat,
): Promise<Response> {
  if (!UUID.test(clubId)) {
    return new Response("Not found", { status: 404 });
  }

  const { body, contentType } = await clubJoinQrImage(clubId, format);

  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, s-maxage=86400, immutable",
      // Names the file something recognisable in a downloads folder without
      // forcing a download — opening it in a tab is the common case.
      "Content-Disposition": `inline; filename="on-deck-club-qr.${format}"`,
    },
  });
}
