"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarOffIcon, PlusIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreateAvailabilityWindowForm } from "@/components/booking-buddy/availability";

/**
 * The dashboard's quick-add actions — "Log a court" (the shared Log-a-booking
 * dialog lifted into `OwnerDashboardCalendar`, issue #303) and "Block off
 * time" — pinned to the bottom-right corner as a small stack of kraft notes.
 * `bottom-24` on mobile clears the fixed bottom tab bar; `sm:bottom-6` on
 * desktop. Kept kraft, not orange: the one orange commit pin on the dashboard
 * is "Post a new game" up on the board. "Log a court" carries a small orange
 * pushpin as the primary of the two.
 *
 * Portaled to `<body>` so `position: fixed` pins it to the viewport, not to
 * the calendar sheet — that sheet carries `.bb-pinned`'s `transform`, which
 * would otherwise be the containing block. The portal wrapper re-declares
 * `.bb-theme` so the world's tokens (`--bb-cork-edge`, the pin colours, the
 * contact shadow) still resolve outside the app subtree.
 */
export function DashboardQuickActions({
  onAddBooking,
}: {
  onAddBooking: () => void;
}) {
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot: portals need a client-only DOM target
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="bb-theme fixed right-3 bottom-24 z-40 flex flex-col items-end gap-2.5 sm:right-6 sm:bottom-6">
      <Dialog
        open={availabilityDialogOpen}
        onOpenChange={setAvailabilityDialogOpen}
      >
        <DialogTrigger
          render={
            <Button
              size="sm"
              variant="secondary"
              className="h-10 gap-2 rounded-sm border border-[var(--bb-cork-edge)]/25 px-3.5 font-bb-sign text-[0.68rem] tracking-widest uppercase shadow-[var(--bb-contact-shadow)] hover:-translate-y-0.5 active:translate-y-0 motion-reduce:hover:translate-y-0"
            />
          }
        >
          <CalendarOffIcon />
          Block off time
        </DialogTrigger>
        <DialogContent className="bb-theme sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Set your availability</DialogTitle>
            <DialogDescription>
              Mark a stretch as looking to play or busy. It only shows on your
              calendar. Friends can still ask about it, this doesn&apos;t stop a
              game invite.
            </DialogDescription>
          </DialogHeader>
          <CreateAvailabilityWindowForm
            onSaved={() => setAvailabilityDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Button
        size="sm"
        variant="secondary"
        onClick={onAddBooking}
        className="relative h-10 gap-2 rounded-sm border border-[var(--bb-cork-edge)]/25 px-4 font-bb-sign text-[0.7rem] tracking-widest uppercase shadow-[var(--bb-contact-shadow)] hover:-translate-y-0.5 active:translate-y-0 motion-reduce:hover:translate-y-0"
      >
        <span
          aria-hidden
          className="bb-pin bb-pin--commit"
          style={{
            top: "-0.5rem",
            width: "0.8rem",
            height: "0.8rem",
            marginLeft: "-0.4rem",
          }}
        />
        <PlusIcon />
        Log a court
      </Button>
    </div>,
    document.body,
  );
}
