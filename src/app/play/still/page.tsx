import { notFound } from "next/navigation";

import { Still } from "./still";

/** Development only: the render page for `scripts/render-play-teaser.mts`. */
export default function PlayStillPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Still />;
}
