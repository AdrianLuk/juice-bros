import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { SIGN_IN_PATH, PRIVACY_PATH } from "@/lib/booking-buddy/routes";
import {
  toJsonLdScript,
  buildBookingBuddyLandingJsonLd,
} from "@/lib/structured-data";
import { landingFaqs } from "@/lib/booking-buddy/landing-faqs";
import {
  AvailabilityPreview,
  OverlapPreview,
  SlotProposalPreview,
  SlotResponsesPreview,
  WeekPreview,
} from "./mockups";

/*
 * Direction contract — Booking Buddy's rec-hall-board world (seed 861cf732),
 * Persuade register. The pre-auth surface is the board seen from a step back:
 * a taped headline, a few real game cards pinned up, one orange commit-pin
 * action. It refuses the SaaS-scheduler landing (calendar hero, "trusted by",
 * integration logos) and refuses its own category's cute mascot.
 * FIRST VIEWPORT: cork ground; a big screen-printed headline top-left with the
 *   hook in one line; the orange-pinned "Get started" action leads; a small
 *   board of two pinned Slot cards to the right (stacked on mobile).
 * FORM: hero → four beats each showing the board doing one job → "built for
 *   our own group" index card → last-call CTA → FAQ.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the
 *   finish review, the verdict, DESIGN.md, and every shipping raster carrying
 *   its provenance.
 */

