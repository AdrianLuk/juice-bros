"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/booking-buddy/visibility-select";
import { HALF_HOUR_TIMES, formatTimeLabel } from "@/lib/booking-buddy/bookings";
import {
  BOOKING_FORMAT_LABEL,
  MAX_ROTATION_BUFFER,
  isOverCapacity,
} from "@/lib/booking-buddy/capacity";
import type { ResponseAnswer } from "@/lib/booking-buddy/responses";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import {
  attachBookingToSlot,
  createSlot,
  detachBookingFromSlot,
  getSlotResponses,
  setRotationBuffer,
  type Slot,
  type SlotCapacity,
  type SlotResponse,
  type SlotResponses,
} from "@/lib/booking-buddy/actions/slots";
import { respondToSlot } from "@/lib/booking-buddy/actions/responses";

const EMPTY: ActionResult = {};

function ActionError({ state }: { state: ActionResult }) {
  if (!state.error) {
    return null;
  }

  return (
    <p className="text-xs text-destructive" role="alert">
      {state.error}
    </p>
  );
}

function HalfHourTimeSelect({
  id,
  name,
  defaultValue,
}: {
  id: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <FormSelect id={id} name={name} defaultValue={defaultValue} required>
      {HALF_HOUR_TIMES.map((time) => (
        <option key={time} value={time}>
          {formatTimeLabel(time)}
        </option>
      ))}
    </FormSelect>
  );
}

export function CreateSlotForm() {
  const [state, formAction, pending] = useActionState(createSlot, EMPTY);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="slot-date">Date</Label>
          <Input id="slot-date" name="date" type="date" required />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="slot-start">Start</Label>
          <HalfHourTimeSelect id="slot-start" name="start_time" defaultValue="09:00" />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="slot-end">End</Label>
          <HalfHourTimeSelect id="slot-end" name="end_time" defaultValue="10:30" />
        </div>
      </div>

      <div className="flex flex-col items-start gap-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Posting…" : "Post slot"}
        </Button>
        <ActionError state={state} />
      </div>
    </form>
  );
}

export function SlotRow({
  slot,
  href,
}: {
  slot: Slot;
  href: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="block px-5 py-4 transition-colors hover:bg-muted/60 active:bg-muted"
      >
        <p className="font-medium">{slot.when}</p>
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

/** Optimistically applies one Response, replacing the responder's earlier one if they had one. */
function withResponse(
  current: SlotResponses,
  slotId: string,
  viewerId: string,
  viewerName: string | null,
  answer: ResponseAnswer,
): SlotResponses {
  const mine: SlotResponse = { id: viewerId, userId: viewerId, displayName: viewerName, answer };
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
            onClick={() => mutation.mutate(answer)}
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
            className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
          >
            <span>
              {response.userId === viewerId
                ? "You"
                : (response.displayName ?? "A friend")}
            </span>
            <span className="text-muted-foreground">
              {ANSWER_LABEL[response.answer]}
            </span>
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
  const yesCount = query.data.responses.filter(
    (response) => response.answer === "yes",
  ).length;

  if (capacity.capacity === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {yesCount} in so far. No court attached yet, so there&apos;s no capacity
        to fill — this is still a proposal.
      </p>
    );
  }

  const over = isOverCapacity({ capacity: capacity.capacity, yesCount });

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        <span className="font-medium">
          {yesCount} of {capacity.capacity} spots taken
        </span>
        <span className="text-muted-foreground">
          {" — "}
          {courtsLabel(capacity.courtCount)}
          {capacity.rotationBuffer > 0 &&
            ` plus ${capacity.rotationBuffer} rotating`}
        </span>
      </p>

      {over && isOwner && (
        <p
          className="rounded-lg border border-accent-foreground/25 bg-accent/25 px-4 py-3 text-sm"
          role="status"
        >
          More yeses than spots. Nobody has been turned away — book another
          court and attach it, raise the rotation buffer, or leave it as is.
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
}: {
  slotId: string;
  capacity: SlotCapacity;
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
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{booking.when}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {booking.orgName} · {booking.courtLabel} ·{" "}
                  {BOOKING_FORMAT_LABEL[booking.format]}
                </p>
              </div>
              <DetachBookingButton slotId={slotId} booking={booking} />
            </li>
          ))}
        </ul>
      )}

      <AttachBookingForm slotId={slotId} capacity={capacity} />
      <RotationBufferForm slotId={slotId} rotationBuffer={capacity.rotationBuffer} />
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
  const [state, formAction, pending] = useActionState(attachBookingToSlot, EMPTY);

  if (capacity.attachable.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {capacity.attached.length === 0
          ? "You haven't logged any bookings yet — log one first, then attach it here."
          : "Every booking you've logged is already on this slot."}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="slot_id" value={slotId} />

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="attach-booking">Add a court</Label>
        <FormSelect id="attach-booking" name="booking_id" defaultValue="" required>
          <option value="" disabled>
            Pick a booking
          </option>
          {capacity.attachable.map((booking) => (
            <option key={booking.id} value={booking.id}>
              {booking.when} — {booking.orgName} · {booking.courtLabel} ·{" "}
              {BOOKING_FORMAT_LABEL[booking.format]}
            </option>
          ))}
        </FormSelect>
      </div>

      <div className="flex flex-col items-start gap-1">
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
  const [state, formAction, pending] = useActionState(detachBookingFromSlot, EMPTY);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="slot_id" value={slotId} />
      <input type="hidden" name="booking_id" value={booking.id} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        {pending ? "Detaching…" : "Detach"}
      </Button>
      <ActionError state={state} />
    </form>
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

      <div className="flex flex-col items-start gap-1">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save buffer"}
        </Button>
        <ActionError state={state} />
      </div>
    </form>
  );
}
