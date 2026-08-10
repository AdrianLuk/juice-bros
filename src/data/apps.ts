import type { LucideIcon } from "lucide-react";
import { Shuffle, ClipboardList } from "lucide-react";

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
    slug: "referee-scorekeeper",
    title: "Referee Scorekeeper",
    href: "/tools/referee-scorekeeper",
    description:
      "Keep score and track serves for a pickleball match like a referee would.",
    icon: ClipboardList,
    status: "live",
  },
  {
    slug: "round-robin-generator",
    title: "Round Robin Generator",
    href: "/tools/round-robin-generator",
    description:
      "Generate round robin pairings and courts for open play or a group session.",
    icon: Shuffle,
    status: "coming-soon",
  },
];
