"use client";

import { useEffect, useRef, useState } from "react";

import { CourtGrid, type GridMode } from "@/components/court-grid/court-grid";
import { courtList } from "@/components/apps/match-mixer/lib/court-labels";
import {
  deleteVenue,
  loadVenues,
  MAX_VENUE_NAME,
  saveVenue,
  type Venue,
} from "@/components/apps/match-mixer/lib/persistence/venue-storage";
import {
  bookedNumbers,
  duplicateNumbers,
  EMPTY_GRID,
  PRESETS,
  renumber,
  type CourtGrid as Grid,
} from "@/lib/court-grid/grid";

/**
 * Tonight's courts by the numbers the facility prints on them (#697). Under
 * the Courts dial: a line saying which courts the board will name, and the
 * control that opens the Venue picker. With no labels the board reads courts
 * 1 to N, exactly as it always has.
 */
export function VenueCourts({
  labels,
  courts,
  onChoose,
}: {
  labels: readonly number[] | null;
  /** The court count the board will actually use, after the Roster's clamp. */
  courts: number;
  onChoose: (labels: readonly number[] | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const used = labels ? labels.slice(0, courts) : null;

  return (
    <div className="mm-venue-line">
      {used ? (
        <p className="mm-note" id="mm-venue-note">
          {`Tonight: ${courtList(used.map((_, court) => court), used)}.`}
          {labels && labels.length > courts
            ? ` This list fills ${courts} of the ${labels.length} you booked.`
            : null}
        </p>
      ) : null}
      <div className="mm-venue-actions">
        <button type="button" className="mm-quiet" onClick={() => setOpen(true)}>
          {labels ? "Change courts" : "Use your venue’s court numbers"}
        </button>
        {labels ? (
          <button type="button" className="mm-quiet" onClick={() => onChoose(null)}>
            Number 1 to {labels.length}
          </button>
        ) : null}
      </div>
      {open ? (
        <VenueDialog
          labels={labels}
          onChoose={(next) => {
            onChoose(next);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

/** What the save row last said, and whether it was a save or a refusal. */
type SaveNote = { readonly text: string; readonly tone: "done" | "refused" } | null;

function bookAll(grid: Grid): Set<number> {
  return new Set(grid.courts.map((court) => court.number));
}

/**
 * What the picker opens on. The venue tonight's courts came from, with those
 * courts booked, when a saved venue holds every one of them. Tonight's courts
 * in a row, when they came from a drawing nobody saved. Otherwise the first
 * saved venue, or an empty grid to draw on.
 */
function openingOf(
  venues: readonly Venue[],
  labels: readonly number[] | null,
): { venue: string | null; grid: Grid; booked: Set<number>; step: GridMode } {
  if (labels) {
    const from = venues.find((venue) => {
      const numbers = bookAll(venue.grid);
      return labels.every((label) => numbers.has(label));
    });
    if (from) return { venue: from.name, grid: from.grid, booked: new Set(labels), step: "book" };
    const row: Grid = { courts: labels.map((number, col) => ({ row: 0, col, number })) };
    return { venue: null, grid: row, booked: new Set(labels), step: "book" };
  }
  const first = venues[0];
  if (first) return { venue: first.name, grid: first.grid, booked: bookAll(first.grid), step: "book" };
  return { venue: null, grid: EMPTY_GRID, booked: new Set(), step: "draw" };
}

/**
 * The Venue picker: saved venues along the top, then the two steps, drawing
 * the venue and tapping tonight's courts. Saving is optional; a one-off night
 * draws, taps and uses. A bottom sheet on a phone, a card over the board on
 * a laptop, the same as the score keypad.
 */
function VenueDialog({
  labels,
  onChoose,
  onClose,
}: {
  labels: readonly number[] | null;
  onChoose: (labels: readonly number[]) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // Read once, on open: storage does not exist on the server, and this only
  // ever mounts in the browser after a tap.
  const [venues, setVenues] = useState<Venue[]>(() => loadVenues());
  const [opening] = useState(() => openingOf(venues, labels));
  const [current, setCurrent] = useState<string | null>(opening.venue);
  const [grid, setGrid] = useState<Grid>(opening.grid);
  const [booked, setBooked] = useState<ReadonlySet<number>>(opening.booked);
  const [step, setStep] = useState<GridMode>(opening.step);
  const [name, setName] = useState(opening.venue ?? "");
  const [saved, setSaved] = useState<SaveNote>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  const tonight = bookedNumbers(grid, booked);
  const clash = duplicateNumbers(grid).filter((number) => booked.has(number));

  const openVenue = (venue: Venue) => {
    setCurrent(venue.name);
    setGrid(venue.grid);
    setBooked(bookAll(venue.grid));
    setName(venue.name);
    setStep("book");
    setSaved(null);
  };

  /** A fresh venue: no name, nothing saved, an empty grid. */
  const startNew = () => {
    setCurrent(null);
    setName("");
    redraw(EMPTY_GRID);
  };

  /**
   * A new drawing for the venue being edited: a shape, or a cleared grid. The
   * name stays, so saving updates this venue rather than asking for it again.
   */
  const redraw = (from: Grid) => {
    setGrid(from);
    setBooked(bookAll(from));
    setStep("draw");
    setSaved(null);
  };

  const keep = () => {
    const next = saveVenue(name, grid);
    if (!next) {
      const text = grid.courts.length === 0 ? "Add a court first." : "Give the venue a name first.";
      setSaved({ text, tone: "refused" });
      return;
    }
    setVenues(next);
    setCurrent(name.trim());
    setSaved({ text: `Saved ${name.trim()}.`, tone: "done" });
  };

  const forget = () => {
    if (!current) return;
    setVenues(deleteVenue(current));
    startNew();
  };

  return (
    <dialog
      ref={dialog}
      className="mm-keypad mm-venue"
      aria-labelledby="mm-venue-title"
      onClose={onClose}
    >
      <div className="mm-keypad-head">
        <h2 id="mm-venue-title" className="mm-keypad-title">
          {current ?? "Tonight’s courts"}
        </h2>
        <button type="button" className="mm-quiet" onClick={() => dialog.current?.close()}>
          Cancel
        </button>
      </div>

      {venues.length > 0 ? (
        <div className="mm-venue-row" role="group" aria-label="Your venues">
          {venues.map((venue) => (
            <button
              key={venue.name}
              type="button"
              className="mm-venue-chip"
              aria-pressed={venue.name === current}
              onClick={() => openVenue(venue)}
            >
              {venue.name}
            </button>
          ))}
          <button type="button" className="mm-venue-chip" data-new onClick={() => startNew()}>
            New venue
          </button>
        </div>
      ) : null}

      <div className="mm-venue-steps" role="group" aria-label="Step">
        <button
          type="button"
          className="mm-venue-step"
          aria-pressed={step === "draw"}
          onClick={() => setStep("draw")}
        >
          1. Draw the venue
        </button>
        <button
          type="button"
          className="mm-venue-step"
          aria-pressed={step === "book"}
          disabled={grid.courts.length === 0}
          onClick={() => setStep("book")}
        >
          2. Tonight’s courts
        </button>
      </div>

      <p className="mm-note mm-venue-hint">
        {step === "draw"
          ? "Tap a square to add a court, then tap a court to change its number. Courts that share an edge touch."
          : "Tap a court to leave it out tonight, and tap it again to put it back."}
      </p>

      {step === "draw" ? (
        <div className="mm-venue-row" role="group" aria-label="Start from a shape">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="mm-venue-chip"
              data-shape
              onClick={() => redraw(preset.grid())}
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}

      <CourtGrid
        grid={grid}
        mode={step}
        booked={booked}
        onGridChange={(next) => {
          setGrid(next);
          setSaved(null);
        }}
        onBookedChange={setBooked}
        label={step === "draw" ? "The venue, square by square" : "Tonight’s courts"}
      />

      {step === "draw" && grid.courts.length > 0 ? (
        <div className="mm-venue-tools">
          <button
            type="button"
            className="mm-quiet"
            onClick={() => {
              const next = renumber(grid);
              setGrid(next);
              setBooked(bookAll(next));
            }}
          >
            Renumber 1 to {grid.courts.length}
          </button>
          <button type="button" className="mm-quiet" onClick={() => redraw(EMPTY_GRID)}>
            Clear grid
          </button>
        </div>
      ) : null}

      <div className="mm-venue-save">
        <label className="mm-note" htmlFor="mm-venue-name">
          Save this venue as
        </label>
        <div className="mm-venue-save-row">
          <input
            id="mm-venue-name"
            className="mm-input mm-venue-name"
            value={name}
            maxLength={MAX_VENUE_NAME}
            placeholder="Venue name"
            autoComplete="off"
            onChange={(event) => {
              setName(event.target.value);
              setSaved(null);
            }}
          />
          <button type="button" className="mm-share mm-venue-keep" onClick={keep}>
            Save
          </button>
        </div>
        <p className="mm-note" role="status" data-tone={saved?.tone}>
          {saved?.text ?? "Optional. Skip it for a one-off night."}
        </p>
        {current ? (
          <button type="button" className="mm-quiet" onClick={forget}>
            Forget {current}
          </button>
        ) : null}
      </div>

      {clash.length > 0 ? (
        <p className="mm-note" data-tone="refused">
          {`Two courts are numbered ${clash[0]}. Change one before using them.`}
        </p>
      ) : null}
      <button
        type="button"
        className="mm-button mm-venue-use"
        disabled={tonight.length === 0 || clash.length > 0}
        onClick={() => onChoose(tonight)}
      >
        {tonight.length === 0
          ? "Pick tonight’s courts"
          : `Use ${courtList(tonight.map((_, court) => court), tonight)}`}
      </button>
    </dialog>
  );
}
