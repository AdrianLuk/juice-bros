import { NextResponse } from "next/server";
import { notFound } from "next/navigation";

import { ON_DECK_DEV_COOKIE, devKeyMatches, onDeckDevKey } from "@/lib/on-deck/dev";
import { ON_DECK_DEV_PATH } from "@/lib/on-deck/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exchange `?key=<value>` for the dev-access cookie, then bounce to the console
 * (issue #351). One visit on the phone; every later visit rides the cookie, so
 * the secret stays out of browser history and referrers after the first hop.
 *
 * 404s — never a hint that the route exists — unless `ON_DECK_DEV_KEY` is set
 * and the query matches it.
 */
export async function GET(request: Request) {
  const key = onDeckDevKey();
  const provided =
    new URL(request.url).searchParams.get("key")?.trim() ?? "";

  if (!key || provided.length === 0 || !devKeyMatches(provided, key)) {
    notFound();
  }

  const response = NextResponse.redirect(
    new URL(ON_DECK_DEV_PATH, request.url),
  );
  response.cookies.set(ON_DECK_DEV_COOKIE, key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/on-deck",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
