export type AppearanceStatus = "confirmed" | "tentative";

/** Which hosts are on court. "both" is the common case; name one host for a
 *  solo entry, or list host names for anything that needs to be explicit. */
export type AppearancePlayers = "both" | "adrian" | "daven" | ("Adrian" | "Daven")[];

/** One bracket the Juice Bros are entered in at a tournament. */
export type AppearanceDivision = {
  /** Human label, e.g. "Men's Doubles 4.5 (18-34)". */
  name: string;
  /** Day this division plays, ISO `yyyy-mm-dd`. */
  date?: string;
  players: AppearancePlayers;
};

export type Appearance = {
  name: string;
  /** Single-day event, ISO `yyyy-mm-dd`. Use this OR startDate/endDate, not both. */
  date?: string;
  /** Multi-day event start, ISO `yyyy-mm-dd`. Pair with `endDate`. */
  startDate?: string;
  /** Multi-day event end, ISO `yyyy-mm-dd`. Pair with `startDate`. */
  endDate?: string;
  /** City / venue string shown on the row. */
  location: string;
  /** Tournament or registration page. */
  url?: string;
  /** Cover art under `public/appearances/`, e.g. "/appearances/foo.png". Falls
   *  back to the Juice Bros logo when absent. */
  image?: string;
  status: AppearanceStatus;
  players: AppearancePlayers;
  /** Brackets entered, if known. Fine to leave off tentative entries. */
  divisions?: AppearanceDivision[];
  /** Slug for a future per-tournament recap page under /appearances. The recap
   *  page isn't built yet; past entries carry this so they can link out later. */
  recapSlug?: string;
  /** External recap link, if the write-up lives off-site instead. */
  recapUrl?: string;
};

// Hand-edited, like content/team.ts. Order doesn't matter here - the page
// splits and sorts these by date. Adrian keeps the dates/players/divisions in
// sync as registrations firm up; flip `status` to "confirmed" once a spot is
// locked.
export const appearances: Appearance[] = [
  {
    name: "IG Wealth Management National Championships",
    startDate: "2026-08-28",
    endDate: "2026-08-29",
    location: "Pickleplex Social Club, Toronto, ON",
    url: "https://pickleballtournaments.com/tournaments/2026-ig-wealth-management-national-championships-presented-by-hearing-life",
    image: "/appearances/ig-nationals-2026.png",
    status: "confirmed",
    players: "both",
    divisions: [
      { name: "Men's Doubles 4.5 (18-34)", date: "2026-08-29", players: "both" },
      { name: "Mixed Doubles 4.0 (13-34)", date: "2026-08-28", players: "adrian" },
      { name: "Mixed Doubles 4.0 (35-49)", date: "2026-08-28", players: "daven" },
    ],
  },
  {
    name: "APA Admiral Cup",
    startDate: "2026-09-17",
    endDate: "2026-09-20",
    location: "The Backyard Club, Vaughan, ON",
    url: "https://pickleballtournaments.com/tournaments/apa-the-admiral-cup-powered-by-dink-monsters-1",
    image: "/appearances/apa-admiral-cup-2026.png",
    status: "confirmed",
    players: "both",
    divisions: [
      { name: "Men's Doubles 4.999 & Under (14+)", date: "2026-09-20", players: "both" },
      { name: "Mixed Doubles 4.999 & Under (14+)", date: "2026-09-19", players: "adrian" },
      { name: "Split Age Men's Doubles 4.499 & Under", date: "2026-09-17", players: "daven" },
      { name: "Mixed Doubles 4.499 & Under (35+)", date: "2026-09-19", players: "daven" },
    ],
  },
  {
    name: "Backyard Club Team Tournament",
    date: "2026-09-26",
    location: "The Backyard Club, Vaughan, ON",
    status: "tentative",
    players: "both",
  },
  {
    name: "Vaughan Pickleball Fall Open",
    startDate: "2026-09-30",
    endDate: "2026-10-04",
    location: "Vaughan Pickleball, Vaughan, ON",
    url: "https://pickleballtournaments.com/tournaments/vaughan-pickleball-fall-open",
    image: "/appearances/vaughan-fall-open-2026.png",
    status: "tentative",
    players: "adrian",
  },
  {
    name: "PPA Tour Toronto",
    startDate: "2026-11-26",
    endDate: "2026-11-29",
    location: "Pickleplex Downsview, Toronto, ON",
    status: "tentative",
    players: "both",
  },
];
