"use client";

import { useState } from "react";

/**
 * The hero's proof: On Deck's three real consoles — the Player's phone, the
 * Volunteer's floor screen, the Kiosk/Display board — reflecting one live
 * Session side by side. Picking a Floor Mode actually dims the console that
 * mode doesn't need, so the app's real differentiator (it never requires a
 * volunteer to exist — `on-deck/docs/adr/0005-app-never-requires-a-volunteer.md`)
 * is something a visitor operates, not a bullet point they read.
 *
 * A drawn stand-in, like the other widgets on this page (`.odv`, `.odm`):
 * names are drawn from real top PPA pros and nothing here is a screenshot.
 * Scoped under `.odl` / `.odlc`, never touching the real `.od-*` arena CSS.
 */

type FloorModeId = "volunteer" | "self-serve" | "hybrid";

const FLOOR_MODES: {
  id: FloorModeId;
  label: string;
  detail: string;
}[] = [
  {
    id: "volunteer",
    label: "Volunteer-run",
    detail: "Volunteer links drive the floor. Players never touch operations.",
  },
  {
    id: "hybrid",
    label: "Hybrid",
    detail:
      "Both at once — volunteers run the night, and anyone courtside can still tap a game done.",
  },
  {
    id: "self-serve",
    label: "Self-serve",
    detail: "The Kiosk only. Nobody has to run the floor for the app to work.",
  },
];

export function FloorModeConsoles() {
  const [mode, setMode] = useState<FloorModeId>("hybrid");
  const volunteerOn = mode !== "self-serve";
  const kioskOn = mode !== "volunteer";
  const activeDetail = FLOOR_MODES.find((m) => m.id === mode)?.detail;

  return (
    <div className="odlc">
      <div className="odlc-grid">
        {/* Player: always on. A player's own view never changes with Floor
            Mode - the point the layout makes without a caption. */}
        <div className="odlc-device odlc-device--player">
          <p className="odlc-device-label odl-mono">Player</p>
          <div className="odl-panel odl-panel--next odlc-phone">
            <p className="odl-mono odlc-phone-status">Session running</p>
            <p className="odlc-verdict odl-display">
              #4<span className="odlc-verdict-of">of 6</span>
            </p>
            <p className="odlc-verdict-tail odl-mono">in the queue</p>
          </div>
        </div>

        {/* Volunteer: the floor screen that runs the turnover. */}
        <div
          className="odlc-device odlc-device--volunteer"
          data-off={volunteerOn ? undefined : ""}
        >
          <p className="odlc-device-label odl-mono">Volunteer</p>
          <div className="odl-panel odlc-floor">
            <p className="odl-mono odlc-floor-court">Court 3</p>
            <ul className="odlc-floor-names odl-display">
              <li>Anna W</li>
              <li>Ben J</li>
            </ul>
            <span className="odl-key odl-key--go odlc-floor-key" aria-hidden>
              Court 3 done
            </span>
          </div>
          {!volunteerOn && (
            <p className="odlc-off-tag odl-mono">Not needed in self-serve</p>
          )}
        </div>

        {/* Kiosk / Display: the board on the snack table. */}
        <div
          className="odlc-device odlc-device--kiosk"
          data-off={kioskOn ? undefined : ""}
        >
          <p className="odlc-device-label odl-mono">Kiosk / display</p>
          <div className="odl-panel odlc-board">
            <div className="odlc-board-courts">
              <div className="odlc-board-court odlc-board-court--live">
                Court 3
              </div>
              <div className="odlc-board-court">Court 4</div>
            </div>
            <ol className="odlc-board-queue odl-mono">
              <li>
                <span>1</span>Tyson M
              </li>
              <li>
                <span>2</span>Catherine P
              </li>
            </ol>
          </div>
          {!kioskOn && (
            <p className="odlc-off-tag odl-mono">Links only in this mode</p>
          )}
        </div>
      </div>

      <p className="odl-mono odlc-readout">One session. One truth.</p>

      <div
        className="odlc-modes"
        role="radiogroup"
        aria-label="Floor Mode"
      >
        {FLOOR_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mode === m.id}
            className="odl-chip"
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="odl-mono odlc-mode-detail" aria-live="polite">
        {activeDetail}
      </p>

      <style>{consolesCss}</style>
    </div>
  );
}

const consolesCss = `
.odlc-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.1rem;
}
@media (min-width: 860px) {
  .odlc-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: start;
    gap: 1.25rem;
  }
}

.odlc-device { display: flex; flex-direction: column; gap: 0.6rem; }
.odlc-device-label { color: var(--odl-faint); }

.odlc-device[data-off] .odl-panel {
  opacity: 0.32;
  filter: saturate(0.35);
}
.odlc-off-tag {
  color: var(--odl-faint);
  transition: opacity 200ms ease;
}

.odlc-phone { padding: 1.4rem 1.25rem 1.6rem; text-align: left; }
.odlc-phone-status { color: var(--odl-next); }
.odlc-verdict { margin-top: 0.9rem; font-size: 2.75rem; }
.odlc-verdict-of {
  font-family: var(--odl-readout);
  font-weight: 400;
  font-size: 1rem;
  letter-spacing: 0.02em;
  text-transform: none;
  margin-left: 0.5rem;
  color: var(--odl-dim);
}
.odlc-verdict-tail { margin-top: 0.35rem; }

.odlc-floor { padding: 1.1rem 1.1rem 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }
.odlc-floor-court { color: var(--odl-dim); }
.odlc-floor-names {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 1.35rem;
  line-height: 1.15;
}
.odlc-floor-key { width: 100%; margin-top: 0.35rem; }

.odlc-board { padding: 1.1rem; display: flex; flex-direction: column; gap: 0.85rem; }
.odlc-board-courts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; }
.odlc-board-court {
  border-radius: 10px;
  border: 1px solid var(--odl-line-soft);
  background: var(--odl-panel-raised);
  padding: 0.55rem 0.65rem;
  font-family: var(--odl-arena);
  font-weight: 700;
  font-size: 0.85rem;
  text-transform: uppercase;
  color: var(--odl-dim);
}
.odlc-board-court--live {
  background: var(--odl-live);
  color: var(--odl-live-ink);
  border-color: transparent;
}
.odlc-board-queue { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.odlc-board-queue li { display: flex; gap: 0.6rem; color: var(--odl-dim); }
.odlc-board-queue span { color: var(--odl-faint); width: 2.25ch; text-align: right; }

.odlc-readout { margin-top: 1.5rem; text-align: center; color: var(--odl-dim); }

.odlc-modes {
  margin-top: 1.1rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
}

.odlc-mode-detail {
  margin-top: 0.9rem;
  text-align: center;
  max-width: 46ch;
  margin-inline: auto;
  color: var(--odl-faint);
}
`;
