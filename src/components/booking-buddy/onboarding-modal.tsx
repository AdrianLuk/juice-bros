"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { track } from "@vercel/analytics";
import {
  CalendarClockIcon,
  ChevronDownIcon,
  ClipboardListIcon,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchPlaceForm } from "@/components/booking-buddy/place-search";
import { CreateOrgForm } from "@/components/booking-buddy/orgs";
import { CalendarFeedHelp } from "@/components/booking-buddy/calendar-feed-help";
import { ActionError } from "@/components/booking-buddy/action-error";
import { CreateBookingForm } from "@/components/booking-buddy/bookings";
import { CreateSlotForm } from "@/components/booking-buddy/slots";
import { GenderForm } from "@/components/booking-buddy/gender-form";
import { FriendSearch } from "@/components/booking-buddy/friend-search";
import { InviteLinkPanel } from "@/components/booking-buddy/invite-link-panel";
import { SlotLinkPanel } from "@/components/booking-buddy/slot-links";
import { setCalendarFeedUrl } from "@/lib/booking-buddy/actions/calendar-feed";
import { bookingsSyncHref, slotPath } from "@/lib/booking-buddy/routes";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import type { Org } from "@/lib/booking-buddy/actions/orgs";
import type { Gender } from "@/lib/booking-buddy/gender";

/** The intent choice is modal-local (#176) — never persisted server-side. */
type Intent = "track" | "coordinate";

/** Empty `useActionState` seed, same as every other form in the section. */
const EMPTY_ACTION: ActionResult = {};

const SNOOZE_KEY = "bb-onboarding-snoozed-until";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whether a recent dismissal is still suppressing the modal. Read only from
 * an effect, never during render — reading `localStorage` while rendering
 * hydrates markup that doesn't match the server's (see
 * `src/components/apps/pickle-point-pal/hooks/use-ref-flipped.ts`).
 */
function isSnoozed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const until = Number(window.localStorage.getItem(SNOOZE_KEY));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function snooze(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
  } catch {
    // Storage disabled or full — the modal simply reappears on the next
    // dashboard load, a weaker version of the same nudge, not a broken state.
  }
}

/**
 * The first Monday strictly after today, in the visitor's own time zone, as
 * `YYYY-MM-DD` — the "coordinate" branch pre-fills the Slot date with it
 * (#176). A bare-proposal Slot carries no facility, so it has no other clock
 * to reckon against; the browser's is the only one available and every early
 * User is on it anyway.
 */
