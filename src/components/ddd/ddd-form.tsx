"use client";

import { useActionState, useState, useTransition } from "react";

import { CourtGrid } from "@/components/court-grid/court-grid";
import { bookedNumbers, EMPTY_GRID, PRESETS, type CourtGrid as Grid } from "@/lib/court-grid/grid";
import { deleteVenueAction, saveDddAction, saveVenueAction, type FormState } from "@/lib/ddd/actions/organizer";
import { MAX_MAP_LINK, MAX_NAME, MAX_VENUE, type DddEvent } from "@/lib/ddd/events";
import { MAX_VENUE_NAME, venueProblem, type Venue } from "@/lib/ddd/venues";

type Drawing = { id?: string; name: string; grid: Grid };

function allCourts(grid: Grid): Set<number> {
  return new Set(grid.courts.map((court) => court.number));
}

/**
 * Where the picker opens. Editing: the Venue the DDD was set up on, with its
 * courts booked, when a saved Venue of that name still holds them all.
 * Creating: the most recent Venue with every court booked.
 */
function opening(venues: Venue[], event?: DddEvent): { venueId: string; booked: Set<number> } {
  if (event) {
    const numbers = event.courts.map(Number);
    const venue = venues.find(
      (each) =>
        each.name.toLowerCase() === event.playVenue.toLowerCase() &&
        numbers.every((number) => allCourts(each.grid).has(number)),
    );
    return venue ? { venueId: venue.id, booked: new Set(numbers) } : { venueId: "", booked: new Set() };
  }
  const first = venues[0];
  return first ? { venueId: first.id, booked: allCourts(first.grid) } : { venueId: "", booked: new Set() };
}

/**
 * Create a DDD, or change its setup (issue #711): name, date, the play venue
 * and the courts booked on it, and the dine & drink venue. The play venue is
 * a Venue drawn on the court grid, as in Team Tally, saved for every
 * Organizer; the courts booked are the DDD's courts 1, 2, 3... in number order.
 */
export function DddForm({ venues: initialVenues, event }: { venues: Venue[]; event?: DddEvent }) {
  const [state, formAction, saving] = useActionState<FormState, FormData>(
    saveDddAction.bind(null, event?.id ?? null),
    {},
  );
  const [venues, setVenues] = useState(initialVenues);
  const [start] = useState(() => opening(initialVenues, event));
  const [venueId, setVenueId] = useState(start.venueId);
  const [booked, setBooked] = useState<ReadonlySet<number>>(start.booked);
  const venue = venues.find((each) => each.id === venueId);
  const courts = venue ? bookedNumbers(venue.grid, booked).map(String) : [];
  // An edit whose Venue is gone keeps its courts until another Venue is picked.
  const kept = !venue && event && venueId === "" ? event : null;

  function pick(id: string, from: Venue[] = venues) {
    setVenueId(id);
    const next = from.find((each) => each.id === id);
    setBooked(next ? allCourts(next.grid) : new Set());
  }

  return (
    <form action={formAction} className="ddd-slip ddd-form">
      {event ? <p className="ddd-slip-head">Change the setup</p> : null}

      <div className="ddd-field">
        <label htmlFor="ddd-name">Name</label>
        <input id="ddd-name" name="name" required maxLength={MAX_NAME} defaultValue={event?.name} autoComplete="off" />
      </div>

      <div className="ddd-field">
        <label htmlFor="ddd-date">Date</label>
        <input id="ddd-date" name="date" type="date" required defaultValue={event?.date} />
      </div>

      <VenuePicker
        venues={venues}
        venueId={venueId}
        booked={booked}
        onPick={pick}
        onBooked={setBooked}
        onVenues={(next, picked) => {
          setVenues(next);
          pick(picked, next);
        }}
      />

      {kept ? (
        <>
          <input type="hidden" name="playVenue" value={kept.playVenue} />
          {kept.courts.map((court) => (
            <input key={court} type="hidden" name="court" value={court} />
          ))}
          <p className="ddd-note">
            Keeping {kept.playVenue}, courts {kept.courts.join(", ")}. Pick a venue to change them.
          </p>
        </>
      ) : venue ? (
        <>
          <input type="hidden" name="playVenue" value={venue.name} />
          {courts.map((court) => (
            <input key={court} type="hidden" name="court" value={court} />
          ))}
        </>
      ) : null}

      <div className="ddd-field">
        <label htmlFor="ddd-play-map">Play venue map link (optional)</label>
        <input
          id="ddd-play-map"
          name="playVenueMap"
          inputMode="url"
          maxLength={MAX_MAP_LINK}
          defaultValue={event?.playVenueMap ?? ""}
          placeholder="https://maps.app.goo.gl/…"
          autoComplete="off"
        />
      </div>

      <div className="ddd-field">
        <label htmlFor="ddd-dine">Dine &amp; drink venue</label>
        <input id="ddd-dine" name="dineVenue" maxLength={MAX_VENUE} defaultValue={event?.dineVenue} autoComplete="off" />
      </div>

      <div className="ddd-field">
        <label htmlFor="ddd-dine-map">Dine &amp; drink map link</label>
        <input
          id="ddd-dine-map"
          name="dineVenueMap"
          inputMode="url"
          maxLength={MAX_MAP_LINK}
          defaultValue={event?.dineVenueMap ?? ""}
          placeholder="https://maps.app.goo.gl/…"
          autoComplete="off"
          aria-describedby="ddd-dine-hint"
        />
        <p id="ddd-dine-hint" className="ddd-note">
          A name, a map link, or both. Copy the link from Share in Google Maps.
        </p>
      </div>

      <div className="ddd-actions">
        <button type="submit" className="ddd-btn" disabled={saving}>
          {saving ? "Saving…" : event ? "Save changes" : "Create the DDD"}
        </button>
        <p role="alert" className="ddd-problem empty:hidden">
          {state.problem}
        </p>
      </div>
    </form>
  );
}

