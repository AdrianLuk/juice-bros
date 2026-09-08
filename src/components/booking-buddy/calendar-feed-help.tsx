"use client";

import { CircleQuestionMark } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Picture } from "@/components/picture";

/**
 * The "?" beside a calendar-feed field, showing where CourtReserve keeps the
 * link (issue #454). Sits beside the Facilities-page field and beside the
 * onboarding modal's feed step (issue #471) — the same question in both
 * places, so it lives in one file rather than two.
 *
 * The instruction next to it names the web path, which is the one the User is
 * most likely on while pasting a URL into a browser. The app hides the same
 * link somewhere else entirely, under the More tab, and describing a phone
 * screen in a sentence is worse than showing it, so this is a Dialog rather
 * than the small `Popover` hints used elsewhere: the screenshot is a whole
 * phone screen, twice as tall as it is wide, and only a modal can give it
 * enough room without shoving the form off a short viewport. It is capped on
 * height rather than width for the same reason: width is not what runs out
 * first on anything this shape.
 *
 * Nested inside the onboarding modal it is a dialog opened over a dialog,
 * which Base UI handles — the outer one stays mounted and the inner one takes
 * focus, so dismissing it returns the User to the field they were filling.
 */
export function CalendarFeedHelp() {
  return (
    <Dialog>
      {/* A 14px glyph in a 28px button, pulled back out with the negative
          margin: the icon has to stay the size of the label beside it, and
          the tap target has to not be 14px on a phone. */}
      <DialogTrigger
        render={<button type="button" />}
        aria-label="Where do I find my calendar feed?"
        className="-m-1.5 grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <CircleQuestionMark className="size-3.5" aria-hidden />
      </DialogTrigger>
      <DialogContent className="bb-theme">
        <DialogHeader>
          <DialogTitle>Where to find your calendar feed</DialogTitle>
          <DialogDescription>
            In the CourtReserve app, tap <strong>More</strong> in the bottom
            bar, then <strong>Calendar Feed</strong>. Copy the link it gives
            you and paste it here.
          </DialogDescription>
        </DialogHeader>
        <Picture
          src="/booking-buddy/courtreserve-calendar-feed.jpg"
          alt="The CourtReserve app's More screen, with the Calendar Feed row outlined in red between My Bookings and My Membership."
          sizes="300px"
          className="mx-auto max-h-[60vh] w-auto max-w-full rounded-lg ring-1 ring-foreground/10"
        />
        <p className="text-xs text-muted-foreground">
          On the CourtReserve website it is under your name in the top corner
          instead.
        </p>
      </DialogContent>
    </Dialog>
  );
}
