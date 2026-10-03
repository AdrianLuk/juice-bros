export type EventRecapPhoto = {
  /** Path under `public/`, e.g. "/pictures/creator-night-adrian-serving.jpg".
   *  Add it to `IMAGE_MANIFEST` and run `npm run optimize:images`. */
  src: string;
  alt: string;
  /** Tailwind `object-position` class that keeps the subject in frame when the
   *  grid crops the photo. Defaults to the centre. */
  position?: string;
};

export type EventRecap = {
  name: string;
  /** Display string, in the same style as the appearances list ("Sep 29, 2026"). */
  date: string;
  location: string;
  /** One plain line under the heading. */
  note?: string;
  /** Exactly five: one tall photo, then four landscape ones. The grid is laid
   *  out for that shape. */
  photos: [EventRecapPhoto, EventRecapPhoto, EventRecapPhoto, EventRecapPhoto, EventRecapPhoto];
};

// Hand-edited, newest first. Events the hosts went to that weren't a bracket
// they played in, so they don't belong in `appearances` with divisions and a
// tournament link. Photos are camera originals (see `IMAGE_MANIFEST`).
export const eventRecaps: EventRecap[] = [
  {
    name: "Creator Night at The Backyard Club",
    date: "Sep 29, 2026",
    location: "The Backyard Club, Vaughan, ON",
    note: "The same courts we're back on for The Backyard Club Open on Nov 14.",
    photos: [
      {
        src: "/pictures/creator-night-courts-overview-filming-setup.jpg",
        alt: "Looking down on the courts at The Backyard Club, with a group gathered around a camera tripod in the foreground",
        position: "object-[50%_55%]",
      },
      {
        src: "/pictures/creator-night-daven-lunging-forehand.jpg",
        alt: "Daven lunging into a forehand with the ball just ahead of his paddle",
        position: "object-[62%_50%]",
      },
      {
        src: "/pictures/creator-night-adrian-serving.jpg",
        alt: "Adrian lining up a serve with the ball in his free hand while other players wait behind him",
        position: "object-[25%_50%]",
      },
      {
        src: "/pictures/creator-night-players-lined-up-watching.jpg",
        alt: "Players lined up along the court watching the action, several of them in Juice Bros shirts",
      },
      {
        src: "/pictures/creator-night-filming-phone-foreground.jpg",
        alt: "Someone filming the court on a phone in the foreground while a match goes on behind them",
        position: "object-[60%_50%]",
      },
    ],
  },
];