/**
 * The play venue: pick a saved Venue and tap the courts booked on it, or draw
 * a new one. Team Tally's Courts sheet, with booking in place of pairing.
 */
function VenuePicker({
  venues,
  venueId,
  booked,
  onPick,
  onBooked,
  onVenues,
}: {
  venues: Venue[];
  venueId: string;
  booked: ReadonlySet<number>;
  onPick: (id: string) => void;
  onBooked: (booked: ReadonlySet<number>) => void;
  onVenues: (venues: Venue[], picked: string) => void;
}) {
  const venue = venues.find((each) => each.id === venueId);
  const [drawing, setDrawing] = useState<Drawing | null>(venues.length === 0 ? { name: "", grid: EMPTY_GRID } : null);
  const [note, setNote] = useState("");
  const [busy, startBusy] = useTransition();
  const courts = venue ? bookedNumbers(venue.grid, booked) : [];

  function save() {
    if (!drawing) return;
    const problem = venueProblem(drawing.name, drawing.grid);
    if (problem) {
      setNote(problem);
      return;
    }
    startBusy(async () => {
      const result = await saveVenueAction(drawing);
      if (!result.ok) {
        setNote(result.problem);
        return;
      }
      onVenues([result.venue, ...venues.filter((each) => each.id !== result.venue.id)], result.venue.id);
      setDrawing(null);
      setNote(`Saved ${result.venue.name}. Tap any court you didn't book.`);
    });
  }

  function forget() {
    const id = drawing?.id;
    if (!id) return;
    startBusy(async () => {
      const result = await deleteVenueAction(id);
      if (!result.ok) {
        setNote(result.problem);
        return;
      }
      onVenues(venues.filter((each) => each.id !== id), "");
      setNote(`Forgot ${drawing.name}. DDDs already set up there keep their courts.`);
      setDrawing(null);
    });
  }

  return (
    <fieldset className="ddd-venue">
      <legend>Play venue and courts</legend>
      {drawing ? (
        <div className="ddd-stack">
          <p className="ddd-note">
            Tap a square to add a court. Tap a court to change its number or remove it.
          </p>
          <div className="ddd-chips" role="group" aria-label="Start from a shape">
            {PRESETS.map((preset) => (
              <button key={preset.id} type="button" className="ddd-chip" onClick={() => setDrawing({ ...drawing, grid: preset.grid() })}>
                {preset.label}
              </button>
            ))}
          </div>
          <CourtGrid
            grid={drawing.grid}
            mode="draw"
            booked={allCourts(drawing.grid)}
            onGridChange={(grid) => {
              setDrawing({ ...drawing, grid });
              setNote("");
            }}
            onBookedChange={() => {}}
            label="Draw the venue"
          />
          <div className="ddd-field">
            <label htmlFor="ddd-venue-name">Venue name</label>
            <input
              id="ddd-venue-name"
              value={drawing.name}
              maxLength={MAX_VENUE_NAME}
              autoComplete="off"
              onChange={(e) => setDrawing({ ...drawing, name: e.target.value })}
              onKeyDown={(e) => {
                // Enter here saves the venue, not the whole DDD.
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
            />
          </div>
          <div className="ddd-actions">
            <button type="button" className="ddd-btn ddd-btn-ghost" disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save venue"}
            </button>
            {venues.length > 0 ? (
              <button type="button" className="ddd-quiet" onClick={() => setDrawing(null)}>
                Cancel
              </button>
            ) : null}
            {drawing.id ? (
              <button type="button" className="ddd-quiet ddd-push" disabled={busy} onClick={forget}>
                Forget this venue
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="ddd-stack">
          <div className="ddd-row">
            <div className="ddd-field">
              <label htmlFor="ddd-venue">Venue</label>
              <select id="ddd-venue" value={venueId} onChange={(e) => onPick(e.target.value)}>
                <option value="">Pick a venue</option>
                {venues.map((each) => (
                  <option key={each.id} value={each.id}>
                    {each.name}
                  </option>
                ))}
              </select>
            </div>
            {venue ? (
              <button type="button" className="ddd-quiet" onClick={() => setDrawing({ id: venue.id, name: venue.name, grid: venue.grid })}>
                Edit this venue
              </button>
            ) : null}
            <button type="button" className="ddd-quiet" onClick={() => setDrawing({ name: "", grid: EMPTY_GRID })}>
              Draw a new venue
            </button>
          </div>
          {venue ? (
            <>
              <p className="ddd-note">Tap a court you didn&rsquo;t book to leave it out.</p>
              <CourtGrid grid={venue.grid} mode="book" booked={booked} onGridChange={() => {}} onBookedChange={onBooked} label="Courts booked" />
              <p className="ddd-courts-line">
                {courts.length === 0 ? "No courts booked yet." : `Booked: ${courts.length === 1 ? "court" : "courts"} ${courts.join(", ")}`}
              </p>
            </>
          ) : null}
        </div>
      )}
      <p role="status" className="ddd-note empty:hidden">
        {note}
      </p>
    </fieldset>
  );
}
