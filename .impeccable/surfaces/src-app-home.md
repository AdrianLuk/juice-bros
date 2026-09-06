---
version: 1
slug: "src-app-home"
primary_target: "src/app/(home)"
related_targets: ["src/components/layout/site-chrome-slot.tsx"]
---

Scope: the Juice Bros marketing home page (`src/app/(home)`) and the chrome it
needs. Visitor mode: **Persuade**. Adrian scoped this to the home page first, as
the proof of a look that later rolls out to Podcast, Gear, About, Contact, Tools
and Appearances.

Audience: recreational pickleball players. Job: understand in seconds what this
show is, and start an episode. Action: watch on YouTube / listen on Spotify -
audience growth on those two platforms is the product's success metric, so the
subscribe path is the page's real conversion, not a form.

Proof on hand: fourteen real published episodes with real titles, dates,
runtimes and thumbnails; the real host photo (`public/pictures/adrian-dav.jpg`);
the real logo; a real upcoming appearance; two real shipped tools. No invented
metrics, testimonials or claims.

How this direction was reached: four committed own-world directions were put in
front of Adrian across three rounds (a season-guide print world, which was built
and then rejected; a public-access broadcast world; a painted-court world; a
group-chat world). He took the standing exit both times it was offered, so
**convention is the commitment** and is now recorded as a brand commitment in
PRODUCT.md. He then set the craft bar himself: podcast structure with SaaS
finish. Direction seeds 26059808 (direction rounds) and 9516fc86 (surface
round); the look was chosen from three rendered alternatives as "Broadcast Dark".

One deliberate deviation from the approved mockup, disclosed rather than
silent: the episode archive is a **grid**, not the horizontal rail the mockup
showed. A rail hides most of the catalogue off-screen and turns browsing into a
swipe most phone visitors never make, which works against the one metric this
page exists to serve. Same cards, same ground, same character.

Constraints: the JB logo, brand orange (`#f26522`) and the hosts' real photos
are fixed. The named failure mode from the ask round is "if it looked like every
podcast site" - which the standing exit knowingly accepts, so the defence is
finish, not novelty. Apps (Booking Buddy, On Deck, Pickle Point Pal) keep their
own visual worlds and are untouched.

Unresolved: whether the home page should carry a newsletter signup (CLAUDE.md
wants one in the footer sitewide; neither the incumbent home page nor
`SiteFooter` has ever had one, so it is unbuilt intention rather than lost
behaviour). Whether Bricolage can be dropped from the font set once the other
six routes move over.

## Direction contract

THESIS: The page is the show's own screen - the newest episode plays the room,
and everything else is the archive around it. It refuses the incumbent's
arrangement, where a full viewport of brand identity sits above anything a
visitor can actually press.

OWN-WORLD: Near-black ground (#08090B) with a single raised surface, white ink,
one muted grey, and brand orange reserved for exactly one job: the subscribe
action. Geist at one rigorous scale for everything, Geist Mono for metadata
only. A 4px spacing system, one shadow token, 0.75rem card radius, pill
controls. All page colour comes from the episode thumbnails; the chrome never
competes with them.

STORY: A rec player lands, reads in one line that this show is made by people at
their own level, sees the newest episode already sitting there ready to play,
starts it - or scans fourteen more and subscribes.

FIRST VIEWPORT: A slim sticky bar with the seal, wordmark, links and one orange
Subscribe pill. Under it, a compact positioning line as the h1 with a one-line
standfirst. Then the stage: the newest episode's thumbnail at 16:9 in a centred
column, a play affordance and runtime chip on it, and beneath it a row carrying
the episode's date kicker and title on the left with Watch on YouTube (white
pill) and Listen (outline pill) on the right.

FORM: The category standard, chosen by Adrian over four own-world directions;
look "Broadcast Dark", chosen from three rendered alternatives. Seed keys
26059808 and 9516fc86. Signature interaction: the stage - one hover/focus
treatment that lifts a thumbnail and brightens its play affordance, applied
identically to the stage and every archive card, so the whole page has one
gesture rather than scattered effects. Motion grammar: short, eased, transform
and opacity only; nothing moves that a visitor did not point at.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.
