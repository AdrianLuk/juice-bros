import { BbPageSkeleton } from "@/components/booking-buddy/bb-page-skeleton";

// The weekly game heading is data-derived (its day), so it stays a
// placeholder bar; the rest of the shell is real.
export default function Loading() {
  return <BbPageSkeleton sectionNav={false} />;
}
