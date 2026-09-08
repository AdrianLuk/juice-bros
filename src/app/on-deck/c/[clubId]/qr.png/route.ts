import { clubQrImageResponse } from "@/lib/on-deck/qr-response";

export const runtime = "nodejs";

/** The Club QR as PNG — the one to paste into a message or a slide. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  return clubQrImageResponse(clubId, "png");
}
