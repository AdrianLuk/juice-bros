import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/typography/eyebrow";
import { SectionHeading } from "@/components/typography/section-heading";
import { SIGN_IN_PATH, PRIVACY_PATH } from "@/lib/booking-buddy/routes";
import { toJsonLdScript, buildBookingBuddyLandingJsonLd } from "@/lib/structured-data";
import { landingFaqs } from "@/lib/booking-buddy/landing-faqs";
import {
  AvailabilityPreview,
  SlotProposalPreview,
  SlotResponsesPreview,
  WeekPreview,
} from "./mockups";

/*
 * Direction contract — extension of the Juice Bros marketing world, not a new
 * one (impeccable/new-work.md §3 "extend an existing surface": inherit world +
 * composition, no concept tournament, no DESIGN.md change).
 *
 * THESIS: show the coordination actually happening — a Slot filling, real
 *   availability, a real week — instead of a feature-bullet grid. Refuses the
 *   SaaS-scheduler landing (calendar hero, integration logos, "trusted by").
 * OWN-WORLD: the JB marketing section stack inside `.bb-theme` — warm off-white
 *   ground, brand orange as the committed accent, brand black for the close,
 *   Bricolage black/bold headings, Eyebrow pills, and the app's own `bb-card` /
 *   `divide-y bg-muted/30` list / sm button vocabulary in the mockups.
 * STORY: a rec player arrives from /tools or a friend's link, sees this
 *   replaces the "who's free Tuesday?" thread, watches it work, signs in.
 * FIRST VIEWPORT: orange hero, copy left / a live-looking Slot card right
 *   (stacked on mobile), primary "Get started" → sign-in.
 * FORM: hero → 3 alternating feature rows each with one honest mockup →
 *   "made by rec players" beat → dark CTA close → FAQ. The established site
 *   composition; no alternative ranked.
 */

function FeatureRow({
  eyebrow,
  title,
  children,
  visual,
  flip,
  muted,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  visual: ReactNode;
  flip?: boolean;
  muted?: boolean;
}) {
  return (
    <section className={muted ? "w-full bg-muted/50" : "w-full"}>
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div className={flip ? "lg:order-2" : undefined}>
          <SectionHeading eyebrow={eyebrow} title={title} />
          <p className="mt-4 max-w-md text-lg text-muted-foreground">{children}</p>
        </div>
        <div className={`flex justify-center ${flip ? "lg:order-1 lg:justify-start" : "lg:justify-end"}`}>
          {visual}
        </div>
      </div>
    </section>
  );
}

export function BookingBuddyLanding() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toJsonLdScript(buildBookingBuddyLandingJsonLd(landingFaqs)),
        }}
      />

      {/* Hero. Bleeds up past the desktop sticky nav (the pull-up exceeds the
          ~70px nav height so the orange runs unbroken to the top edge behind
          the pill, with no strip of page background above it). Mobile keeps its
          in-flow orange identity strip, so no pull-up there. */}
      <section className="w-full bg-brand-orange px-4 py-16 text-white sm:-mt-24 sm:px-6 sm:pt-40 sm:pb-24 lg:px-8">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col gap-5">
            <Eyebrow color="yellow">Booking Buddy</Eyebrow>
            <h1 className="font-heading text-4xl font-black tracking-[-0.03em] text-balance sm:text-6xl">
              Sort out the next game without the group-chat spiral
            </h1>
            <p className="max-w-md text-lg text-white/80 text-balance">
              Post an open time, see who&apos;s actually in, and keep everyone&apos;s
              court bookings in one place. Free, and built by two rec players who
              got tired of running the Tuesday-night &ldquo;who can play?&rdquo;
              thread.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                nativeButton={false}
                className="h-12 rounded-full bg-white px-7 text-base font-semibold text-brand-orange shadow-brand hover:bg-white/90"
                render={<Link href={SIGN_IN_PATH} />}
              >
                Get started
              </Button>
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                className="h-12 rounded-full border-white/25 bg-white/10 px-6 text-base text-white hover:bg-white/20 hover:text-white"
                render={<a href="#how" />}
              >
                See how it works
              </Button>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <SlotResponsesPreview />
          </div>
        </div>
      </section>

      <div id="how" className="scroll-mt-20" />

      <FeatureRow
        eyebrow="Open Time"
        title="Float a time before anyone books a court"
        visual={<SlotProposalPreview />}
      >
        Drop a day and time and let people say yes, no, or maybe. It starts as a
        plain proposal. Once someone grabs a court, attach it and Booking Buddy
        tracks the spots so you know when you&apos;ve got a full game.
      </FeatureRow>

      <FeatureRow
        eyebrow="Availability"
        title="Stop guessing who's around"
        visual={<AvailabilityPreview />}
        flip
        muted
      >
        Everyone shares their open and busy time with the friends they choose.
        Looking for a fourth? See who&apos;s actually free instead of texting six
        people one at a time.
      </FeatureRow>

      <FeatureRow
        eyebrow="Your Week"
        title="Games and bookings in one place"
        visual={<WeekPreview />}
      >
        Confirmed games, proposals still waiting on a court, and your own busy
        time all land on one calendar: your own, plus a shared view of the
        friends who&apos;ve shared back.
      </FeatureRow>

      {/* Made by rec players */}
      <section className="w-full bg-muted/50">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-4 py-20 text-center sm:px-6 lg:px-8">
          <div>
            <Eyebrow>Not a Startup</Eyebrow>
            <h2 className="mt-3 font-heading text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
              We built this for our own group first
            </h2>
          </div>
          <p className="text-muted-foreground">
            Keeping a regular game going meant a group-chat poll, a pile of
            &ldquo;maybe&rdquo; replies, and bookings scattered across a few
            different facility sites. It was more admin than pickleball, so we
            built the thing we actually wanted. It&apos;s free and has no ads,
            and your schedule is only ever visible to the friends you connect
            with, at the level you choose. Nothing here is public.
          </p>
        </div>
      </section>

      {/* CTA close */}
      <section className="relative overflow-hidden bg-brand-black text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,color-mix(in_oklch,var(--brand-orange),transparent_86%)_0%,transparent_60%)]"
        />
        <div className="relative flex w-full flex-col items-center gap-4 px-4 py-24 text-center sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Get Started"
            title="Get your group on the same page"
            align="center"
          />
          <p className="max-w-md text-white/60">
            Free to use. Your friends will want accounts too, since that&apos;s
            kind of the whole point.
          </p>
          <div className="mt-5 flex flex-col items-center gap-3">
            <Button
              size="lg"
              nativeButton={false}
              className="h-12 rounded-full bg-brand-orange px-8 text-base font-semibold text-white shadow-brand hover:bg-brand-orange/90"
              render={<Link href={SIGN_IN_PATH} />}
            >
              Get started
            </Button>
            <Link
              href={PRIVACY_PATH}
              className="text-sm text-white/50 underline underline-offset-4 transition-colors hover:text-white/80"
            >
              Read the privacy policy
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="w-full">
        <div className="mx-auto w-full max-w-2xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Questions" title="Good to know" align="center" />
          <dl className="mt-10 flex flex-col divide-y divide-border">
            {landingFaqs.map((faq) => (
              <div key={faq.question} className="py-5 first:pt-0 last:pb-0">
                <dt className="font-heading text-base font-semibold tracking-tight">
                  {faq.question}
                </dt>
                <dd className="mt-2 text-sm text-muted-foreground">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}
