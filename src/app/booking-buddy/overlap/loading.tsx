import { BbPageSkeleton } from "@/components/booking-buddy/bb-page-skeleton";

// Heading copy mirrors overlap/page.tsx so the shell doesn't shift on swap.
export default function Loading() {
  return (
    <BbPageSkeleton
      title="Find a time"
      description="Pick the friends you want to play with and see when you're all free. It only counts time nobody's booked and nobody's marked busy."
    />
  );
}
