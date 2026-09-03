import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { signOut } from "@/lib/booking-buddy/actions/auth";

/**
 * Sign out, with its confirm dialog — lifted out of the old per-page nav (ADR
 * 0016) and dropped at the bottom of the Settings page instead. Out of the nav
 * entirely: it was account chrome sitting among primary navigation.
 */
export function SignOutButton() {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="destructive"
            className="h-12 gap-2 px-6 text-base font-semibold"
          />
        }
      >
        <LogOutIcon className="size-5" />
        Sign out
      </AlertDialogTrigger>
      <AlertDialogContent className="bb-theme">
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out of Booking Buddy?</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ll need to sign in again to see your games, friends, and
            bookings.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay signed in</AlertDialogCancel>
          {/* `contents` so the submit button is the footer's own flex child,
              sized exactly like the Cancel button beside it — full-width
              stacked on mobile, auto on desktop. */}
          <form action={signOut} className="contents">
            <Button type="submit" variant="destructive">
              Sign out
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
