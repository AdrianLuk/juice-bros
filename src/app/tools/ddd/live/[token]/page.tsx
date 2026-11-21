import { LinkScreen } from "@/components/ddd/link-screen";

/** The read-only Public Link, for phones and the venue TV. */
export default async function PublicLinkPage({ params }: { params: Promise<{ token: string }> }) {
  return <LinkScreen token={(await params).token} link="public" />;
}
