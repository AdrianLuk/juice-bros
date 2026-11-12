"use client";

import { useState } from "react";

import {
  addCourt,
  courtAt,
  duplicateNumbers,
  GRID_COLUMNS,
  gridRows,
  MAX_COURT_NUMBER,
  removeCourt,
  setCourtNumber,
  touchingCourts,
  type CourtGrid as Grid,
} from "@/lib/court-grid/grid";

/**
 * The selected court's number as a box you can clear and retype. Held as a
 * draft and committed on Enter or on leaving the box, so typing "17" never
 * passes through court 1 on the way.
 */
function NumberDraft({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const number = Number(draft);
    if (Number.isInteger(number) && number >= 1 && number !== value) onCommit(number);
    else setDraft(String(value));
  };
  return (
    <input
      className="cg-number"
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={3}
      aria-label="Court number"
      value={draft}
      onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}

/**
 * The court grid painter (#697): a facility drawn as squares, one court per
 * square. Shared UI with no app in it. Match Mixer uses it today and Team
 * Tally next. Each app themes it by setting the `--cg-*` custom properties on
 * an ancestor; the defaults are plain enough to read anywhere.
 *
 * Two modes:
 * - `draw`: tap an empty square to add a court numbered one past the highest;
 *   tap a court to select it, then change its number or remove it. The courts
 *   it touches are outlined.
 * - `book`: tap a court to book it for tonight or leave it out. Empty squares
 *   do nothing.
 */
export function CourtGrid({
  grid,
  mode,
  booked,
  onGridChange,
  onBookedChange,
  label = "Court grid",
}: {
  grid: Grid;
  mode: "draw" | "book";
  booked: ReadonlySet<number>;
  onGridChange: (grid: Grid) => void;
  onBookedChange: (booked: ReadonlySet<number>) => void;
  label?: string;
}) {
  const [picked, setPicked] = useState<{ row: number; col: number } | null>(null);
  // A pick only means something while drawing, and only while a court is there.
  const selected = mode === "draw" && picked ? courtAt(grid, picked.row, picked.col) : undefined;
  const touching = selected ? touchingCourts(grid, selected.row, selected.col) : [];
  const repeated = new Set(duplicateNumbers(grid));
  const rows = gridRows(grid);

  const tap = (row: number, col: number) => {
    const court = courtAt(grid, row, col);
    if (mode === "book") {
      if (!court) return;
      const next = new Set(booked);
      if (next.has(court.number)) next.delete(court.number);
      else next.add(court.number);
      onBookedChange(next);
      return;
    }
    if (!court) {
      const next = addCourt(grid, row, col);
      const added = courtAt(next, row, col);
      onGridChange(next);
      if (added) {
        // A new court is booked tonight unless the organizer says otherwise.
        onBookedChange(new Set([...booked, added.number]));
      }
      setPicked({ row, col });
      return;
    }
    setPicked(selected && selected.row === row && selected.col === col ? null : { row, col });
  };

  const renumberSelected = (number: number) => {
    if (!selected) return;
    const clamped = Math.min(MAX_COURT_NUMBER, Math.max(1, number));
    onGridChange(setCourtNumber(grid, selected.row, selected.col, clamped));
    // The booking follows the court, not the old number.
    if (booked.has(selected.number)) {
      const next = new Set(booked);
      next.delete(selected.number);
      next.add(clamped);
      onBookedChange(next);
    }
  };

  const removeSelected = () => {
    if (!selected) return;
    onGridChange(removeCourt(grid, selected.row, selected.col));
    if (!grid.courts.some((court) => court !== selected && court.number === selected.number)) {
      const next = new Set(booked);
      next.delete(selected.number);
      onBookedChange(next);
    }
    setPicked(null);
  };

  const squares = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < GRID_COLUMNS; col++) {
      const court = courtAt(grid, row, col);
      const isSelected = selected !== undefined && court === selected;
      const isTouching = court !== undefined && touching.includes(court);
      const isBooked = court !== undefined && booked.has(court.number);
      let state: string;
      let name: string;
      if (!court) {
        state = "empty";
        name = mode === "draw" ? `Add a court, row ${row + 1}, column ${col + 1}` : "Empty";
      } else if (mode === "book") {
        state = isBooked ? "booked" : "off";
        name = `Court ${court.number}, ${isBooked ? "booked tonight" : "not tonight"}`;
      } else {
        state = isSelected ? "selected" : "court";
        name = `Court ${court.number}${isSelected ? ", selected" : isTouching ? `, touches court ${selected?.number}` : ""}`;
      }
      squares.push(
        <button
          key={`${row}-${col}`}
          type="button"
          className="cg-square"
          data-state={state}
          data-touching={isTouching && mode === "draw" ? "true" : undefined}
          data-repeated={court && repeated.has(court.number) ? "true" : undefined}
          aria-label={name}
          aria-pressed={mode === "book" && court ? isBooked : undefined}
          tabIndex={mode === "book" && !court ? -1 : undefined}
          disabled={mode === "book" && !court}
          onClick={() => tap(row, col)}
        >
          {court ? court.number : mode === "draw" ? <span aria-hidden="true">+</span> : null}
        </button>,
      );
    }
  }

  return (
    <div className="cg">
      <div className="cg-field" role="group" aria-label={label}>
        <div className="cg-grid" style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))` }}>
          {squares}
        </div>
      </div>

      {selected ? (
        <div className="cg-court" role="group" aria-label={`Court ${selected.number}`}>
          <span className="cg-court-label">Court number</span>
          <div className="cg-stepper">
            <button
              type="button"
              className="cg-step"
              aria-label="Lower the number"
              disabled={selected.number <= 1}
              onClick={() => renumberSelected(selected.number - 1)}
            >
              <span aria-hidden="true">&minus;</span>
            </button>
            <NumberDraft
              key={`${selected.row}-${selected.col}-${selected.number}`}
              value={selected.number}
              onCommit={renumberSelected}
            />
            <button
              type="button"
              className="cg-step"
              aria-label="Raise the number"
              disabled={selected.number >= MAX_COURT_NUMBER}
              onClick={() => renumberSelected(selected.number + 1)}
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>
          {repeated.has(selected.number) ? (
            <p className="cg-warning">Another court already has this number.</p>
          ) : null}
          <button type="button" className="cg-remove" onClick={removeSelected}>
            Remove court {selected.number}
          </button>
        </div>
      ) : null}
    </div>
  );
}
