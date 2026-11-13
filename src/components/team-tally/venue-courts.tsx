"use client";

import { useState, useTransition } from "react";

import { CourtGrid } from "@/components/court-grid/court-grid";
import { courtAt, EMPTY_GRID, PRESETS, type CourtGrid as Grid } from "@/lib/court-grid/grid";
import { deleteVenueAction, saveVenueAction } from "@/lib/team-tally/actions/venues";
import {
  awaitingBlue,
  courtsTouch,
  ownerOf,
  placedPairs,
  tapCourt,
  type HomeCourts,
  type TapResult,
} from "@/lib/team-tally/court-pairs";
import { MAX_VENUE_NAME, venueProblem, type Venue } from "@/lib/team-tally/venues";

/** One opening Matchup as the map needs it: its Home courts and what to call each Team. */
export type MapMatchup = HomeCourts & { key: string; redName: string; blueName: string };

type Drawing = { id?: string; name: string; grid: Grid };

const NO_COURTS: ReadonlySet<number> = new Set();

/**
 * The Courts sheet of Team Tally setup (#698): pick a saved Venue, or draw
 * one, then tap each opening Matchup's Court pair on its map. Taps write the
 * Teams' Home court text, which is all a Team Event stores. With no Venue
 * picked the sheet steps aside and the Home court boxes work as before.
 */
export function VenueCourts({
  venues,
  venueId,
  matchups,
  active,
  onVenues,
  onPick,
  onTap,
  onActive,
}: {
  venues: Venue[];
  venueId: string;
  matchups: MapMatchup[];
  active: number;
  onVenues: (venues: Venue[], picked: string) => void;
  onPick: (venueId: string) => void;
  onTap: (result: TapResult) => void;
  onActive: (index: number) => void;
}) {
  const venue = venues.find((each) => each.id === venueId);
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [note, setNote] = useState("");
  const [saving, startSaving] = useTransition();

  function save() {
    if (!drawing) return;
    const problem = venueProblem(drawing.name, drawing.grid);
    if (problem) {
      setNote(problem);
      return;
    }
    startSaving(async () => {
      const result = await saveVenueAction(drawing);
      if (!result.ok) {
        setNote(result.problem);
        return;
      }
      const saved = result.venue;
      onVenues([saved, ...venues.filter((each) => each.id !== saved.id)], saved.id);
      setDrawing(null);
      setNote(`Saved ${saved.name}. Tap each Match's two courts on it.`);
    });
  }

  function forget() {
    if (!drawing?.id) return;
    const id = drawing.id;
    startSaving(async () => {
      const result = await deleteVenueAction(id);
      if (!result.ok) {
        setNote(result.problem);
        return;
      }
      onVenues(
        venues.filter((each) => each.id !== id),
        "",
      );
      setNote(`Forgot ${drawing.name}. Its Team Events keep their home courts.`);
      setDrawing(null);
    });
  }

  return (
    <section className="tt-sheet tt-courts" aria-labelledby="tt-courts-head">
      <div className="tt-section-head">
        <h2 id="tt-courts-head" className="tt-h2">
          Courts
        </h2>
        {venue && !drawing ? <p className="tt-meta m-0">{venue.name}</p> : null}
      </div>
      <div className="tt-section-body flex flex-col gap-5">
        {drawing ? (
          <VenueDrawing
            drawing={drawing}
            saving={saving}
            onChange={(next) => {
              setDrawing(next);
              setNote("");
            }}
            onSave={save}
            onCancel={() => {
              setDrawing(null);
              setNote("");
            }}
            onForget={forget}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor="tt-venue" className="tt-label">
                  Venue
                </label>
                <select
                  id="tt-venue"
                  className="tt-field tt-venue-select"
                  value={venueId}
                  onChange={(event) => {
                    onPick(event.target.value);
                    setNote("");
                  }}
                >
                  <option value="">No venue: type each home court</option>
                  {venues.map((each) => (
                    <option key={each.id} value={each.id}>
                      {each.name}
                    </option>
                  ))}
                </select>
              </div>
              {venue ? (
                <button
                  type="button"
                  className="tt-btn tt-btn-ghost"
                  onClick={() => setDrawing({ id: venue.id, name: venue.name, grid: venue.grid })}
                >
                  Edit this venue
                </button>
              ) : null}
              <button
                type="button"
                className="tt-btn tt-btn-ghost"
                onClick={() => setDrawing({ name: "", grid: EMPTY_GRID })}
              >
                Draw a new venue
              </button>
            </div>
            {venue ? (
              <PairMap grid={venue.grid} matchups={matchups} active={active} onTap={onTap} onActive={onActive} />
            ) : (
              <p className="text-sm text-(--tt-ink-dim)">
                Draw your venue once and each Match&rsquo;s two courts are a tap each. Or type each
                Team&rsquo;s home court below.
              </p>
            )}
          </>
        )}
        <p role="status" className="text-sm text-(--tt-ink-dim) empty:hidden">
          {note}
        </p>
      </div>
    </section>
  );
}

