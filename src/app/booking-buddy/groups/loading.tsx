import { BbPageSkeleton } from "@/components/booking-buddy/bb-page-skeleton";

// Heading copy mirrors groups/page.tsx so the shell doesn't shift on swap.
export default function Loading() {
  return (
    <BbPageSkeleton
      title="Friend groups"
      description="Groups are yours alone. Nobody is told which one they're in, or what they can see."
    />
  );
}
