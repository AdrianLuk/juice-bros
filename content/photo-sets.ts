/** One image of the hosts on the Photos page. */
export type Photo = {
  /** Path under `public/`, e.g. "/pictures/creator-night-adrian-serving.jpg".
   *  Add it to `IMAGE_MANIFEST` and run `npm run optimize:images`. */
  src: string;
  /** What the photo shows, for screen readers. Required: the content check
   *  fails on an empty one. */
  alt: string;
};

/**
 * A named, dated group of Photos from one occasion, with a place. See the
 * Photo Set entry in CONTEXT.md.
 */
export type PhotoSet = {
  /** The gallery heading. Short and the set's own: a tournament's full
   *  sponsor name belongs on its Appearance, not here. */
  title: string;
  /** Single-day occasion, ISO `yyyy-mm-dd`. Use this OR startDate/endDate. */
  date?: string;
  /** Multi-day occasion start, ISO `yyyy-mm-dd`. Pair with `endDate`. */
  startDate?: string;
  /** Multi-day occasion end, ISO `yyyy-mm-dd`. Pair with `startDate`. */
  endDate?: string;
  /** Venue and city, shown on the meta line under the heading. */
  venue: string;
  /** One plain line under the heading. */
  note: string;
  /** The `name` of the Appearance this set is from, if the hosts played in
   *  it. Used only for linking between the two; the set keeps its own title
   *  and dates. Leave it off for an occasion they only attended. */
  appearance?: string;
  /** Best photo first: it leads the set and the Appearances preview. */
  photos: Photo[];
};

// Hand-edited. Order doesn't matter: the page shows sets newest first by their
// last day. The hosts are always the subject of a Photo; a shot that is mainly
// of someone else stays out (see Photo in CONTEXT.md).
export const photoSets: PhotoSet[] = [
  {
    title: "Creator Night at The Backyard Club",
    date: "2026-09-29",
    venue: "The Backyard Club, Vaughan, ON",
    note: "An evening of games with other pickleball creators, and a lot of phones out.",
    photos: [
      {
        src: "/pictures/creator-night-adrian-backhand-daven-watching.jpg",
        alt: "Adrian reaching for a low backhand with the crowd at the rail filming, Daven waiting behind him with his paddle down",
      },
      {
        src: "/pictures/creator-night-daven-lunging-forehand.jpg",
        alt: "Daven lunging into a forehand with the ball just ahead of his paddle",
      },
      {
        src: "/pictures/creator-night-adrian-serving.jpg",
        alt: "Adrian lining up a serve with the ball in his free hand while other players wait behind him",
      },
      {
        src: "/pictures/creator-night-adrian-forehand-portrait.jpg",
        alt: "Adrian in glasses and a Juice Bros shirt, about to hit a forehand",
      },
      {
        src: "/pictures/creator-night-daven-ready-position-portrait.jpg",
        alt: "Daven in a cap and Juice Bros shirt, stepping in with his paddle low and ready",
      },
      {
        src: "/pictures/creator-night-adrian-daven-net-handshake.jpg",
        alt: "Adrian and Daven shaking hands at the net after a game, Adrian's name across the back of his shirt",
      },
      {
        src: "/pictures/creator-night-adrian-lunging-daven-at-net.jpg",
        alt: "Adrian lunging low for a ball near the kitchen line, Daven beside him at the net",
      },
      {
        src: "/pictures/creator-night-adrian-daven-group-photo-paddles.jpg",
        alt: "Daven and Adrian with two other players at The Backyard Club, paddles in hand, grinning at the camera",
      },
    ],
  },
];
