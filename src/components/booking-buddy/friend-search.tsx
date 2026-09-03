"use client";

import { useActionState, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersonName } from "@/components/booking-buddy/connection-list";
import { ActionError } from "@/components/booking-buddy/action-error";
import {
  searchUsers,
  sendConnectionRequest,
  type ActionResult,
  type UserSearchResult,
} from "@/lib/booking-buddy/actions/connections";

const EMPTY: ActionResult = {};

/** Matches the floor in `search_users` — one character must not list everyone. */
const MIN_QUERY_LENGTH = 3;

const DEBOUNCE_MS = 300;

export function FriendSearch() {
  const [term, setTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  const search = useQuery({
    queryKey: ["booking-buddy", "user-search", debouncedTerm],
    queryFn: () => searchUsers(debouncedTerm),
    enabled: debouncedTerm.length >= MIN_QUERY_LENGTH,
    // Overrides the section default: a result carries the Connection status,
    // which a request sent from this very list changes. Cheap to re-ask.
    staleTime: 0,
  });

  const tooShort = debouncedTerm.length < MIN_QUERY_LENGTH;
  const results = search.data ?? [];

  return (
    <section>
      <h2 className="bb-h text-[1.05rem]">Find a friend</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Search by name, or by their exact username or email. Booking Buddy
        isn&apos;t a browsable directory, so you need one of those to find
        someone.
      </p>

      {/* No form: results stream in as you type, and there is nothing to
          submit. Search itself is a read, so it never needs a POST. */}
      <div className="mt-4 flex flex-col gap-1.5">
        <Label htmlFor="friend-search" className="sr-only">
          Search for someone
        </Label>
        <Input
          id="friend-search"
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Name, username or email"
          autoComplete="off"
        />
      </div>

      <div className="mt-4" aria-live="polite">
        {term.trim().length > 0 && tooShort && (
          <p className="text-sm text-muted-foreground">
            Keep typing. At least {MIN_QUERY_LENGTH} characters.
          </p>
        )}

        {!tooShort && search.isPending && (
          <p className="text-sm text-muted-foreground">Searching…</p>
        )}

        {/* Distinct from the empty result below on purpose. These used to look
            identical, which is how a search that was failing outright read as
            "nobody matches that". */}
        {!tooShort && search.isError && (
          <div className="flex items-center gap-3" role="alert">
            <p className="text-sm text-destructive">
              Search isn&apos;t working right now.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => search.refetch()}
            >
              Try again
            </Button>
          </div>
        )}

        {!tooShort && search.isSuccess && results.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nobody matches that. Ask them for their username. Searching part of
            an email or handle won&apos;t find them.
          </p>
        )}

        {results.length > 0 && (
          <ul className="divide-y divide-[var(--bb-rule)] overflow-hidden rounded-sm border border-[var(--bb-rule)]">
            {results.map((result) => (
              <li
                key={result.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <PersonName
                  person={{
                    displayName: result.display_name,
                    username: result.username,
                  }}
                />
                <SearchResultAction result={result} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SearchResultAction({ result }: { result: UserSearchResult }) {
  const [state, formAction, pending] = useActionState(
    sendConnectionRequest,
    EMPTY,
  );

  if (result.connection_status === "accepted") {
    return <p className="shrink-0 text-sm text-muted-foreground">Friends</p>;
  }

  if (state.ok) {
    return (
      <p className="shrink-0 text-sm text-muted-foreground">Request sent</p>
    );
  }

  // Deliberately direction-neutral: search doesn't say who asked whom, and if
  // it was them, the answer buttons are in "Requests for you" below.
  if (result.connection_status === "pending") {
    return (
      <p className="shrink-0 text-sm text-muted-foreground">Request pending</p>
    );
  }

  return (
    <form
      action={formAction}
      className="flex shrink-0 flex-col items-end gap-1"
    >
      <input type="hidden" name="addressee_id" value={result.id} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Sending…" : "Add friend"}
      </Button>
      <ActionError state={state} />
    </form>
  );
}
