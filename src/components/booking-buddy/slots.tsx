"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormSelect } from "@/components/booking-buddy/visibility-select";
import { OptionalOrgSelect } from "@/components/booking-buddy/org-select";
import { BookingDetailsModal } from "@/components/booking-buddy/bookings";
import {
  DurationPicker,
  useDurationInput,
} from "@/components/booking-buddy/duration-picker";
import {
  DEFAULT_DURATION_HOURS,
  HOUR_TIMES,
  formatCourtLabel,
  formatTimeLabel,
} from "@/lib/booking-buddy/bookings";
import { ORGS_PATH } from "@/lib/booking-buddy/routes";
import type { Org } from "@/lib/booking-buddy/actions/orgs";
import {
  BOOKING_FORMAT_LABEL,
  MAX_ROTATION_BUFFER,
  computeGenderedCapacity,
  isGenderBucketOverCapacity,
  isOverCapacity,
} from "@/lib/booking-buddy/capacity";
import { SpotsMeter } from "@/components/booking-buddy/spots-meter";
import { ActionError } from "@/components/booking-buddy/action-error";
import {
  DEFAULT_DIVISION,
  DIVISIONS,
  DIVISION_LABEL,
} from "@/lib/booking-buddy/division";
import { NOTES_MAX_LENGTH } from "@/lib/booking-buddy/slots";
import { GENDER_LABEL } from "@/lib/booking-buddy/gender";
import type { ResponseAnswer } from "@/lib/booking-buddy/responses";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import {
  attachBookingToSlot,
  createSlot,
  deleteSlot,
  detachBookingFromSlot,
  getSlotResponses,
  setRotationBuffer,
  setSlotNotes,
  type CreateSlotResult,
  type Slot,
  type SlotCapacity,
  type SlotResponse,
  type SlotResponses,
} from "@/lib/booking-buddy/actions/slots";
import { respondToSlot } from "@/lib/booking-buddy/actions/responses";

const EMPTY: ActionResult = {};

function HourTimeSelect({
  id,
  name,
  ...props
}: { id: string; name: string } & Omit<
  React.ComponentProps<"select">,
  "id" | "name" | "children"
>) {
  return (
    <FormSelect id={id} name={name} required {...props}>
      {HOUR_TIMES.map((time) => (
        <option key={time} value={time}>
          {formatTimeLabel(time)}
        </option>
      ))}
    </FormSelect>
  );
}

const DEFAULT_START_TIME = "20:00";

/**
 * The Duration to seed from a deep link's start/end pair — the span between
 * them, but only when both are on the hour and it's a sensible single-game
 * length (1–3 hours). Anything else (a long or all-day free window, a missing
 * or malformed end) keeps the form's own default.
 */
function initialDurationHours(
  startTime: string,
  endTime: string | undefined,
): number {
  if (
    !endTime ||
    !HOUR_TIMES.includes(startTime) ||
    !HOUR_TIMES.includes(endTime)
  ) {
    return DEFAULT_DURATION_HOURS;
  }
  const hours =
    (Number(endTime.slice(0, 2)) - Number(startTime.slice(0, 2)) + 24) % 24 ||
    24;
  return hours >= 1 && hours <= 3 ? hours : DEFAULT_DURATION_HOURS;
}

