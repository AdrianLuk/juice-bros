import { BbPageSkeleton } from "@/components/booking-buddy/bb-page-skeleton";

// Heading copy mirrors slots/page.tsx so the shell doesn't shift on swap.
export default function Loading() {
  return (
    <BbPageSkeleton
      title="Games"
      description="Propose a time before you've reserved a court. Friends respond yes, no, or maybe."
    />
  );
}
