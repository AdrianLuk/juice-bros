/**
 * Team Tally's five screens, who holds each one, and what it is for: the
 * demo night's tab taglines (issue #631), and the landing page's "One night,
 * five screens" (issue #636). One list, so the two never say different things.
 * Plain data in its own module (not the client demo stage) so a server
 * component can read it.
 */

export type DemoScreen = "score" | "public" | "tv" | "organizer" | "brief";

export const SCREENS: { id: DemoScreen; label: string; who: string; what: string }[] = [
  { id: "score", label: "Score Link", who: "For each captain", what: "Enter your Matchup's scores from your phone." },
  { id: "public", label: "Public Link", who: "For players and fans", what: "Follow the standings and scores on any phone." },
  { id: "tv", label: "TV", who: "For the venue screen", what: "Standings and Matchups, cycling on their own." },
  { id: "organizer", label: "Organizer", who: "For the Organizer", what: "Fix any score and settle what the captains can't." },
  { id: "brief", label: "Brief", who: "For the group chat", what: "Teams and courts for every Matchup, ready to paste." },
];

export function screenNamed(id: DemoScreen): (typeof SCREENS)[number] {
  return SCREENS.find((screen) => screen.id === id)!;
}