function nextMondayDate(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // getDay(): 0 = Sunday … 1 = Monday. `|| 7` turns "today is Monday" into
  // the Monday a week out rather than today.
  const daysAhead = (1 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + daysAhead);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * The post-signup onboarding modal (issue #103), branched on intent (#176).
 *
 * Shown on the dashboard while the signed-in User has **no Booking and no
 * Slot** — the point before which they've gotten nothing back from the app.
 * Not a hard gate: dismissible at any step, and a dismissal snoozes it for a
 * week (localStorage) so it nudges without nagging. It stops for good the
 * moment a Booking or Slot exists — a booking-only User who never wants Slots
 * isn't chased about facilities forever.
 *
 * One modal, one branch on a modal-local intent choice:
 *  - "track": add a first Facility, then bring that facility's reservations
 *    over. A CourtReserve calendar feed leads (issue #471) — one pasted link
 *    against typing a booking in, and it keeps paying afterwards — with
 *    hand-logging offered plainly underneath for the community-centre gyms and
 *    private courts CourtReserve doesn't run.
 *  - "coordinate": post a Slot (pre-filled to next Monday 8-10pm, no facility
 *    needed), then share it. Gender lives here only (ADR 0012) — where a
 *    gender-aware Slot division is the reason to ask.
 *
 * Every step past the choice keeps a "add the people you play with" footer:
 * the friend graph is the one universal onboarding goal.
 *
 * `orgs` updates live as Facilities are added (the create actions revalidate
 * this route), which is what advances the "track" branch from its Facility
 * step to its Booking step without a reload.
 */
export function OnboardingModal({
  orgs,
  gender,
  inviteUrl,
  hasBooking,
  hasSlot,
}: {
  orgs: Org[];
  gender: Gender | null;
  /** The caller's own personal invite link (#175), for the friend footer. Null when the modal can't open anyway. */
  inviteUrl: string | null;
  hasBooking: boolean;
  hasSlot: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [bookingLogged, setBookingLogged] = useState(false);
  const [postedSlotId, setPostedSlotId] = useState<string | null>(null);
  // The track branch's two local choices: which Facility a feed was just saved
  // against (the action revalidates Facilities and Bookings, not this route, so
  // `orgs` here won't hear about it) and "I'll type it in instead".
  const [connectedOrgId, setConnectedOrgId] = useState<string | null>(null);
  const [byHand, setByHand] = useState(false);

  useEffect(() => {
    if (!hasBooking && !hasSlot && !isSnoozed()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of an external store (localStorage) on mount, same pattern as useRefFlipped
      setOpen(true);
    }
  }, [hasBooking, hasSlot]);

  function dismiss() {
    snooze();
    setOpen(false);
  }

  function chooseIntent(next: Intent) {
    setIntent(next);
    // bb_onboarding_intent (#179's deferred event) — client-side, like
    // gear-card.tsx's gear_click: a browser choice with no server check.
    track("bb_onboarding_intent", { intent: next });
  }

  // A key that changes once per visible step, so the wrapper below remounts
  // and its `bb-anim-in` entrance replays as the modal walks its branch —
  // choose → (facility →) booking → done, or post → share.
  const stepKey = [
    intent ?? "choose",
    bookingLogged ? "logged" : "",
    postedSlotId ? "shared" : "",
    orgs.length === 0 ? "no-facility" : "",
    connectedOrgId ? "feed" : "",
    byHand ? "by-hand" : "",
  ].join(":");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : dismiss())}
    >
      <DialogContent className="bb-theme sm:max-w-lg">
        <div key={stepKey} className="bb-anim-in flex flex-col gap-4">
          {intent === null && <IntentChoice onChoose={chooseIntent} />}

          {intent === "track" && (
            <TrackBranch
              orgs={orgs}
              bookingLogged={bookingLogged}
              onBookingLogged={() => setBookingLogged(true)}
              onDone={() => setOpen(false)}
              connectedOrgId={connectedOrgId}
              onFeedConnected={setConnectedOrgId}
              byHand={byHand}
              onByHand={setByHand}
            />
          )}

          {intent === "coordinate" && (
            <CoordinateBranch
              orgs={orgs}
              gender={gender}
              postedSlotId={postedSlotId}
              onPosted={setPostedSlotId}
            />
          )}

          {intent !== null && <FriendFooter inviteUrl={inviteUrl} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IntentChoice({ onChoose }: { onChoose: (intent: Intent) => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>What do you want to start with?</DialogTitle>
        <DialogDescription>
          You can do both. This just sets up the first thing. Skippable, and you
          can always come back to it from your dashboard.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChoose("track")}
          className="flex flex-col items-start gap-2 rounded-xl border border-border p-4 text-left transition-colors hover:border-brand-orange/40 hover:bg-muted"
        >
          <ClipboardListIcon className="size-5 text-brand-orange" />
          <span className="font-bb-body font-semibold">
            Track my court bookings
          </span>
          <span className="text-xs text-muted-foreground">
            Keep your reservations in one place, on a calendar.
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChoose("coordinate")}
          className="flex flex-col items-start gap-2 rounded-xl border border-border p-4 text-left transition-colors hover:border-brand-orange/40 hover:bg-muted"
        >
          <CalendarClockIcon className="size-5 text-brand-orange" />
          <span className="font-bb-body font-semibold">
            Get my group on a time
          </span>
          <span className="text-xs text-muted-foreground">
            Post a time and let friends reply yes, no, or maybe.
          </span>
        </button>
      </div>
    </>
  );
}

/**
 * "Track my court bookings": add a Facility, then get that facility's
 * reservations into Booking Buddy.
 *
 * The step order is the point (issue #471). Hand-logging was the only import
 * path when this modal was built; a CourtReserve calendar feed (#294, ADR-0019)
 * now brings every reservation at a facility over from one pasted link, and
 * "Sync bookings" (#336) reviews them. So the feed leads and hand-logging is
 * the plainly-offered alternative, not the other way round — with a way back
 * to the feed from the hand path, since "not a CourtReserve club" is a guess
 * the User makes before they've looked.
 *
 * The steps, in the order they're checked:
 *   1. a Booking was just logged by hand → the confirmation
 *   2. no Facility yet → add one
 *   3. "log by hand" was chosen → the Booking form
 *   4. a feed is configured (just now, or already) → the handoff to the review
 *   5. otherwise → the feed offer
 */
function TrackBranch({
  orgs,
  bookingLogged,
  onBookingLogged,
  onDone,
  connectedOrgId,
  onFeedConnected,
  byHand,
  onByHand,
}: {
  orgs: Org[];
  bookingLogged: boolean;
  onBookingLogged: () => void;
  onDone: () => void;
  /** The Org a feed was saved against this run — `orgs` doesn't hear about it, so this does. */
  connectedOrgId: string | null;
  onFeedConnected: (orgId: string) => void;
  byHand: boolean;
  onByHand: (next: boolean) => void;
}) {
  if (bookingLogged) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>It&apos;s on your calendar</DialogTitle>
          <DialogDescription>
            Your first booking is logged. Add more any time from the Bookings
            page, or turn one into a game your friends can join.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button type="button" onClick={onDone}>
            Done
          </Button>
        </div>
      </>
    );
  }

  if (orgs.length === 0) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Add where you play</DialogTitle>
          <DialogDescription>
            Search for a place, or type it by hand if Google doesn&apos;t have
            it. Community-centre gyms and private courts usually aren&apos;t
            listed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <SearchPlaceForm />
          <div className="border-t border-border pt-6">
            <p className="mb-3 text-sm font-medium">
              Not on Google? Add it by hand
            </p>
            <CreateOrgForm />
          </div>
        </div>
      </>
    );
  }

  // Which facility each step is about. The modal is a live "no Booking and no
  // Slot" check, so it resurfaces for long-standing accounts too — a User can
  // reach here with several Facilities, only some of them feed-configured.
  // Naming the default one regardless would say "your feed is connected" over
  // the name of a Facility that hasn't got one, so the subject comes off the
  // feed state instead: the feed-bearing Facility on the confirmation, one
  // still missing a feed on the offer. `listOrgs` is newest first, so on the
  // ordinary first run both resolve to the Facility just added.
  const fedFacility =
    orgs.find((org) => org.id === connectedOrgId) ??
    orgs.find((org) => org.hasCalendarFeed) ??
    orgs[0];
  const unfedFacility =
    orgs.find((org) => !org.hasCalendarFeed && org.id !== connectedOrgId) ??
    orgs[0];
  const hasFeed =
    connectedOrgId !== null || orgs.some((org) => org.hasCalendarFeed);

  if (byHand) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Log your first booking</DialogTitle>
          <DialogDescription>
            A booking mirrors a reservation you&apos;ve already made on the
            facility&apos;s own site. It shows up on your dashboard calendar.
          </DialogDescription>
        </DialogHeader>
        <CreateBookingForm orgs={orgs} onLogged={onBookingLogged} />
        {!hasFeed && (
          <p className="text-sm text-muted-foreground">
            Book at a CourtReserve club after all?{" "}
            <button
              type="button"
              onClick={() => onByHand(false)}
              className="underline underline-offset-4 hover:text-foreground"
            >
              Paste your calendar feed instead
            </button>
          </p>
        )}
      </>
    );
  }

  if (hasFeed) {
    return (
      <FeedConnectedStep
        facility={fedFacility}
        onByHand={() => onByHand(true)}
      />
    );
  }

  return (
    <CalendarFeedStep
      facility={unfedFacility}
      onConnected={onFeedConnected}
      onByHand={() => onByHand(true)}
    />
  );
}

