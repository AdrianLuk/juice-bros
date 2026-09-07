import type { LucideIcon } from "lucide-react";
import { CalendarCheck, ClipboardList, Grid3x3 } from "lucide-react";

export type AppStatus = "coming-soon" | "live";

export type AppItem = {
  slug: string;
  title: string;
  href: string;
  description: string;
  icon: LucideIcon;
  status: AppStatus;
  /**
   * What the tool actually does, in the words someone deciding whether to open
   * it would use. Kept short - these are read at a glance beside three others,
   * not studied.
   */
  highlights: string[];
  /**
   * What it costs and what it asks for, as a metadata line. Lives here rather
   * than as a `slug === "booking-buddy"` branch inside a card component, which
   * is where it used to live and where the next tool would have had to be
   * added by editing a component instead of this file.
   */
  terms: string[];
};

export const apps: AppItem[] = [
  {
    slug: "booking-buddy",
    title: "Booking Buddy",
    href: "/booking-buddy",
    description:
      "Plan pickleball with your friends. Open a time, see who's in, and keep your court bookings in one place.",
    icon: CalendarCheck,
    status: "live",
    highlights: [
      "Post a time and watch your friends say yes or no to it",
      "Keep the people you actually play with in groups",
      "Every booking your group has made, on one calendar",
    ],
    terms: ["Free", "Account needed", "Open now"],
  },
  {
    slug: "pickle-point-pal",
    title: "Pickle Point Pal",
    href: "/tools/pickle-point-pal",
    description:
      "Keep score and track serves for a pickleball match like a referee would.",
    icon: ClipboardList,
    status: "live",
    highlights: [
      "Score, server and side, tracked the way a ref calls them",
      "Built for a phone held courtside between rallies",
      "Opens straight from the browser, nothing to install",
    ],
    terms: ["Free", "No sign-up", "Open now"],
  },
  {
    slug: "match-mixer",
    title: "Match Mixer",
    href: "/tools/match-mixer",
    description:
      "Paste your player list and get a balanced doubles round robin. Nobody partners the same person twice.",
    icon: Grid3x3,
    status: "live",
    highlights: [
      "Paste your list of names and get every round back at once",
      "Nobody partners the same person twice and nobody sits out",
      "A partner grid underneath shows you the schedule is fair",
    ],
    terms: ["Free", "No sign-up", "Open now"],
  },
];
