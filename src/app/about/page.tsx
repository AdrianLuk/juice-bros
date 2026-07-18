import type { Metadata } from "next";

import { Hero } from "./sections/hero";
import { OriginStory } from "./sections/origin-story";
import { Mission } from "./sections/mission";
import { MeetTheBros } from "./sections/meet-the-bros";
import { Pillars } from "./sections/pillars";
import { Differentiation } from "./sections/differentiation";
import { JoinIn } from "./sections/join-in";

export const metadata: Metadata = {
  title: "About",
};

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
