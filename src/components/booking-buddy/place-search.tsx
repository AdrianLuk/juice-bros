"use client";

import { useActionState } from "react";
import { MapPinIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import {
  pickPlace,
  searchPlaces,
  type PlaceCandidate,
  type PlaceSearchState,
} from "@/lib/booking-buddy/actions/places";

const EMPTY_SEARCH: PlaceSearchState = { query: "", candidates: [] };
const EMPTY_RESULT: ActionResult = {};

/**
 * Required wherever a Place's name or address renders outside a Google
 * map — the search results here, and next to a cached address on the Orgs
 * list (`OrgRow` in `orgs.tsx`). Not optional; it's a term of the API key.
 */
export function PoweredByGoogle() {
  return <p className="text-[11px] text-muted-foreground/70">Powered by Google</p>;
}

/**
 * The Place-backed path: search Google server-side, render candidates, pick
 * one. `CreateOrgForm` (the hand-typed path) stays reachable alongside this —
 * see the orgs page, where it lives in a `<details>` disclosure rather than
 * behind anything JavaScript-dependent.
 */
export function SearchPlaceForm() {
  const [state, formAction, pending] = useActionState(searchPlaces, EMPTY_SEARCH);

  return (
    <div className="flex flex-col gap-4">
      <form
        action={formAction}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="place-query">Search for your facility</Label>
          {/* Keyed on the query so a completed search remounts the field —
              it's uncontrolled (`defaultValue`), which only applies on
              mount, and `state.query` can come back trimmed/normalized from
              the server, different from what's still sitting in the DOM. */}
          <Input
            key={state.query}
            id="place-query"
            name="query"
            type="search"
            defaultValue={state.query}
            placeholder="PicklePlex Downsview"
            required
          />
        </div>
        <div className="flex flex-col items-start gap-1">
          <Button type="submit" disabled={pending}>
            {pending ? "Searching…" : "Search"}
          </Button>
          {state.error && (
            <p className="text-xs text-destructive" role="alert">
              {state.error}
            </p>
          )}
        </div>
      </form>

      {state.candidates.length > 0 && (
        <div className="flex flex-col gap-2">
          <ul className="divide-y divide-border/60 overflow-hidden bb-card">
            {state.candidates.map((candidate) => (
              <PlaceCandidateRow key={candidate.placeId} candidate={candidate} />
            ))}
          </ul>
          <PoweredByGoogle />
        </div>
      )}
    </div>
  );
}

function PlaceCandidateRow({ candidate }: { candidate: PlaceCandidate }) {
  const [state, formAction, pending] = useActionState(pickPlace, EMPTY_RESULT);

  return (
    <li className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-accent/25 text-accent-foreground/70">
          <MapPinIcon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium">{candidate.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {candidate.formattedAddress}
          </p>
        </div>
      </div>
      <form
        action={formAction}
        className="flex shrink-0 flex-col items-start gap-1 sm:items-end"
      >
        <input type="hidden" name="place_id" value={candidate.placeId} />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add this facility"}
        </Button>
        {state.error && (
          <p className="text-xs text-destructive" role="alert">
            {state.error}
          </p>
        )}
      </form>
    </li>
  );
}
