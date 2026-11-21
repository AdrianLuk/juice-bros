import { LinkScreen } from "@/components/ddd/link-screen";

/** The Score Link: whoever holds it enters scores. No account. */
export default async function ScoreLinkPage({ params }: { params: Promise<{ token: string }> }) {
  return <LinkScreen token={(await params).token} link="score" />;
}
