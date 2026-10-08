"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { ArrowUp } from "lucide-react";

import type { DocTeam, Round } from "@/lib/team-tally/event-doc";
import type { TeamWrites } from "@/lib/team-tally/live-seam";
import { checkRosterChange, type Roster } from "@/lib/team-tally/roster";

const SLOTS = [
  { round: 1, key: "slotA", letter: "A" },
  { round: 2, key: "slotB", letter: "B" },
  { round: 3, key: "slotC", letter: "C" },
] as const;

function rosterOf(team: DocTeam): Roster {
  return { slotA: team.slotA, slotB: team.slotB, slotC: team.slotC };
}

/**
 * A Team's Player slots on the night: rename one, or move a player up a
 * slot. Slot N partners the captain in Round N, so a Round with a score pins
 * its slot (read-only, with the reason). Plain fields and buttons.
 */
export function RosterForm({
  team,
  title,
  scoredRounds,
  writes,
}: {
  team: DocTeam;
  title: string;
  scoredRounds: Round[];
  writes: TeamWrites;
}) {
  const id = useId();
  const [draft, setDraft] = useState<Roster | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const current = rosterOf(team);
  const shown = draft ?? current;
  const locked = (round: number) => scoredRounds.includes(round as Round);

  function change(next: Roster) {
    setMessage(null);
    setDraft(next);
  }

  function moveUp(index: 1 | 2) {
    const above = SLOTS[index - 1].key;
    const here = SLOTS[index].key;
    change({ ...shown, [above]: shown[here], [here]: shown[above] });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const check = checkRosterChange(current, shown, scoredRounds);
    if (!check.ok) {
      setMessage({ ok: false, text: check.problem });
      return;
    }
    startTransition(async () => {
      const result = await writes.saveRoster(team.id, shown);
      if (!result.ok) {
        setMessage({ ok: false, text: result.problem });
        return;
      }
      setDraft(null);
      setMessage({ ok: true, text: "Roster saved." });
    });
  }

  return (
    <form className="tt-sheet tt-roster" aria-label={title} onSubmit={submit} noValidate>
      <div className="tt-section-head">
        <h3 className="tt-h2 tt-roster-title">{title}</h3>
        <span className="tt-meta">Captain {team.captain}</span>
      </div>
      <div className="tt-roster-body">
        {SLOTS.map(({ round, key, letter }, index) => {
          const pinned = locked(round);
          const canMoveUp = index > 0 && !pinned && !locked(SLOTS[index - 1].round);
          return (
            <div key={key} className="tt-roster-row">
              <label htmlFor={`${id}-${key}`} className="tt-label">
                Player {letter}
              </label>
              {/* A slot that can't move up (its Round, or the one above, has a score) gets no button at all. */}
              <div className="tt-roster-field" data-move={canMoveUp || undefined}>
                <input
                  id={`${id}-${key}`}
                  className="tt-field"
                  value={shown[key]}
                  readOnly={pinned}
                  aria-describedby={`${id}-${key}-note`}
                  onChange={(event) => change({ ...shown, [key]: event.target.value })}
                />
                {canMoveUp && (
                  <button
                    type="button"
                    className="tt-btn tt-btn-ghost tt-roster-move"
                    disabled={pending}
                    aria-label={`Swap ${letter} and ${SLOTS[index - 1].letter}`}
                    onClick={() => moveUp(index as 1 | 2)}
                  >
                    <ArrowUp aria-hidden size={18} strokeWidth={2.5} />
                  </button>
                )}
              </div>
              <span id={`${id}-${key}-note`} className="tt-roster-note">
                {pinned ? `Round ${round} has a score, so this stays.` : `Partners the captain in Round ${round}.`}
              </span>
            </div>
          );
        })}
        <div className="tt-roster-foot">
          <button type="submit" className="tt-btn" disabled={pending || draft === null}>
            {pending ? "Saving" : "Save roster"}
          </button>
          {message && (
            <p className={message.ok ? "tt-roster-saved" : "tt-flag-note"} role={message.ok ? "status" : "alert"}>
              {message.text}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