/**
 * The feed offer: paste the CourtReserve calendar-feed link for the facility
 * just added. One orange commit action per the board world's status law, with
 * the hand-logging alternative below the rule so it stays a real option rather
 * than a hidden one.
 *
 * `setCalendarFeedUrl` validates the URL server-side (https only, a
 * CourtReserve host) and never echoes it back — its token is private — so the
 * only thing this step reads off the result is whether it saved.
 */
function CalendarFeedStep({
  facility,
  onConnected,
  onByHand,
}: {
  facility: Org | undefined;
  onConnected: (orgId: string) => void;
  onByHand: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    setCalendarFeedUrl,
    EMPTY_ACTION,
  );
  const orgId = facility?.id;

  // Advance the branch once the action settles. In an effect, not mid-render:
  // this moves state that belongs to `OnboardingModal`, and React only allows
  // a render-phase update to a component's *own* state. Same shape as
  // `CreateBookingForm`'s `onLogged`.
  useEffect(() => {
    if (state.ok && orgId) {
      onConnected(orgId);
    }
  }, [state, orgId, onConnected]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Bring your bookings over</DialogTitle>
        <DialogDescription>
          If you book {facility ? facility.displayName : "your club"} through
          CourtReserve, it can hand your reservations to Booking Buddy. Paste
          the link once and you won&apos;t type a booking in again.
        </DialogDescription>
      </DialogHeader>

      <form action={formAction} className="flex flex-col gap-3">
        {facility && (
          <input type="hidden" name="org_id" value={facility.id} />
        )}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="onboarding-calendar-feed-url">
              Calendar feed link
            </Label>
            <CalendarFeedHelp />
          </div>
          <Input
            id="onboarding-calendar-feed-url"
            name="feed_url"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://…courtreserve.com/…/calendar-feed"
            required
          />
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <Button type="submit" disabled={pending}>
            {pending ? "Connecting…" : "Connect feed"}
          </Button>
          <ActionError state={state} />
        </div>
      </form>

      <div className="border-t border-border pt-5">
        <p className="text-sm text-muted-foreground">
          Not a CourtReserve club?{" "}
          <button
            type="button"
            onClick={onByHand}
            className="underline underline-offset-4 hover:text-foreground"
          >
            Log a booking by hand
          </button>
        </p>
      </div>
    </>
  );
}