export function CreateSlotForm({
  orgs,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  onPosted,
}: {
  orgs: Org[];
  /** Pre-fills the date field — the onboarding "coordinate" branch seeds next Monday (#176); "Find a time" seeds a free day (#195). */
  defaultDate?: string;
  /** Pre-fills the start time — "Find a time" (#195) seeds the start of a free window. Ignored unless it's an on-the-hour `"HH:00"`. */
  defaultStartTime?: string;
  /** Pre-fills the Duration to match a free window's length (#272). Ignored unless it's an on-the-hour `"HH:00"` 1–3 hours past the start. */
  defaultEndTime?: string;
  /** Called with the new Slot's id once it actually posts — e.g. to move the onboarding modal to its share step. */
  onPosted?: (slotId: string) => void;
}) {
  const [state, formAction, pending] = useActionState<
    CreateSlotResult,
    FormData
  >(createSlot, EMPTY);
  const defaultOrgId = orgs.find((org) => org.isDefault)?.id ?? "";

  // Start and Duration are controlled — the End field is computed from them
  // rather than picked, same as the Booking form's own duration picker.
  const initialStartTime =
    defaultStartTime && HOUR_TIMES.includes(defaultStartTime)
      ? defaultStartTime
      : DEFAULT_START_TIME;
  const duration = useDurationInput(
    initialStartTime,
    initialDurationHours(initialStartTime, defaultEndTime),
  );

  useEffect(() => {
    if (state.ok && state.slotId) {
      onPosted?.(state.slotId);
    }
  }, [state, onPosted]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="slot-date">Date</Label>
          <Input
            id="slot-date"
            name="date"
            type="date"
            defaultValue={defaultDate}
            required
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="slot-start">Start</Label>
          <HourTimeSelect
            id="slot-start"
            name="start_time"
            value={duration.startTime}
            onChange={(event) => duration.setStartTime(event.target.value)}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
          <Label>Duration</Label>
          <DurationPicker
            value={duration.durationChoice}
            onChange={duration.setDurationChoice}
          />
          {duration.durationChoice === "custom" && (
            <div className="flex items-center gap-2 pt-0.5">
              <Input
                id="slot-duration-custom"
                aria-label="Custom duration in hours"
                type="number"
                inputMode="numeric"
                min={1}
                max={23}
                step={1}
                placeholder="Hours"
                value={duration.customHours}
                onChange={(event) =>
                  duration.setCustomHours(event.target.value)
                }
                className="w-20"
              />
              <span className="text-xs text-muted-foreground">hours</span>
            </div>
          )}
          {duration.durationOverflows && (
            <p className="text-xs text-destructive" role="alert">
              That&apos;s more than a full day. Pick a shorter duration.
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="slot-end">End</Label>
          <Input
            id="slot-end"
            value={duration.endTime ? formatTimeLabel(duration.endTime) : "—"}
            disabled
            readOnly
          />
          {duration.endCrossesMidnight && (
            <p className="text-xs text-muted-foreground">Next day</p>
          )}
          <input type="hidden" name="end_time" value={duration.endTime ?? ""} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="slot-division">Division</Label>
          <FormSelect
            id="slot-division"
            name="division"
            defaultValue={DEFAULT_DIVISION}
          >
            {DIVISIONS.map((division) => (
              <option key={division} value={division}>
                {DIVISION_LABEL[division]}
              </option>
            ))}
          </FormSelect>
        </div>

        {orgs.length > 0 && (
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="slot-org">Facility</Label>
            <OptionalOrgSelect
              id="slot-org"
              orgs={orgs}
              defaultValue={defaultOrgId}
            />
          </div>
        )}
      </div>

      {orgs.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add a{" "}
          <Link href={ORGS_PATH} className="underline underline-offset-4">
            facility
          </Link>{" "}
          to say where this game would be, or post it without one.
        </p>
      )}

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="slot-notes">Notes (optional)</Label>
        <Textarea
          id="slot-notes"
          name="notes"
          placeholder="Need 2 more players, bring your own paddle…"
          maxLength={NOTES_MAX_LENGTH}
        />
      </div>

      <div className="flex flex-col items-end gap-1">
        <Button type="submit" disabled={pending || duration.endTime === null}>
          {pending ? "Posting…" : "Post game"}
        </Button>
        <ActionError state={state} />
      </div>
    </form>
  );
}

/**
 * Whether a Slot is still a bare proposal or has a court behind it — the same
 * distinction the Capacity panel spells out in prose, as a glanceable chip.
 */
export function SlotStatusBadge({ courtCount }: { courtCount: number }) {
  const booked = courtCount > 0;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 font-bb-sign text-[0.66rem] tracking-[0.1em] text-muted-foreground uppercase">
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{
          backgroundColor: booked ? "var(--bb-pin-in)" : "var(--bb-pin-maybe)",
          boxShadow: "inset 0 -1px 1px rgba(0,0,0,.3)",
        }}
      />
      {booked ? "Court booked" : "Gathering"}
    </span>
  );
}

