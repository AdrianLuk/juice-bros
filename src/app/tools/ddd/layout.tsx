import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Anton, Atkinson_Hyperlegible, Courier_Prime } from "next/font/google";
import localFont from "next/font/local";

import "./ddd.css";

// The Tab (direction seed 6a7cc74d, .impeccable/surfaces/src-app-tools-ddd.md).
// Anton for Team names, totals and place numbers; Atkinson Hyperlegible for
// everything read or tapped; Courier Prime only for the tiny stamps and slip
// headers. Loaded here, not in the root layout, so only DDD's routes fetch them.
const anton = Anton({ variable: "--font-ddd-display", weight: "400", subsets: ["latin"] });
const atkinson = Atkinson_Hyperlegible({ variable: "--font-ddd", weight: ["400", "700"], subsets: ["latin"] });
const courier = Courier_Prime({ variable: "--font-ddd-stamp", weight: "700", subsets: ["latin"] });
// Atkinson's zero is slashed and has no plain alternate, so 0 to 9 come from
// Figtree (OFL, subset to the digits). The unicode-range keeps it off every
// other character, and no Arial fallback face, or that would draw the letters.
const digits = localFont({
  src: "./fonts/figtree-digits.woff2",
  variable: "--font-ddd-digits",
  weight: "300 900",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0030-0039" }],
});

/**
 * Dink Dine & Drink is unlisted (spec #709): kept out of search, and a Score
 * Link's token never travels on as a referrer.
 */
export const metadata: Metadata = {
  title: "Dink Dine & Drink",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * DDD's surface on every route under /tools/ddd. `SiteShell` lists the route
 * in `DARK_EXCEPTIONS` and `SiteChromeSlot` drops the site chrome, so the
 * marketing site's look never reaches it.
 */
export default function DddLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`ddd-surface ${anton.variable} ${atkinson.variable} ${digits.variable} ${courier.variable} flex w-full flex-1 flex-col`}>
      {children}
    </div>
  );
}
