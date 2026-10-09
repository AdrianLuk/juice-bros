import type { LucideIcon } from "lucide-react";
import { CalendarCheck, ClipboardList, Grid3x3, ListOrdered, Ticket, Users } from "lucide-react";

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
  /**
   * A demo that runs in the browser with nothing to sign up for, linked from
   * the tool's card beside "Open". Only the tools that ask for an account have
   * one, because that is where a visitor wants to look before signing in.
   */
  demoHref?: string;
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
      "Any roster from 4 to 32, on however many courts you have free",
      "Nobody partners the same person twice, and byes rotate evenly",
    ],
    terms: ["Free", "No sign-up", "Open now"],
  },
  {
    slug: "on-deck",
    title: "On Deck",
    href: "/on-deck",
    description:
      "Run the court rotation at a busy social. Players scan a sign to join the queue, and the next four walk on as each court frees up.",
    icon: ListOrdered,
    status: "live",
    highlights: [
      "Players join from their phones, with no app and no sign-up",
      "Calls the next foursome as soon as a court frees up",
      "Keeps court time fair and mixes up who plays with whom",
    ],
    terms: ["Free", "Account for organizers only", "Open now"],
    demoHref: "/on-deck/demo",
  },
  {
    slug: "team-tally",
    title: "Team Tally",
    href: "/tools/team-tally",
    description:
      "Score a captained team night from everyone's phones. Captains enter their own Matchups, and Team Tally places the Flights when the opening round is done.",
    icon: Users,
    status: "live",
    highlights: [
      "Set up the night once, or paste last week's brief, and get the message for the group chat",
      "Captains score from a link in the brief, with no app and no account",
      "Standings re-sort as scores land, on any phone or the venue TV",
      "The night ends on a results page with every Flight's champion",
    ],
    terms: ["Free", "Account for organizers only", "Open now"],
    demoHref: "/tools/team-tally/demo",
  },
  // Drum Roll stays last: it was a one-off raffle tool, so new tools go above it.
  {
    slug: "drum-roll",
    title: "Drum Roll",
    href: "/tools/drum-roll",
    description:
      "Spin a wheel to pick a name, or add prizes and run the whole raffle. No paper tickets, no accounts.",
    icon: Ticket,
    status: "live",
    highlights: [
      "Paste your names and spin, or pass the phone round and let people add themselves",
      "More tickets means a wider slice of the wheel, so the odds are there to see",
      "Add a prize and it becomes a full raffle, drawn one prize at a time",
    ],
    terms: ["Free", "No sign-up", "Open now"],
  },
];
