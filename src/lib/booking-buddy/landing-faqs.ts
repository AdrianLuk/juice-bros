/**
 * Shared between the landing page's FAQ section and its FAQPage JSON-LD
 * (`buildBookingBuddyLandingJsonLd`) so the two can't drift. Every answer here
 * has to stay true to what the app actually does — see booking-buddy/CONTEXT.md.
 */
export type Faq = { question: string; answer: string };

export const landingFaqs: Faq[] = [
  {
    question: "Is Booking Buddy free?",
    answer:
      "Yes. It's a free tool from the Juice Bros, with no ads and nothing to upgrade.",
  },
  {
    question: "Do my friends need an account?",
    answer:
      "To share availability and RSVP to each other's games, yes. If you just want a one-off headcount, you can send anyone a Slot Link and they can RSVP as a guest without signing up.",
  },
  {
    question: "How do I find a time that works for everyone?",
    answer:
      "Pick the friends you want to play with and Booking Buddy shows the days and times you're all free, based on the open time each of them shares with you. You can propose a game for any of those slots without leaving the page.",
  },
  {
    question: "Who can see my calendar?",
    answer:
      "Only the friends you've connected with, and only as much as you choose to share with each group: your open time, the games you invite them to, both, or nothing. None of it is public.",
  },
  {
    question: "Does it book courts for me?",
    answer:
      "No. You still reserve courts on your facility's own site. Booking Buddy keeps track of what you've booked and helps the group settle on a time around it.",
  },
  {
    question: "What's the email sync feature?",
    answer:
      "An optional, invite-only feature that reads CourtReserve confirmation emails so your bookings show up without retyping them. It only ever looks for that one sender, and only when you ask it to.",
  },
];
