"use client";

import { Button } from "@/components/ui/button";

// Stub UI — swap for the Beehiiv embed snippet once the publication is set up.
export function NewsletterForm() {
  return (
    <form className="flex w-full max-w-sm gap-2" onSubmit={(e) => e.preventDefault()}>
      <input
        type="email"
        required
        placeholder="you@email.com"
        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Button type="submit">Subscribe</Button>
    </form>
  );
}
