"use client";

import { useState } from "react";
import { ChevronDownIcon, MapPinIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SearchPlaceForm } from "@/components/booking-buddy/place-search";
import { CreateOrgForm } from "@/components/booking-buddy/orgs";
import { GenderForm } from "@/components/booking-buddy/gender-form";
import type { Org } from "@/lib/booking-buddy/actions/orgs";
import type { Gender } from "@/lib/booking-buddy/gender";

/**
 * Shown on the dashboard whenever the signed-in User has zero Orgs (issue
 * #103) — a soft nudge to add a first Facility, and optionally set Gender,
 * in one sitting. Never a hard gate: an explicit Done and the Dialog's own
 * close button both dismiss it, and dismissing has no persisted effect — it
 * simply reappears on a later dashboard load if the trigger still holds.
 *
 * `open` is seeded once, from the live zero-Org count at mount — a fresh
 * page load is what recomputes the trigger (per the "live check, no stored
 * flag" decision), not a prop change while this stays mounted. `orgs` itself
 * keeps updating live as Facilities are added (the create actions revalidate
 * this route), which is also what doubles as this modal's own "added this
 * session" list: the precondition for it ever opening is that `orgs` started
 * empty, so whatever's in it thereafter was added in this sitting.
 *
 * Composes the same add-Facility forms as the Facilities page and the same
 * Gender form as Settings, unchanged — see
 * `booking-buddy/docs/adr/0012-onboarding-surfaces-gender-proactively.md`.
 */
export function OnboardingModal({
  orgs,
  gender,
}: {
  orgs: Org[];
  gender: Gender | null;
}) {
  const [open, setOpen] = useState(() => orgs.length === 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add your first facility</DialogTitle>
          <DialogDescription>
            Bookings need somewhere to hang off. Search for a place you play,
            or type it by hand if Google doesn&apos;t have it — add as many
            as you like, then hit Done. Skippable, and you can always come
            back to this from Facilities or Settings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <div>
            <SearchPlaceForm />

            <details className="group mt-4 overflow-hidden bb-card">
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-muted">
                Can&apos;t find your facility?
                <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-border px-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Community-centre gyms and private courts usually
                  aren&apos;t on Google. Type the name instead.
                </p>
                <div className="mt-4">
                  <CreateOrgForm />
                </div>
              </div>
            </details>
          </div>

          {orgs.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">
                Added so far
                <span className="ml-2 font-normal text-muted-foreground">
                  {orgs.length}
                </span>
              </h3>
              <ul className="mt-2 divide-y divide-border/60 overflow-hidden bb-card">
                {orgs.map((org) => (
                  <li
                    key={org.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <MapPinIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">
                      {org.displayName}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-border pt-6">
            <GenderForm gender={gender} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
