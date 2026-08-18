export type TeamMember = {
  name: string;
  role: string;
  bio: string;
  funFact: string;
  instagramUrl: string;
  imageSrc?: string;
};

// Interim, on-brand copy until Adrian writes the real bios in each host's own
// words (60-100 words + a "Paddle of choice" / "Signature shot" line per the
// site brief). Swap the `bio` and `funFact` strings below - no JSX changes needed.
export const team: TeamMember[] = [
  {
    name: "Daven",
    role: "Co-Host",
    bio: "Daven's the one texting the group chat about a court he found at 11pm and dragging Adrian along to test it out. Full bio - in his own words - is coming soon.",
    funFact: "Paddle of choice: Bread & Butter Loco. Signature shot: the backhand counter - the ball comes back like a freight train.",
    instagramUrl: "https://www.instagram.com/pickleball.dav",
  },
  {
    name: "Adrian",
    role: "Co-Host",
    bio: "Adrian's the one who turned post-game parking lot chats into an actual show. Full bio - in his own words - is coming soon.",
    funFact: "Paddle of choice: Honolulu J2CR Crystal Blue. Signature shot: the backhand flick/roll - he'll pull it from anywhere.",
    instagramUrl: "https://www.instagram.com/adrian.pickleball",
  },
];
