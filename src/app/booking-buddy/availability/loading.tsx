import { BbPageSkeleton } from "@/components/booking-buddy/bb-page-skeleton";

// Heading copy mirrors availability/page.tsx so the shell doesn't shift on swap.
export default function Loading() {
  return (
    <BbPageSkeleton
      title="Open time"
      description="Mark when you're open or busy. It only shows on your calendar, and never blocks a game invite."
    />
  );
}
