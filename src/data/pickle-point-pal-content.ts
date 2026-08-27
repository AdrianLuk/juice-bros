/**
 * Copy for the explainer + FAQ block below the Pickle Point Pal tool. Kept as
 * data so `page.tsx` can render it and `buildAppPageJsonLd` can emit matching
 * FAQPage markup off the same source. Google flags FAQ markup that doesn't
 * match the visible text.
 */

export type PicklePointPalFaq = { question: string; answer: string };

export const picklePointPalFaqs: PicklePointPalFaq[] = [
  {
    question: "Is Pickle Point Pal free?",
    answer:
      "Yes. It runs in your browser with no account and no ads, and there's nothing to install. Add it to your home screen and it works offline at the court.",
  },
  {
    question: "Does it handle both side-out and rally scoring?",
    answer:
      "Both. Pick side-out (the standard sanctioned format) or rally scoring at setup, along with games to 11, 15, or 21, a single game or best of 3 or 5, win by 1 or 2, and the rally freeze rule. It also handles the mid-game side switch.",
  },
  {
    question: "Does it keep track of which player is serving?",
    answer:
      "Yes, that's most of what it does. It follows server 1 and server 2 through every side-out, keeps the serving team on the correct court, and shows a court diagram of who serves from where, mirrored to whichever side of the net you're on.",
  },
  {
    question: "Can I undo a point I tapped by mistake?",
    answer:
      "Yes. Every tap can be undone and redone. The whole match is stored as a list of events, so you can step the score back to any earlier point and forward again. There's also a running match log you can show if a score is ever disputed.",
  },
  {
    question: "What happens if my phone locks or the page reloads mid-match?",
    answer:
      "The match saves itself after every point. Reopen the page and it offers to pick up from where you left off, including a running timeout clock, or to start over.",
  },
  {
    question: "Is this an official USA Pickleball tool?",
    answer:
      "No. Two rec players made it, and it isn't affiliated with USA Pickleball or Pickleball Canada. The default settings follow common rec and MLP-style play. If you're reffing a sanctioned event, check the toggles against the current rulebook first.",
  },
];
