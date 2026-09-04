"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { DayPicker } from "react-day-picker";

import "react-day-picker/style.css";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDateLabel, isRealDate } from "@/lib/booking-buddy/datetime";

/** `"2026-09-09"` → a local-midnight `Date`, or `undefined` when it isn't a real calendar date. */
function parseValue(value: string): Date | undefined {
  if (!isRealDate(value)) {
    return undefined;
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** A local `Date` back to `"YYYY-MM-DD"`, reading the same local parts `parseValue` set. */
function formatValue(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface DateFieldInput {
  /** The picked date as `"YYYY-MM-DD"`, or `""` while nothing's chosen. */
  date: string;
  setDate: (value: string) => void;
  /** Re-seed the field — for a form that resets itself after a successful submit. */
  reset: (value: string) => void;
}

/**
 * The Date state the Booking and Game forms hand to `DateField` — mirrors
 * `useDurationInput` next to it, so the date and the time range both live in
 * the same kind of mount-time state a form can re-seed in one place.
 */
export function useDateField(initialDate: string): DateFieldInput {
  const [date, setDate] = useState(initialDate);
  return { date, setDate, reset: setDate };
}

/**
 * A calendar-popover date picker standing in for `<input type="date">`, whose
 * editing UI the browser renders in its own locale format (`dd/mm/yyyy` here).
 * The trigger reads the date the way the rest of Booking Buddy writes one —
 * `Sep 09, 2026` — and the picked value still posts as the `YYYY-MM-DD` string
 * the create / update actions already validate (`isRealDate`), through a hidden
 * input so nothing on the receiving end needs JavaScript.
 */
export function DateField({
  id,
  name,
  value,
  onChange,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseValue(value);

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className={cn(
                // Match the plain inputs/selects it sits beside, not the
                // button's own cork `bg-background`.
                "h-8 w-full justify-start border-input bg-transparent px-2.5 font-normal dark:bg-input/30",
                !selected && "text-muted-foreground",
              )}
            />
          }
        >
          <CalendarIcon className="mr-2 opacity-70" aria-hidden />
          {selected ? formatDateLabel(value) : "Pick a date"}
        </PopoverTrigger>
        <PopoverContent
          className="bb-theme bb-daypicker w-auto p-0"
          align="start"
        >
          <DayPicker
            mode="single"
            autoFocus
            selected={selected}
            defaultMonth={selected}
            onSelect={(next) => {
              onChange(next ? formatValue(next) : "");
              if (next) {
                setOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
