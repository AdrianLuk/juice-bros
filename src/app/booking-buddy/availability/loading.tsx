import { BbPageSkeleton } from "@/components/booking-buddy/bb-page-skeleton";

// Heading copy mirrors availability/page.tsx so the shell doesn't shift on swap.
export default function Loading() {
  return (
    <BbPageSkeleton
      title="Availability"
      description="Mark when you're looking to play or busy. It only shows on your calendar, and never blocks a game invite."
    />
  );
}
