import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { Hero } from "./sections/hero";
import { OriginStory } from "./sections/origin-story";
import { Mission } from "./sections/mission";
import { MeetTheBros } from "./sections/meet-the-bros";
import { Pillars } from "./sections/pillars";
import { Differentiation } from "./sections/differentiation";
import { JoinIn } from "./sections/join-in";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "Meet the hosts of Juice Bros Pickleball and find out how two friends riffing after pickup games turned into a show for everyday players.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <Hero />
      <OriginStory />
      <Mission />
      <MeetTheBros />
      <Differentiation />
      <Pillars />
      <JoinIn />
    </div>
  );
}
