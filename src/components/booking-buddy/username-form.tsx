"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/booking-buddy/username";
import { updateUsername } from "@/lib/booking-buddy/actions/profile";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";

const EMPTY: ActionResult = {};

export function UsernameForm({ username }: { username: string | null }) {
  const [state, formAction, pending] = useActionState(updateUsername, EMPTY);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username">Username</Label>
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-muted-foreground">
            @
          </span>
          <Input
            id="username"
            name="username"
            defaultValue={username ?? ""}
            minLength={USERNAME_MIN_LENGTH}
            maxLength={USERNAME_MAX_LENGTH}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Between {USERNAME_MIN_LENGTH} and {USERNAME_MAX_LENGTH} characters:
        letters, numbers and underscores. This is what you give people so they
        can find you without sharing your email.
      </p>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      {/* Only after a save — the form does not start out claiming success. */}
      {state.ok && (
        <p className="text-sm text-muted-foreground" role="status">
          Saved. That&apos;s your handle now.
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save username"}
        </Button>
      </div>
    </form>
  );
}
