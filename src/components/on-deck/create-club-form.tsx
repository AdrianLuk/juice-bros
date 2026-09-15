"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClub } from "@/lib/on-deck/actions/sessions";

/**
 * The Organizer's own Club, in two fields (issue #515).
 *
 * What used to sit here was a panel saying On Deck clubs are made by hand and
 * to get in touch. Two questions instead, and neither needs a night to have
 * happened first: what the club is called, and how many courts. The venue
 * starts as the club's name, the group cap and floor mode take their defaults,
 * and the clock comes off this browser on the next load. Settings can correct
 * every one of them.
 *
 * On success the Organizer stays where they are and the page re-renders as
 * their Club, with Start on it.
 */
export function CreateClubForm({ email }: { email?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [courts, setCourts] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createClub({
        name,
        courtCount: Number(courts),
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't create your club. Try again.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-8 rounded-2xl border bg-card p-6">
      <h2 className="font-heading text-xl font-semibold">Set up your club</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Two things and you can start a session tonight. Anything you would
        rather have said differently, including these, is editable in settings.
      </p>
      {/* One account holds one club, and there is no way to hand a club to a
          different account afterwards. So the address it is about to be tied
          to is worth reading before the button, not after. */}
      {email ? (
        <p className="mt-2 text-xs text-muted-foreground">
          The club will belong to{" "}
          <span className="text-foreground">{email}</span>.
        </p>
      ) : null}

      <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="on-deck-club-name">Club name</Label>
          <Input
            id="on-deck-club-name"
            name="name"
            value={name}
            maxLength={120}
            autoComplete="off"
            placeholder="Riverside Pickleball"
            onChange={(event) => setName(event.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            What your players call it. It goes on your sign and on the link
            you share with them.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="on-deck-club-courts">Courts</Label>
          <Input
            id="on-deck-club-courts"
            name="courtCount"
            type="number"
            inputMode="numeric"
            min={1}
            max={40}
            className="w-24"
            value={courts}
            onChange={(event) => setCourts(event.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            How many you play on in a usual week. A one-off night can have its
            own number.
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div>
          <Button type="submit" disabled={pending} className="h-11 px-6">
            {pending ? "Creating…" : "Create the club"}
          </Button>
        </div>
      </form>
    </div>
  );
}
