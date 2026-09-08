import { clubQrImageResponse } from "@/lib/on-deck/qr-response";

export const runtime = "nodejs";

/** The Club QR as SVG — the one to give a print shop, since it has no size. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  return clubQrImageResponse(clubId, "svg");
}
