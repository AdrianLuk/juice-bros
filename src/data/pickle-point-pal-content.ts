/**
 * Copy for the explainer + FAQ block below the Pickle Point Pal tool. Kept as
 * data so `page.tsx` can render it and `buildAppPageJsonLd` can emit matching
 * FAQPage markup off the same source — Google flags FAQ markup that doesn't
 * match the visible text.
 */

export type PicklePointPalFaq = { question: string; answer: string };

export const picklePointPalFaqs: PicklePointPalFaq[] = [
  {
    question: "Is Pickle Point Pal free?",
    answer:
      "Yes. It runs entirely in your browser, there are no accounts, no ads, and nothing to install. Add it to your home screen and it works offline courtside.",
  },
  {
    question: "Does it handle both side-out and rally scoring?",
    answer:
      "Both. Pick side-out (the standard sanctioned format) or rally scoring at setup, along with games to 11, 15, or 21, one game or best of 3 or 5, win by 1 or 2, and the rally freeze rule. It also tracks the mid-game side switch for you.",
  },
  {
    question: "Does it keep track of which player is serving?",
    answer:
      "Yes — that's the point of it. It follows server 1 and server 2 through every side-out, keeps the serving team on the right court, and shows a court diagram of who serves from where, mirrored to whichever side of the net you're standing on.",
  },
  {
    question: "Can I undo a point I tapped by mistake?",
    answer:
      "Every tap is undoable, and redoable. The whole match is an event log, so you can walk the score back to any point and forward again. There's also a running match log you can show if a score is ever disputed.",
  },
  {
    question: "What happens if my phone locks or the page reloads mid-match?",
    answer:
      "The match saves itself after every point. Reopen the page and it offers to resume from exactly where you left off, running timeout clock included, or start fresh.",
  },
  {
    question: "Is this an official USA Pickleball tool?",
    answer:
      "No. It's a free tool made by two rec players, not USA Pickleball or Pickleball Canada. The defaults follow common rec and MLP-style play; if you're reffing a sanctioned event, check the toggles against the current rulebook first.",
  },
];
