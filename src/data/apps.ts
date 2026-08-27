import type { LucideIcon } from "lucide-react";
import { CalendarCheck, ClipboardList } from "lucide-react";

export type AppStatus = "coming-soon" | "live";

export type AppItem = {
  slug: string;
  title: string;
  href: string;
  description: string;
  icon: LucideIcon;
  status: AppStatus;
};

export const apps: AppItem[] = [
  {
    slug: "booking-buddy",
    title: "Booking Buddy",
    href: "/booking-buddy",
    description:
      "Plan pickleball with your friends — open a time, see who's in, and keep your court bookings in one place.",
    icon: CalendarCheck,
    status: "live",
  },
  {
    slug: "pickle-point-pal",
    title: "Pickle Point Pal",
    href: "/tools/pickle-point-pal",
    description:
      "Keep score and track serves for a pickleball match like a referee would.",
    icon: ClipboardList,
    status: "live",
  },
];
