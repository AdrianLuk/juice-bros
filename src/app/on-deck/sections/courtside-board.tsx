import { Reveal } from "@/components/motion/reveal";

/**
 * A static replica of the courtside board players and volunteers actually
 * look at, quoting the On Deck Arena design system (`on-deck/DESIGN.md`) —
 * near-black cool ground, bolted panels with a lit top edge, Saira Condensed
 * signage, Geist Mono readouts, orange reserved for the one foursome being
 * called — without pulling in any of the real `.od-*` arena CSS. Names are
 * drawn from real top PPA pros; nothing here is a screenshot or a live view.
 *
 * The board was always dark, depicting a physical display in a gym; the page
 * around it now shares the same ground (`.odl`), so the board reads as the
 * page's own material rather than a widget dropped onto it.
 */

const onDeck = [
  {
    slot: "Up next",
    tone: "next" as const,
    ready: "3 / 4 ready",
    names: ["Anna W", "Ben J", "Riley N", "open spot"],
  },
  {
    slot: "After that",
    tone: "wait" as const,
    names: ["Tyson M", "Catherine P", "Collin J", "JW J"],
  },
];

const courts = [
  { n: "1", names: ["Zane N", "Dylan F", "Federico S", "Vivienne D"] },
  { n: "2", names: ["Lea J", "James I", "Parris T", "Andrei D"] },
  { n: "3", live: true, names: ["Anna W", "Ben J", "Riley N", "Rafa H"] },
  { n: "4", names: ["Callan D", "Etta W", "Lauren S", "Thomas W"] },
];

const queue = [
  { name: "Tyson M", wait: "6 MIN" },
  { name: "Catherine P", wait: "6 MIN" },
  { name: "Collin J", wait: "5 MIN" },
  { name: "JW J", wait: "4 MIN" },
  { name: "Jack M", wait: "3 MIN" },
  { name: "Irina T", wait: "3 MIN" },
  { name: "Hunter J", wait: "2 MIN" },
  { name: "Gabe T", wait: "1 MIN" },
  { name: "Rafa H", wait: "just now" },
];

const annotations = [
  {
    head: "Longest wait is always next",
    body: "The person who has waited longest anchors the next foursome. The other three come from the next-longest waiting.",
  },
  {
    head: "Orange means being called now",
    body: "Court 3 just turned over. Those four gather while every other court keeps playing. Nothing else on the board is orange.",
    live: true,
  },
  {
    head: "Check your own spot",
    body: "A player scans the sign and sees their place in line on their phone, so nobody has to ask a volunteer whether they're up.",
  },
];