/**
 * The handoff. What just happened is a link being stored: `setCalendarFeedUrl`
 * checks the scheme and the host, and nothing has been fetched yet. So the
 * heading claims only that — "saved", the same word the Facilities form uses —
 * and the reading of it is the next click's job. The reservations on a feed
 * aren't Bookings either until they're reviewed ("Sync bookings" is a review,
 * not the result, issue #464), which is why this hands off to the Bookings
 * page with the sync already running rather than rebuilding the review list in
 * a modal or naming a count it hasn't got.
 *
 * Hand-logging stays reachable from here. Saving a feed creates no Booking, so
 * without it a User whose feed carries nothing upcoming would meet this same
 * one-link screen on every dashboard visit with no way to finish.
 */
function FeedConnectedStep({
  facility,
  onByHand,
}: {
  facility: Org | undefined;
  onByHand: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Your feed is saved</DialogTitle>
        <DialogDescription>
          Booking Buddy reads{" "}
          {facility ? facility.displayName : "your club"}&apos;s feed when you
          sync, and shows you what it found. Nothing lands on your calendar
          until you&apos;ve looked it over and said yes.
        </DialogDescription>
      </DialogHeader>
      <div>
        {/* A navigation, so a real link — `Button` would put `role="button"`
            on the anchor and take the link semantics away. */}
        <Link href={bookingsSyncHref} className={cn(buttonVariants())}>
          See what&apos;s on your feed
        </Link>
      </div>

      <div className="border-t border-border pt-5">
        <p className="text-sm text-muted-foreground">
          Got one the feed won&apos;t know about?{" "}
          <button
            type="button"
            onClick={onByHand}
            className="underline underline-offset-4 hover:text-foreground"
          >
            Log a booking by hand
          </button>
        </p>
      </div>
    </>
  );
}

function CoordinateBranch({
  orgs,
  gender,
  postedSlotId,
  onPosted,
}: {
  orgs: Org[];
  gender: Gender | null;
  postedSlotId: string | null;
  onPosted: (slotId: string) => void;
}) {
  if (postedSlotId) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Send it to your group</DialogTitle>
          <DialogDescription>
            Your time is posted. Share the link with anyone (no account needed
            to reply), and add friends below so it shows up in their feed too.
          </DialogDescription>
        </DialogHeader>

        <SlotLinkPanel slotId={postedSlotId} slotLink={null} />

        <Link
          href={slotPath(postedSlotId)}
          className="text-sm underline underline-offset-4"
        >
          View your game
        </Link>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Post a time</DialogTitle>
        <DialogDescription>
          Like a group-chat poll: friends reply yes, no, or maybe before anyone
          books a court. No facility needed yet.
        </DialogDescription>
      </DialogHeader>

      <CreateSlotForm
        orgs={orgs}
        defaultDate={nextMondayDate()}
        onPosted={onPosted}
      />

      <details className="group overflow-hidden rounded-lg border border-border">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-muted">
          Show men&apos;s / women&apos;s / mixed sign-up counts
          <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border px-4 py-4">
          <GenderForm gender={gender} />
        </div>
      </details>
    </>
  );
}

function FriendFooter({ inviteUrl }: { inviteUrl: string | null }) {
  return (
    <div className="border-t border-border pt-6">
      <p className="text-sm font-medium">Add the people you play with</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Connecting one friend is what unlocks shared availability and game
        invites, the rest of Booking Buddy.
      </p>
      <div className="mt-4">
        <FriendSearch />
      </div>

      {inviteUrl && (
        <div className="mt-6 border-t border-border pt-6">
          <p className="text-sm font-medium">Or send them a link</p>
          <p className="mt-1 text-sm text-muted-foreground">
            For friends who aren&apos;t on Booking Buddy yet.
          </p>
          <div className="mt-4">
            <InviteLinkPanel url={inviteUrl} />
          </div>
        </div>
      )}
    </div>
  );
}
