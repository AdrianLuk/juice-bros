import type { LucideIcon } from "lucide-react";
import { ClipboardList } from "lucide-react";

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
    slug: "pickle-point-pal",
    title: "Pickle Point Pal",
    href: "/tools/pickle-point-pal",
    description:
      "Keep score and track serves for a pickleball match like a referee would.",
    icon: ClipboardList,
    status: "live",
  },
];