export function SlotRow({ slot, href }: { slot: Slot; href: string }) {
  return (
    <li>
      <Link
        href={href}
        className="group/row block px-5 py-4 transition-colors hover:bg-muted/60 active:bg-muted"
      >
        <div className="flex items-start justify-between gap-3 transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/row:translate-x-0.5 motion-reduce:transform-none">
          <p
            className="font-medium"
            style={{ viewTransitionName: `bb-slot-title-${slot.id}` }}
          >
            {slot.when}
            {slot.facilityLabel && ` · ${slot.facilityLabel}`}
          </p>
          <SlotStatusBadge courtCount={slot.courtCount} />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Proposed by {slot.ownerName}
        </p>
      </Link>
    </li>
  );
}

const ANSWER_LABEL: Record<ResponseAnswer, string> = {
  yes: "Yes",
  no: "No",
  maybe: "Maybe",
};

const ANSWERS: readonly ResponseAnswer[] = ["yes", "no", "maybe"];

/**
 * The Responses query, shared by the buttons and the Capacity panel.
 *
 * One key, so the optimistic "yes" that `ResponseButtons` writes into the
 * cache moves the over-capacity signal at the same moment — the count and the
 * thing it's counted against can't disagree if they read the same cache entry.
 */
function slotResponsesQuery(slotId: string, initial: SlotResponses) {
  return {
    queryKey: ["booking-buddy", "slot", slotId, "responses"],
    queryFn: () => getSlotResponses(slotId),
    initialData: initial,
  };
}

function answerFormData(slotId: string, answer: ResponseAnswer): FormData {
  const data = new FormData();
  data.set("slot_id", slotId);
  data.set("answer", answer);
  return data;
}

/**
 * Optimistically applies one Response, replacing the responder's earlier one
 * if they had one.
 *
 * `gender` is always `null` here, same as `displayName` above — this control
 * isn't handed the viewer's own Gender, so a gendered Capacity breakdown
 * shows the optimistic "yes" as unspecified until `onSettled`'s refetch
 * brings back the real value. Never miscounted, just briefly uncategorized.
 */
function withResponse(
  current: SlotResponses,
  slotId: string,
  viewerId: string,
  viewerName: string | null,
  answer: ResponseAnswer,
): SlotResponses {
  const mine: SlotResponse = {
    id: viewerId,
    userId: viewerId,
    displayName: viewerName,
    answer,
    gender: null,
  };
  return {
    myAnswer: answer,
    responses: [
      ...current.responses.filter((response) => response.userId !== viewerId),
      mine,
    ],
  };
}

/**
 * Yes/no/maybe on a Slot, with an optimistic update — the one interaction in
 * Booking Buddy where TanStack Query earns its place outside search (see
 * CLAUDE.md). Tapping a button flips its own highlighted state immediately,
 * before `respondToSlot`'s round trip resolves; a failure rolls it back and
 * surfaces the error text instead.
 *
 * Deliberately not a `<form action>` like every other Booking Buddy control:
 * the optimistic state this needs to manage lives in the query cache, not in
 * form state a plain submit could drive. That means this one control needs
 * JavaScript to work, unlike its neighbors.
 */
