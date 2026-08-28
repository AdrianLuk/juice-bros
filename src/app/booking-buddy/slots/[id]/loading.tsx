import { BbPageSkeleton } from "@/components/booking-buddy/bb-page-skeleton";

// The slot detail heading is data-derived (date + facility), so it stays a
// placeholder bar; the rest of the shell is real.
export default function Loading() {
  return <BbPageSkeleton sectionNav={false} />;
}
