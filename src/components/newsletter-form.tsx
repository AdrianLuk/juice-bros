"use client";

import { Button } from "@/components/ui/button";

// Stub UI - swap for the Beehiiv embed snippet once the publication is set up.
export function NewsletterForm() {
  return (
    <form className="flex w-full max-w-sm gap-2" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <input
        id="newsletter-email"
        type="email"
        required
        placeholder="you@email.com"
        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Button type="submit" className="h-12 shrink-0 rounded-full px-6 text-xl font-bold">
        Subscribe
      </Button>
    </form>
  );
}