function Beat({
  title,
  children,
  visual,
  flip,
}: {
  title: string;
  children: ReactNode;
  visual: ReactNode;
  flip?: boolean;
}) {
  return (
    <section className="w-full px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className={flip ? "lg:order-2" : undefined}>
          <h2 className="bb-h text-[1.9rem] leading-[0.95] sm:text-[2.3rem]">
            {title}
          </h2>
          <p className="mt-4 max-w-md text-[1.02rem] text-[var(--bb-on-cork-dim)]">
            {children}
          </p>
        </Reveal>
        <Reveal
          variant="scale"
          delay={80}
          className={`flex justify-center ${flip ? "lg:order-1 lg:justify-start" : "lg:justify-end"}`}
        >
          <div className="bb-pinned relative">
            <span aria-hidden className="bb-pin bb-pin--info" />
            {visual}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function BookingBuddyLanding() {
  return (
    <div className="bb-board flex w-full flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toJsonLdScript(buildBookingBuddyLandingJsonLd(landingFaqs)),
        }}
      />

      {/* Hero — the board, a step back. */}
      <section className="w-full px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-24 lg:px-8">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col gap-5">
            <h1 className="jb-in bb-h text-[2.6rem] leading-[0.92] sm:text-[3.9rem]">
              Sort out the next game without the group-chat spiral
            </h1>
            <p className="jb-in jb-in-2 max-w-md text-[1.05rem] text-[var(--bb-on-cork-dim)] text-balance">
              Pin a time, see who&apos;s actually in, and keep everyone&apos;s
              court bookings in one place. Free, and built by two rec players
              who got tired of running the Tuesday-night &ldquo;who can
              play?&rdquo; thread.
            </p>
            <div className="jb-in jb-in-3 mt-3 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                nativeButton={false}
                className="relative h-12 rounded-sm px-7 font-bb-sign text-[0.85rem] tracking-widest uppercase shadow-[var(--bb-contact-shadow)] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
                render={<Link href={SIGN_IN_PATH} />}
              >
                <span
                  aria-hidden
                  className="bb-pin bb-pin--commit"
                  style={{ top: "-0.5rem" }}
                />
                Get started
              </Button>
              <Button
                size="lg"
                variant="secondary"
                nativeButton={false}
                className="h-12 rounded-sm border border-[var(--bb-cork-edge)]/25 px-6 font-bb-sign text-[0.8rem] tracking-widest uppercase"
                render={<a href="#how" />}
              >
                See how it works
              </Button>
            </div>
          </div>

          {/* A small board of two pinned cards. */}
          <div className="jb-in jb-in-3 relative mx-auto flex max-w-sm flex-col gap-6 lg:mx-0 lg:ml-auto">
            <div
              className="bb-pinned relative"
              style={{ "--bb-tilt": "-1.6deg" } as React.CSSProperties}
            >
              <span aria-hidden className="bb-pin bb-pin--in" />
              <SlotResponsesPreview />
            </div>
            <div
              className="bb-pinned relative ml-6"
              style={{ "--bb-tilt": "1.4deg" } as React.CSSProperties}
            >
              <span aria-hidden className="bb-pin bb-pin--maybe" />
              <SlotProposalPreview />
            </div>
          </div>
        </div>
      </section>

      <div id="how" className="scroll-mt-20" />

      <Beat
        title="Float a time before anyone books a court"
        visual={<SlotProposalPreview />}
      >
        Pin a day and time and let people say yes, no, or maybe. It starts as a
        plain proposal. Once someone grabs a court, attach it and Booking Buddy
        tracks the spots so you know when you&apos;ve got a full game.
      </Beat>

      <Beat
        title="Stop guessing who's around"
        visual={<AvailabilityPreview />}
        flip
      >
        Everyone shares their availability with the friends they choose. Looking
        for a fourth? See who&apos;s actually free instead of texting six people
        one at a time.
      </Beat>

      <Beat
        title="See when the whole group is free"
        visual={<OverlapPreview />}
      >
        Pick the friends you want in, and Booking Buddy checks everyone&apos;s
        availability against yours. It shows the days you can all make, with a
        button to float a game for one without leaving the page.
      </Beat>

      <Beat
        title="Games and bookings in one place"
        visual={<WeekPreview />}
        flip
      >
        Confirmed games, proposals still waiting on a court, and your own busy
        time all land on one sign-up sheet: your own, plus a shared view of the
        friends who&apos;ve shared back.
      </Beat>

      {/* Built for our own group — an index card pinned on the cork. */}
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-xl">
          <div className="bb-card bb-pinned relative p-7 text-center">
            <span aria-hidden className="bb-pin bb-pin--info" />
            <h2 className="bb-h text-[1.5rem]">
              We built this for our own group first
            </h2>
            <p className="mt-4 text-[0.98rem] text-muted-foreground">
              Keeping a regular game going meant a group-chat poll, a pile of
              &ldquo;maybe&rdquo; replies, and bookings scattered across a few
              facility sites. It was more admin than pickleball, so we built the
              thing we actually wanted. It&apos;s free, has no ads, and your
              schedule is only ever visible to the friends you connect with, at
              the level you choose. Nothing here is public.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Last call. */}
      <section className="w-full px-4 py-20 sm:px-6 lg:px-8">
        <Reveal
          variant="scale"
          className="mx-auto flex max-w-lg flex-col items-center gap-4 text-center"
        >
          <h2 className="bb-h text-[2rem] leading-[0.95] sm:text-[2.6rem]">
            Get your group on the same page
          </h2>
          <p className="max-w-sm text-[0.98rem] text-muted-foreground">
            Free to use. Your friends will want accounts too, since that&apos;s
            kind of the whole point.
          </p>
          <div className="mt-4 flex flex-col items-center gap-3">
            <Button
              size="lg"
              nativeButton={false}
              className="relative h-12 rounded-sm px-8 font-bb-sign text-[0.85rem] tracking-widest uppercase shadow-[var(--bb-contact-shadow)] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
              render={<Link href={SIGN_IN_PATH} />}
            >
              <span
                aria-hidden
                className="bb-pin bb-pin--commit"
                style={{ top: "-0.5rem" }}
              />
              Get started
            </Button>
            <Link
              href={PRIVACY_PATH}
              className="text-sm text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground"
            >
              Read the privacy policy
            </Link>
          </div>
        </Reveal>
      </section>

      {/* FAQ — a pinned notes card. */}
      <section className="w-full px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <Reveal></Reveal>
          <RevealGroup
            as="dl"
            className="bb-card mt-4 flex flex-col divide-y divide-[var(--bb-rule)] p-6"
          >
            {landingFaqs.map((faq) => (
              <div key={faq.question} className="py-5 first:pt-0 last:pb-0">
                <dt className="font-semibold tracking-tight">{faq.question}</dt>
                <dd className="mt-2 text-sm text-muted-foreground">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </RevealGroup>
        </div>
      </section>
    </div>
  );
}