export function CourtsideBoard() {
  return (
    <section className="odl-section w-full">
      <div className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="odl-display text-3xl sm:text-4xl">
            What the courtside screen shows
          </h2>
          <p className="odl-body mt-4 text-lg">
            One lit panel a loud gym reads at a glance: who&apos;s on which
            court, who&apos;s up next, and how long the line really is.
          </p>
        </Reveal>

        <Reveal variant="scale" className="mt-12">
          <div className="odm">
            <div className="odm-board">
              <div className="odm-boardhead">
                <span className="odm-mono odm-boardhead-label">On Deck</span>
                <span className="odm-mono odm-boardhead-venue">
                  TO Pickleball · Saturday Social
                </span>
              </div>

              <div className="odm-grid">
                <div className="odm-col">
                  <div className="odm-ondeck">
                    {onDeck.map((group) => (
                      <div
                        key={group.slot}
                        className={`odm-panel odm-panel--${group.tone}`}
                      >
                        <div className="odm-panel-top">
                          <span className="odm-mono">{group.slot}</span>
                          {group.ready ? (
                            <span className="odm-mono odm-ready">
                              {group.ready}
                            </span>
                          ) : null}
                        </div>
                        <ul className="odm-foursome">
                          {group.names.map((name, i) => (
                            <li
                              key={`${group.slot}-${i}`}
                              className={
                                name === "open spot"
                                  ? "odm-name odm-name--open"
                                  : "odm-name"
                              }
                            >
                              {name}
                            </li>
                          ))}
                        </ul>
                        {group.ready ? (
                          <div className="odm-ladder" aria-hidden>
                            <span className="odm-ladder-fill" />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="odm-section-label odm-mono">
                    On the courts
                  </div>
                  <div className="odm-courts">
                    {courts.map((court) => (
                      <div
                        key={court.n}
                        className={
                          court.live ? "odm-court odm-court--live" : "odm-court"
                        }
                      >
                        <div className="odm-court-top">
                          <span className="odm-court-n">Court {court.n}</span>
                          {court.live ? (
                            <span className="odm-mono odm-court-tag">
                              Just opened
                            </span>
                          ) : null}
                        </div>
                        <ul className="odm-court-names">
                          {court.names.map((name, i) => (
                            <li key={`${court.n}-${i}`}>{name}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="odm-col odm-col--queue">
                  <div className="odm-section-label odm-mono">
                    In the queue
                    <span className="odm-count">09</span>
                  </div>
                  <ol className="odm-queue">
                    {queue.map((player, i) => (
                      <li key={player.name} className="odm-queue-row">
                        <span className="odm-mono odm-rail">{i + 1}</span>
                        <span className="odm-queue-name">{player.name}</span>
                        <span className="odm-mono odm-queue-wait">
                          {player.wait}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

            <ul className="odm-notes">
              {annotations.map((note) => (
                <li key={note.head} className="odm-note">
                  <p
                    className={
                      note.live
                        ? "odm-note-head odm-note-head--live"
                        : "odm-note-head"
                    }
                  >
                    {note.head}
                  </p>
                  <p className="odm-note-body">{note.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>

      <style>{boardCss}</style>
    </section>
  );
}

/* Scoped under `.odm` and never touching the `.od-*` arena namespace or
   globals.css. The board's palette is lifted straight from
   `on-deck/DESIGN.md`: near-neutral cool graphite (chroma ~0.012–0.02), one
   committed warm accent, one cool secondary. */
const boardCss = `
.odm {
  --odm-bg: oklch(0.16 0.014 255);
  --odm-panel: oklch(0.213 0.017 258);
  --odm-recessed: oklch(0.13 0.013 255);
  --odm-line-soft: oklch(0.3 0.018 258 / 0.6);
  --odm-fg: oklch(0.97 0.006 250);
  --odm-dim: oklch(0.74 0.012 250);
  --odm-faint: oklch(0.64 0.012 250);
  --odm-live: #f26522;
  --odm-live-ink: #ffffff;
  --odm-next: oklch(0.86 0.09 218);
  --odm-next-line: oklch(0.72 0.1 218 / 0.7);
}

.odm-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.75rem;
  margin-top: 1.25rem;
}
@media (min-width: 1024px) {
  .odm-grid {
    grid-template-columns: minmax(0, 1.4fr) 1px minmax(0, 1fr);
    gap: 0 2rem;
    align-items: stretch;
  }
  .odm-grid::before {
    content: "";
    grid-column: 2 / 3;
    grid-row: 1;
    background: var(--odm-line-soft);
  }
  .odm-grid > .odm-col:first-of-type { grid-column: 1 / 2; }
  .odm-grid > .odm-col--queue { grid-column: 3 / 4; }
}
.odm-col { min-width: 0; }

.odm-mono {
  font-family: var(--font-mono), ui-monospace, monospace;
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}

.odm-board {
  background: var(--odm-bg);
  border-radius: 20px;
  padding: 1.25rem;
  color: var(--odm-fg);
  box-shadow:
    inset 0 1px 0 0 oklch(1 0 0 / 0.05),
    0 1px 2px oklch(0 0 0 / 0.4),
    0 30px 60px -30px oklch(0.2 0.13 40 / 0.55);
}

@media (min-width: 640px) { .odm-board { padding: 1.75rem; } }

.odm-boardhead {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--odm-line-soft);
}
.odm-boardhead-label {
  color: var(--odm-fg);
  font-family: var(--font-arena), "Saira Condensed", "Arial Narrow", sans-serif;
  font-weight: 800;
  font-size: 1.05rem;
  letter-spacing: 0.02em;
}
.odm-boardhead-venue { color: var(--odm-faint); }

.odm-ondeck {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
}
@media (min-width: 560px) {
  .odm-ondeck { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1024px) {
  .odm-col--queue .odm-section-label { margin-top: 0; }
}

.odm-panel {
  background: var(--odm-panel);
  border: 1px solid var(--odm-line-soft);
  border-radius: 14px;
  padding: 1rem 1.1rem 1.1rem;
  box-shadow:
    inset 0 1px 0 0 oklch(1 0 0 / 0.05),
    0 1px 2px oklch(0 0 0 / 0.4),
    0 18px 40px -22px oklch(0 0 0 / 0.7);
}
.odm-panel--next {
  border-color: var(--odm-next-line);
  box-shadow:
    inset 0 1px 0 0 oklch(0.86 0.11 218 / 0.35),
    inset 0 22px 40px -30px oklch(0.82 0.14 218 / 0.9),
    0 18px 40px -22px oklch(0 0 0 / 0.7);
}

.odm-panel-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--odm-dim);
}
.odm-panel--next .odm-panel-top { color: var(--odm-next); }
.odm-ready { color: var(--odm-next); }

.odm-foursome {
  margin-top: 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.odm-name {
  font-family: var(--font-arena), "Saira Condensed", "Arial Narrow", sans-serif;
  font-weight: 700;
  font-size: 1.4rem;
  line-height: 1.12;
  letter-spacing: 0.005em;
  text-transform: uppercase;
  color: var(--odm-fg);
}
.odm-name--open { color: var(--odm-faint); }

.odm-ladder {
  margin-top: 0.85rem;
  height: 4px;
  border-radius: 9999px;
  background: var(--odm-recessed);
  overflow: hidden;
}
.odm-ladder-fill {
  display: block;
  height: 100%;
  width: 75%;
  border-radius: inherit;
  background: var(--odm-live);
}

.odm-section-label {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--odm-dim);
  margin-top: 1.75rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--odm-line-soft);
}
.odm-count { color: var(--odm-faint); }

.odm-courts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
  margin-top: 0.85rem;
}

.odm-court {
  background: var(--odm-panel);
  border: 1px solid var(--odm-line-soft);
  border-radius: 12px;
  padding: 0.8rem 0.9rem;
  box-shadow:
    inset 0 1px 0 0 oklch(1 0 0 / 0.05),
    0 1px 2px oklch(0 0 0 / 0.4),
    0 14px 30px -20px oklch(0 0 0 / 0.7);
}
.odm-court--live {
  background: var(--odm-live);
  border-color: transparent;
  color: var(--odm-live-ink);
  box-shadow:
    inset 0 1px 0 0 oklch(1 0 0 / 0.18),
    0 0 0 1px oklch(0.66 0.2 40 / 0.6),
    0 14px 40px -8px oklch(0.68 0.19 40 / 0.55);
}

.odm-court-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}
.odm-court-n {
  font-family: var(--font-arena), "Saira Condensed", "Arial Narrow", sans-serif;
  font-weight: 800;
  font-size: 1.05rem;
  letter-spacing: 0.01em;
  text-transform: uppercase;
}
.odm-court-tag { color: var(--odm-live-ink); opacity: 0.9; }

.odm-court-names {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  font-family: var(--font-arena), "Saira Condensed", "Arial Narrow", sans-serif;
  font-weight: 700;
  font-size: 1rem;
  line-height: 1.28;
  letter-spacing: 0.005em;
  text-transform: uppercase;
  color: var(--odm-dim);
}
.odm-court--live .odm-court-names { color: var(--odm-live-ink); }

.odm-queue {
  margin-top: 0.5rem;
  list-style: none;
  padding: 0;
}
.odm-queue-row {
  display: grid;
  grid-template-columns: 2.25ch minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 0.85rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--odm-line-soft);
}
.odm-queue-row:last-child { border-bottom: 0; }
.odm-rail {
  text-align: right;
  color: var(--odm-faint);
}
.odm-queue-name {
  font-family: var(--font-arena), "Saira Condensed", "Arial Narrow", sans-serif;
  font-weight: 700;
  font-size: 1.15rem;
  letter-spacing: 0.005em;
  text-transform: uppercase;
  color: var(--odm-fg);
}
.odm-queue-wait { color: var(--odm-dim); }

.odm-notes {
  list-style: none;
  padding: 0;
  margin-top: 2rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.75rem 2.5rem;
}
@media (min-width: 768px) {
  .odm-notes { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 2.5rem; }
}

.odm-note-head {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  font-family: var(--font-arena), "Saira Condensed", "Arial Narrow", sans-serif;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.005em;
  text-transform: uppercase;
  color: var(--odm-fg);
}
/* Graphite by default - orange is reserved for the one note that is actually
   about the LIVE state (the --live modifier), never a decorative bullet on
   every item. */
.odm-note-head::before {
  content: "";
  flex: none;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background: var(--odm-faint);
  translate: 0 -0.1rem;
}
.odm-note-head--live::before {
  background: var(--odm-live);
}
.odm-note-body {
  margin-top: 0.4rem;
  padding-left: 1.1rem;
  font-size: 0.95rem;
  line-height: 1.55;
  color: var(--odm-dim);
}
`;
