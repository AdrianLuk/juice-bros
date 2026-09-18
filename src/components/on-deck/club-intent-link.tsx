"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";

import { ON_DECK_SIGN_IN_PATH } from "@/lib/on-deck/routes";
import { trackWhenReady } from "@/lib/on-deck/analytics-browser";
import type {
  ClubIntentSource,
  OnDeckFunnelEvent,
} from "@/lib/on-deck/analytics-events";

const CLUB_INTENT: OnDeckFunnelEvent = "od_club_intent";

/**
 * A link toward creating a Club that says so on the way (issue #524).
 *
 * The event has to fire here rather than on the other side of sign-in, because
 * the gap between clicking this and arriving with a Club is the one the
 * release most needs to see: everything that happens before authentication is
 * otherwise invisible, and a visitor the demo failed to convince and one who
 * bounced off the sign-in page produce the same silence.
 *
 * Client-side and anonymous, like `gear_click` — "did somebody click this" is
 * a browser fact, and there is no account yet to ask the database about.
 * Nothing is awaited: the navigation must not wait on analytics.
 *
 * Renders a bare `Link` so it can be dropped into the landing page's
 * `Button render={...}` slot as well as stood on its own in the demo's arena.
 */
export function ClubIntentLink({
  from,
  onClick,
  ...rest
}: Omit<ComponentProps<typeof Link>, "href"> & {
  /** Which "Create your Club" this is, carried as a dimension on the event. */
  from: ClubIntentSource;
}) {
  return (
    <Link
      {...rest}
      href={ON_DECK_SIGN_IN_PATH}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        trackWhenReady(CLUB_INTENT, { from });
        // Whatever the slot this is rendered into wanted to do as well — the
        // landing page's Button merges its own handler in through `render`.
        onClick?.(event);
      }}
    />
  );
}