export function ResponseButtons({
  slotId,
  viewerId,
  viewerName,
  initial,
}: {
  slotId: string;
  viewerId: string;
  viewerName: string | null;
  initial: SlotResponses;
}) {
  const queryClient = useQueryClient();
  const { queryKey } = slotResponsesQuery(slotId, initial);

  const query = useQuery(slotResponsesQuery(slotId, initial));

  // A one-shot scale settle on the button just tapped — cleared on
  // animationend so tapping the same answer twice replays it. Purely
  // confirmatory; the highlighted state is what actually communicates.
  const [pressed, setPressed] = useState<ResponseAnswer | null>(null);

  const mutation = useMutation({
    mutationFn: async (answer: ResponseAnswer) => {
      const result = await respondToSlot(EMPTY, answerFormData(slotId, answer));
      if (result.error) {
        throw new Error(result.error);
      }
      return answer;
    },
    onMutate: async (answer) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SlotResponses>(queryKey);
      queryClient.setQueryData<SlotResponses>(queryKey, (current) =>
        withResponse(current ?? initial, slotId, viewerId, viewerName, answer),
      );
      return { previous };
    },
    onError: (_error, _answer, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const myAnswer = mutation.isPending
    ? (mutation.variables ?? query.data.myAnswer)
    : query.data.myAnswer;

  return (
    <div>
      <div className="flex gap-2" role="group" aria-label="Your response">
        {ANSWERS.map((answer) => (
          <Button
            key={answer}
            type="button"
            size="sm"
            variant={myAnswer === answer ? "default" : "outline"}
            aria-pressed={myAnswer === answer}
            disabled={mutation.isPending}
            className={
              pressed === answer
                ? answer === "yes"
                  ? "bb-yes"
                  : "bb-press"
                : undefined
            }
            onClick={() => {
              setPressed(answer);
              mutation.mutate(answer);
            }}
            onAnimationEnd={() => setPressed((c) => (c === answer ? null : c))}
          >
            {ANSWER_LABEL[answer]}
          </Button>
        ))}
      </div>
      {mutation.isError && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Couldn't save that response."}
        </p>
      )}

      <ul className="mt-4 divide-y divide-border/60 overflow-hidden rounded-lg bg-muted/30">
        {query.data.responses.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted-foreground">
            Nobody has responded yet.
          </li>
        )}
        {query.data.responses.map((response) => (
          <li
            key={response.id}
            className="bb-anim-in flex items-center justify-between gap-4 px-4 py-3 text-sm"
          >
            <span>
              {response.userId === viewerId
                ? "You"
                : (response.displayName ?? "A friend")}
            </span>
            {response.answer === "yes" ? (
              <span className="inline-flex items-center gap-1 font-medium text-primary">
                <CheckIcon className="size-3.5" aria-hidden="true" />
                Yes
              </span>
            ) : (
              <span className="text-muted-foreground">
                {ANSWER_LABEL[response.answer]}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function courtsLabel(courtCount: number): string {
  return courtCount === 1 ? "1 court" : `${courtCount} courts`;
}

/**
 * Shown beside the count once a Slot's "yes" Responses reach Capacity (but not
 * past it — over-capacity keeps its own amber note). `bb-anim-in` gives it a
 * short settle on the render it first appears, i.e. the "yes" that filled it.
 */
function FullPill() {
  return (
    <span className="bb-anim-in inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
      Full court
    </span>
  );
}

/**
 * What this Slot holds, and whether it's overflowing.
 *
 * Reads the same Responses cache entry `ResponseButtons` writes to, so the
 * count moves with an optimistic answer instead of waiting for the page to be
 * re-rendered on the server.
 *
 * The over-capacity line is the organizer's alone — it's a prompt to book
 * another court, which nobody else can act on — but the Capacity itself is
 * shown to everyone who can see the Slot, so "is there still room" is a
 * question a friend can answer without asking.
 */
export function SlotCapacityPanel({
  slotId,
  isOwner,
  capacity,
  initial,
}: {
  slotId: string;
  isOwner: boolean;
  capacity: SlotCapacity;
  initial: SlotResponses;
}) {
  const query = useQuery(slotResponsesQuery(slotId, initial));
  const yesResponses = query.data.responses.filter(
    (response) => response.answer === "yes",
  );
  const yesCount = yesResponses.length;

  if (capacity.capacity === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {yesCount} in so far. No court attached yet, so there&apos;s no capacity
        to fill. This is still a proposal.
      </p>
    );
  }

  const gendered = computeGenderedCapacity({
    division: capacity.division,
    capacity: capacity.capacity,
    yesGenders: yesResponses.map((response) => response.gender),
  });

  if (gendered) {
    const overBuckets = gendered.buckets.filter(isGenderBucketOverCapacity);

    return (
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col gap-3">
          {gendered.buckets.map((bucket) => {
            const bucketFull =
              bucket.yes >= bucket.capacity &&
              !isGenderBucketOverCapacity(bucket);
            return (
              <li key={bucket.gender} className="flex flex-col gap-2">
                <SpotsMeter filled={bucket.yes} capacity={bucket.capacity} />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium">
                    {GENDER_LABEL[bucket.gender]}: {bucket.yes} of{" "}
                    {bucket.capacity} spots taken
                  </span>
                  {bucketFull && <FullPill />}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          {courtsLabel(capacity.courtCount)}
          {capacity.rotationBuffer > 0 &&
            ` plus ${capacity.rotationBuffer} rotating`}
          {gendered.unspecified > 0 &&
            ` (${gendered.unspecified} more responded yes without a gender set)`}
        </p>

        {overBuckets.length > 0 && isOwner && (
          <p
            className="rounded-lg border border-accent-foreground/25 bg-accent/25 px-4 py-3 text-sm"
            role="status"
          >
            More yeses than spots for{" "}
            {overBuckets
              .map((bucket) => GENDER_LABEL[bucket.gender])
              .join(" and ")}
            . Nobody has been turned away. Book another court and attach it,
            raise the rotation buffer, or leave it as is.
          </p>
        )}
      </div>
    );
  }

  const over = isOverCapacity({ capacity: capacity.capacity, yesCount });
  const full = !over && yesCount >= capacity.capacity;

  return (
    <div className="flex flex-col gap-3">
      <SpotsMeter filled={yesCount} capacity={capacity.capacity} />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium">
          {yesCount} of {capacity.capacity} spots taken
        </span>
        {full && <FullPill />}
      </div>
      <p className="text-xs text-muted-foreground">
        {courtsLabel(capacity.courtCount)}
        {capacity.rotationBuffer > 0 &&
          ` plus ${capacity.rotationBuffer} rotating`}
      </p>

      {over && isOwner && (
        <p
          className="rounded-lg border border-accent-foreground/25 bg-accent/25 px-4 py-3 text-sm"
          role="status"
        >
          More yeses than spots. Nobody has been turned away. Book another court
          and attach it, raise the rotation buffer, or leave it as is.
        </p>
      )}
    </div>
  );
}

/**
 * The organizer's court controls: which Bookings this Slot is built on, and
 * how many extra players rotate through.
 *
 * Rendered for the owner only — a friend has no Bookings of their own to
 * attach here, and `bookings` is owner-only anyway, so there would be nothing
 * to show.
 */
export function SlotCourts({
  slotId,
  capacity,
  orgs,
}: {
  slotId: string;
  capacity: SlotCapacity;
  orgs: Org[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {capacity.attached.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No court attached yet. Attach a booking once you&apos;ve reserved one
          and this becomes a real game with real capacity.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-lg bg-muted/30">
          {capacity.attached.map((booking) => (
            <li
              key={booking.id}
              className="bb-anim-in flex items-center justify-between gap-4 px-5 py-4"
            >
              <BookingDetailsModal
                booking={booking}
                orgs={orgs}
                render={
                  <button type="button" className="min-w-0 flex-1 text-left" />
                }
              >
                <p className="truncate font-medium">
                  {booking.when} · {booking.orgName}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {formatCourtLabel(booking.courtLabel)} ·{" "}
                  {BOOKING_FORMAT_LABEL[booking.format]}
                </p>
              </BookingDetailsModal>
              <DetachBookingButton slotId={slotId} booking={booking} />
            </li>
          ))}
        </ul>
      )}

      <AttachBookingForm slotId={slotId} capacity={capacity} />
      <RotationBufferForm
        slotId={slotId}
        rotationBuffer={capacity.rotationBuffer}
      />
    </div>
  );
}

function AttachBookingForm({
  slotId,
  capacity,
}: {
  slotId: string;
  capacity: SlotCapacity;
}) {
  const [state, formAction, pending] = useActionState(
    attachBookingToSlot,
    EMPTY,
  );

  if (capacity.attachable.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {capacity.attached.length === 0
          ? "You haven't logged any bookings yet. Log one first, then attach it here."
          : "Every booking you've logged is already on this game."}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="slot_id" value={slotId} />

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="attach-booking">Add a court</Label>
        <FormSelect
          id="attach-booking"
          name="booking_id"
          defaultValue=""
          required
        >
          <option value="" disabled>
            Pick a booking
          </option>
          {capacity.attachable.map((booking) => (
            <option key={booking.id} value={booking.id}>
              {booking.when} · {booking.orgName} ·{" "}
              {formatCourtLabel(booking.courtLabel)} ·{" "}
              {BOOKING_FORMAT_LABEL[booking.format]}
            </option>
          ))}
        </FormSelect>
      </div>

      <div className="flex flex-col items-end gap-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Attaching…" : "Attach booking"}
        </Button>
        <ActionError state={state} />
      </div>
    </form>
  );
}

function DetachBookingButton({
  slotId,
  booking,
}: {
  slotId: string;
  booking: SlotCapacity["attached"][number];
}) {
  const [state, formAction, pending] = useActionState(
    detachBookingFromSlot,
    EMPTY,
  );

  // The form lives inside the dialog so the confirm button is the only thing
  // that can submit it — same shape as removing a booking or deleting a slot.
  const form = (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="slot_id" value={slotId} />
      <input type="hidden" name="booking_id" value={booking.id} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Detaching…" : "Detach booking"}
      </Button>
      <ActionError state={state} />
    </form>
  );

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="destructive" />}>
        Detach
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detach this court?</DialogTitle>
          <DialogDescription>
            {booking.when} at {booking.orgName}. This game&apos;s capacity drops
            by one court. Your actual booking stays untouched on your Bookings
            page.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Keep attached
          </DialogClose>
          {form}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RotationBufferForm({
  slotId,
  rotationBuffer,
}: {
  slotId: string;
  rotationBuffer: number;
}) {
  const [state, formAction, pending] = useActionState(setRotationBuffer, EMPTY);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="slot_id" value={slotId} />

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="rotation-buffer">Rotation buffer</Label>
        {/* Keyed on the saved value so a successful save remounts the
            field — see the note on BookingWindowForm in orgs.tsx. */}
        <Input
          key={rotationBuffer}
          id="rotation-buffer"
          name="rotation_buffer"
          type="number"
          min={0}
          max={MAX_ROTATION_BUFFER}
          step={1}
          defaultValue={rotationBuffer}
          className="sm:max-w-32"
        />
        <p className="text-xs text-muted-foreground">
          Extra players on top of what the courts hold, for anyone rotating in
          and out.
        </p>
      </div>

      <div className="flex flex-col items-end gap-1">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save buffer"}
        </Button>
        <ActionError state={state} />
      </div>
    </form>
  );
}

/**
 * Edit a Slot's own notes after it's been posted — the one full-text field
 * editable outside the narrow `rotation_buffer`/`intended_org_id` pattern,
 * since the rest of a Slot's proposal is fixed once posted. Same shape as
 * `RotationBufferForm`, on its own so it can sit outside the owner-only
 * `SlotCourts` section (visible to the owner regardless of whether any court
 * is attached yet).
 */
export function NotesForm({
  slotId,
  notes,
}: {
  slotId: string;
  notes: string | null;
}) {
  const [state, formAction, pending] = useActionState(setSlotNotes, EMPTY);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="slot_id" value={slotId} />

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="slot-detail-notes">Notes</Label>
        {/* Keyed on the saved value so a successful save remounts the field —
            see the note on BookingWindowForm in orgs.tsx. */}
        <Textarea
          key={notes}
          id="slot-detail-notes"
          name="notes"
          defaultValue={notes ?? ""}
          placeholder="Need 2 more players, bring your own paddle…"
          maxLength={NOTES_MAX_LENGTH}
        />
      </div>

      <div className="flex flex-col items-end gap-1">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save notes"}
        </Button>
        <ActionError state={state} />
      </div>
    </form>
  );
}

export function DeleteSlotButton({
  slotId,
  when,
}: {
  slotId: string;
  when: string;
}) {
  const [state, formAction, pending] = useActionState(deleteSlot, EMPTY);

  // The form lives inside the dialog so the confirm button is the only thing
  // that can submit it — the same shape as removing a friend, group, or facility.
  const form = (
    <form
      action={formAction}
      className="flex flex-col items-stretch gap-1 sm:items-end"
    >
      <input type="hidden" name="slot_id" value={slotId} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Deleting…" : "Delete game"}
      </Button>
      <ActionError state={state} />
    </form>
  );

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="destructive" />}>
        Delete game
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this game?</DialogTitle>
          <DialogDescription>
            {when}. Every response, attached court, invite link, and reminder
            for it goes with it, and this can&apos;t be undone. Any Bookings
            attached stay on your Bookings page, untouched.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Keep game
          </DialogClose>
          {form}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
