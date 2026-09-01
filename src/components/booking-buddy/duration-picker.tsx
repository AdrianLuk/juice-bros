"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DURATION_PRESET_HOURS, addHoursToTime } from "@/lib/booking-buddy/bookings";
import { crossesMidnight } from "@/lib/booking-buddy/datetime";

/** A duration preset's hour count, or "custom" for a hand-typed one. */
export type DurationChoice = `${(typeof DURATION_PRESET_HOURS)[number]}` | "custom";

/**
 * 1/2/3-hour presets plus a hand-typed custom count — same idea as
 * CourtReserve's own Duration control, so the User picks how long they played
 * (or how long a slot should run) instead of clicking through an End-time
 * dropdown by hand. Shared by the Booking and Slot forms so both compute
 * their End time the same way.
 */
export function DurationPicker({
  value,
  onChange,
}: {
  value: DurationChoice;
  onChange: (choice: DurationChoice) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Duration">
      {DURATION_PRESET_HOURS.map((hours) => {
        const choice = String(hours) as DurationChoice;
        return (
          <Button
            key={hours}
            type="button"
            variant={value === choice ? "default" : "outline"}
            role="radio"
            aria-checked={value === choice}
            onClick={() => onChange(choice)}
          >
            {hours} hour{hours === 1 ? "" : "s"}
          </Button>
        );
      })}
      <Button
        type="button"
        variant={value === "custom" ? "default" : "outline"}
        role="radio"
        aria-checked={value === "custom"}
        onClick={() => onChange("custom")}
      >
        Custom
      </Button>
    </div>
  );
}

/** A duration choice matching `hours` if it's one of the presets, otherwise "custom". */
export function durationChoiceForHours(hours: number): DurationChoice {
  return (DURATION_PRESET_HOURS as readonly number[]).includes(hours)
    ? (String(hours) as DurationChoice)
    : "custom";
}

export interface DurationInput {
  startTime: string;
  setStartTime: (time: string) => void;
  durationChoice: DurationChoice;
  setDurationChoice: (choice: DurationChoice) => void;
  customHours: string;
  setCustomHours: (value: string) => void;
  /** `addHoursToTime(startTime, hours)` for the current choice, or `null` while
   * "Custom" is picked but nothing's typed yet, or the count is 24 hours or more. */
  endTime: string | null;
  /** The computed End lands on the next day — a session running past midnight. Drives the "next day" hint next to the End field. */
  endCrossesMidnight: boolean;
  /** The count is 24 hours or more, so there's no End to show — distinct from "Custom picked, nothing typed yet". */
  durationOverflows: boolean;
  /** Re-seeds Start/Duration/Custom back to a given start time and hour count — for a form that resets itself after a successful submit. */
  reset: (startTime: string, hours: number) => void;
}

/**
 * The Start/Duration/(computed, read-only) End trio every Booking Buddy form
 * with a time range needs — `CreateBookingForm`, `EditBookingForm`, and
 * `CreateSlotForm` all seed one of these from their own initial start time
 * and hour count, then hand its fields straight to `DurationPicker` and a
 * disabled End `<Input>`.
 */
export function useDurationInput(initialStartTime: string, initialHours: number): DurationInput {
  const initialChoice = durationChoiceForHours(initialHours);

  const [startTime, setStartTime] = useState(initialStartTime);
  const [durationChoice, setDurationChoice] = useState<DurationChoice>(initialChoice);
  const [customHours, setCustomHours] = useState(
    initialChoice === "custom" ? String(initialHours) : "",
  );

  // Blank while the User has "Custom" selected but hasn't typed a count yet —
  // distinct from an actually-invalid count, which gets its own message from
  // `durationOverflows`.
  const hasDurationInput = durationChoice !== "custom" || customHours.trim() !== "";
  const durationHours =
    durationChoice === "custom" ? Number(customHours) : Number(durationChoice);
  const endTime = hasDurationInput ? addHoursToTime(startTime, durationHours) : null;
  const durationOverflows = hasDurationInput && endTime === null;
  const endCrossesMidnight = endTime !== null && crossesMidnight(startTime, endTime);

  function reset(nextStartTime: string, nextHours: number) {
    setStartTime(nextStartTime);
    setDurationChoice(durationChoiceForHours(nextHours));
    setCustomHours("");
  }

  return {
    startTime,
    setStartTime,
    durationChoice,
    setDurationChoice,
    customHours,
    setCustomHours,
    endTime,
    endCrossesMidnight,
    durationOverflows,
    reset,
  };
}
