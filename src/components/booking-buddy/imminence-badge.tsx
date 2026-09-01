import { imminenceLabel } from "@/lib/booking-buddy/datetime";

/**
 * The "Today" / "Tonight" / "Tomorrow" cue shown on an upcoming Booking — on
 * the dashboard's "Coming up" sidebar and the Bookings page's "Booked" list.
 * Colour tracks how soon the start is: a solid brand-orange chip for an
 * imminent daytime start, the brand yellow once it's tonight, and a calm
 * neutral for tomorrow — so the three no longer read as one flat badge.
 */
const BADGE_CLASS: Record<string, string> = {
  Today: "bg-primary text-primary-foreground",
  Tonight: "bg-accent text-accent-foreground",
  Tomorrow: "bg-secondary text-secondary-foreground",
};

export function ImminenceBadge({
  nowIso,
  startsAt,
}: {
  nowIso: string;
  startsAt: string;
}) {
  const label = imminenceLabel(new Date(nowIso), startsAt);
  if (!label) {
    return null;
  }

  return (
    <span
      className={`mb-1 inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${
        BADGE_CLASS[label] ?? "bg-secondary text-secondary-foreground"
      }`}
    >
      {label}
    </span>
  );
}