function VenueDrawing({
  drawing,
  saving,
  onChange,
  onSave,
  onCancel,
  onForget,
}: {
  drawing: Drawing;
  saving: boolean;
  onChange: (drawing: Drawing) => void;
  onSave: () => void;
  onCancel: () => void;
  onForget: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-(--tt-ink-dim)">
        Tap a square to add a court. Tap a court to change its number or remove it. Courts that share
        an edge can be a Match&rsquo;s pair.
      </p>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Start from a shape">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="tt-shape"
            onClick={() => onChange({ ...drawing, grid: preset.grid() })}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <CourtGrid
        grid={drawing.grid}
        mode="draw"
        booked={NO_COURTS}
        onGridChange={(grid) => onChange({ ...drawing, grid })}
        onBookedChange={() => {}}
        label="Draw the venue"
      />
      <div className="flex flex-col gap-2">
        <label htmlFor="tt-venue-name" className="tt-label">
          Venue name
        </label>
        <input
          id="tt-venue-name"
          className="tt-field"
          value={drawing.name}
          maxLength={MAX_VENUE_NAME}
          autoComplete="off"
          onChange={(event) => onChange({ ...drawing, name: event.target.value })}
          onKeyDown={(event) => {
            // Enter here saves the venue, not the whole Team Event.
            if (event.key === "Enter") {
              event.preventDefault();
              onSave();
            }
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className="tt-btn" disabled={saving} onClick={onSave}>
          {saving ? "Saving…" : "Save venue"}
        </button>
        <button type="button" className="tt-quietlink" onClick={onCancel}>
          Cancel
        </button>
        {drawing.id ? (
          <button type="button" className="tt-quietlink ml-auto" disabled={saving} onClick={onForget}>
            Forget this venue
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Square states on the map, styled in team-tally.css. */
type PairState = "red" | "blue" | "can-pair" | "taken" | "free" | "faded";

/**
 * The Venue's courts, cropped to where they are drawn, to tap a pair on.
 * Everything shown is derived from the Home court text, so a typed or
 * pasted court lights up the same as a tapped one.
 */
function PairMap({
  grid,
  matchups,
  active,
  onTap,
  onActive,
}: {
  grid: Grid;
  matchups: MapMatchup[];
  active: number;
  onTap: (result: TapResult) => void;
  onActive: (index: number) => void;
}) {
  const pairs = placedPairs(grid, matchups);
  const current = matchups[active];
  const pair = pairs[active];
  const waiting = awaitingBlue(pair) ? pair.red : null;

  const rows = grid.courts.map((court) => court.row);
  const cols = grid.courts.map((court) => court.col);
  const top = Math.min(...rows);
  const left = Math.min(...cols);
  const height = Math.max(...rows) - top + 1;
  const width = Math.max(...cols) - left + 1;

  const squares = [];
  for (let row = top; row < top + height; row++) {
    for (let col = left; col < left + width; col++) {
      const court = courtAt(grid, row, col);
      if (!court) {
        squares.push(<span key={`${row}-${col}`} aria-hidden="true" />);
        continue;
      }
      const owner = ownerOf(pairs, court.number);
      let state: PairState;
      let tag = "";
      let name: string;
      if (owner && owner.index === active) {
        state = owner.side;
        tag = owner.side === "red" ? "Red" : "Blue";
        name =
          waiting === court.number
            ? `Court ${court.number}, ${current.redName}'s home court. Tap to take it back.`
            : `Court ${court.number}, ${owner.side === "red" ? current.redName : current.blueName}'s home court. Tap to start Match ${active + 1} again from here.`;
      } else if (owner) {
        state = "taken";
        tag = `M${owner.index + 1}`;
        name = `Court ${court.number}, taken by Match ${owner.index + 1}. Tap to go to it.`;
      } else if (waiting !== null && courtsTouch(grid, waiting, court.number)) {
        state = "can-pair";
        tag = "Pair";
        name = `Court ${court.number}, touches court ${waiting}. Tap to make it ${current.blueName}'s home court.`;
      } else {
        state = waiting !== null ? "faded" : "free";
        name = `Court ${court.number}, free. Tap to make it ${current.redName}'s home court.`;
      }
      squares.push(
        <button
          key={`${row}-${col}`}
          type="button"
          className="cg-square tt-pair-square"
          data-state={state}
          aria-label={name}
          onClick={() => onTap(tapCourt(grid, pairs, active, court.number))}
        >
          <span>{court.number}</span>
          {tag ? <span className="tt-pair-tag">{tag}</span> : null}
        </button>,
      );
    }
  }

  const hint =
    waiting === null
      ? `Placing Match ${active + 1}. Tap ${current.redName}'s home court first, then a court touching it for ${current.blueName}.`
      : `Court ${waiting} is ${current.redName}'s. Now tap a court touching it for ${current.blueName}.`;

  return (
    <div className="tt-pair-map flex flex-col gap-4">
      <p role="status" className="text-[0.9375rem]">
        {hint}
      </p>
      <div className="cg-field" role="group" aria-label="Venue map">
        <div className="cg-grid" style={{ gridTemplateColumns: `repeat(${width}, minmax(2.75rem, 4.5rem))` }}>
          {squares}
        </div>
      </div>
      <ul className="tt-pair-legend" aria-label="Key">
        <li>
          <span className="tt-pair-key" data-state="red" aria-hidden="true" />
          <span className="tt-pair-key" data-state="blue" aria-hidden="true" />
          This Match
        </li>
        <li>
          <span className="tt-pair-key" data-state="taken" aria-hidden="true" />
          Another Match
        </li>
        <li>
          <span className="tt-pair-key" data-state="can-pair" aria-hidden="true" />
          Can pair
        </li>
      </ul>
      <ol className="tt-pair-list" aria-label="Matches">
        {matchups.map((matchup, index) => {
          const placed = pairs[index];
          const courts =
            placed.red !== null && placed.blue !== null
              ? `Courts ${placed.red} & ${placed.blue}`
              : placed.red !== null
                ? `Court ${placed.red} & ?`
                : "No courts yet";
          return (
            <li key={matchup.key}>
              <button
                type="button"
                className="tt-pair-match"
                aria-current={index === active ? "step" : undefined}
                onClick={() => onActive(index)}
              >
                <span className="tt-pair-match-name">Match {index + 1}</span>
                <span className="tt-pair-match-courts">{courts}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
