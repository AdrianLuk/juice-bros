import type { ReactNode } from "react";

/**
 * ═══ IMPECCABLE DIRECTION CONTRACT ═══ seed 92ec9d54 · code-led
 * (no image generation on the build machine; the comp round is skipped by
 * contract per new-work.md §5 — ambition carried in FIRST VIEWPORT + the named
 * signature interaction, audited by the finish reviewer in behaviour.)
 * Emitted into the built markup by `ContractComment` below so a production
 * build stays auditable (grep the output for the seed key).
 */
const DIRECTION_CONTRACT = `
IMPECCABLE DIRECTION CONTRACT — On Deck live-event surfaces — seed 92ec9d54

THESIS: On Deck's live-event screens are a fourth official's substitution
board — names ON, names OFF, held where a loud gym reads them in one glance.
Refuses the incumbent light shadcn card-stack and the dashboard-of-equal-cards
default: this is one lit panel, not a page of widgets.

OWN-WORLD: Near-black cool arena ground (--arena-bg). Bolted panels one step
up, hairline lit top edge, real offset+blur depth. Board voice = Saira
Condensed at signage scale, uppercase, for every name / court number / status
word. Readout voice = Geist Mono, tabular, tracked, for positions, counts,
wait times. Colour is Committed: brand orange #f26522 (unaltered) rationed to
LIVE only — the foursome being called, the court just opened, "you're up". A
cool electric wash (--arena-next) marks IMMINENT (on deck). Everything still
waiting is graphite + cool-white, no accent. A fixed tabular numbered rail
(.od-rail) down the left of every queue. Milled keys (.od-key) with an
engraved label under each; the turnover key is orange and unmistakable.

STORY: A player glances up mid-point and knows in one read: am I up, on deck,
or still waiting — and which court. An organizer or courtside volunteer sees
every court, taps one big labelled key to turn it over, and the next foursome
walks straight on.

FIRST VIEWPORT (Display / Kiosk, the snack-table tablet): top third is the two
ON DECK foursomes as large panels — "UP NEXT" carrying a filled orange
progress-to-court ladder, "AFTER THAT" cool. Below, the courts as a grid of
panels, each showing its four names in board type; an open court reads OPEN in
orange until its foursome flips on. The numbered queue runs down the lower
half behind the rail. No hero shell, no marketing chrome. On the player's
phone the first viewport collapses to one verdict: a full-width "#7 IN THE
QUEUE" or, when called, "YOU'RE UP · COURT 5" in orange at display scale.

FORM: The substitution / fourth-official's LED board. #1 of 7 grounded
directions ordered by resonance for a courtside Operate surface. Assigned by
the roll; also top rank, so no pick card. Raised by the challengers it beat:
rationed accent (nixie), pure-scale hierarchy (type specimen),
one-transformation-per-viewport (alphabet storm), numbered margin rail
(orizuru), physical labelled controls + progress ladder (cassette deck),
ruthless neutral restraint (mono-marketing).

SIGNATURE INTERACTION: a court frees -> the leading on-deck foursome's names
flip up onto that court tile with one decisive board-flip (.od-flip), the tile
pulses orange once (.od-pulse), and a fresh foursome slides into the "after
that" slot (.od-slide-in). Reduced motion: instant swap, no flip.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.
`;

/** Renders the direction contract as a real HTML comment in the built markup. */
function ContractComment() {
  return (
    <div
      hidden
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: `<!--\n${DIRECTION_CONTRACT}\n-->` }}
    />
  );
}

/**
 * The arena scope for On Deck's live-event surfaces (the player Session view,
 * the Organizer floor screen, the read-only Display, the courtside Kiosk, the
 * Volunteer link, and the club-QR "nothing running" screen). Sets `.od-arena`
 * — the dark substitution-board palette and type — which globals.css keeps
 * scoped so the marketing landing at exactly `/on-deck` and the rest of the
 * site are untouched.
 *
 * A plain wrapper, no client hooks: it renders on the server inside each page.
 */
export function ArenaShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`od-arena flex w-full flex-1 flex-col${
        className ? ` ${className}` : ""
      }`}
    >
      <ContractComment />
      {children}
    </div>
  );
}
