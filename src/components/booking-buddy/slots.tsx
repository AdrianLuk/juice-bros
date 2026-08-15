"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/booking-buddy/visibility-select";
import { HALF_HOUR_TIMES, formatTimeLabel } from "@/lib/booking-buddy/bookings";
import type { ResponseAnswer } from "@/lib/booking-buddy/responses";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import {
  createSlot,
  getSlotResponses,
  type Slot,
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
    <p className="text-xs text-red-600" role="alert">
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
    <li className="px-5 py-4">
      <Link href={href} className="block">
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
  const mine: SlotResponse = { userId: viewerId, displayName: viewerName, answer };
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
  const queryKey = ["booking-buddy", "slot", slotId, "responses"];

  const query = useQuery({
    queryKey,
    queryFn: () => getSlotResponses(slotId),
    initialData: initial,
  });

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
        <p className="mt-1 text-xs text-red-600" role="alert">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Couldn't save that response."}
        </p>
      )}

      <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
        {query.data.responses.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted-foreground">
            Nobody has responded yet.
          </li>
        )}
        {query.data.responses.map((response) => (
          <li
            key={response.userId}
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
