import Link from "next/link";

import { team } from "@/content/team";
import { InstagramIcon } from "@/components/icons";

/**
 * The two hosts, third on the page.
 *
 * The h1 claims "two guys still trying to get good at it"; this is the only
 * section that proves it - real names, the on-court photo, the paddle each of
 * them actually plays and the shot each is known for. Positioning is the one
 * thing PRODUCT.md says a competitor cannot copy, so it is evidence, not a
 * footer credit, and it sits directly under the newest episode rather than
 * below the catalogue where only the already-convinced would reach it.
 *
 * It carries no `bx-hair`: it follows the band, whose own bottom border
 * already draws that line, and a second rule there would double it.
 *
 * The page renders each host's `funFact` (paddle and signature shot), which is
 * real copy. The interim `bio` strings in `content/team.ts` are the About
 * page's problem, not this section's - nothing here is placeholder.
 */
export function TheHosts() {
  return (
    <section className="bx-measure py-16 sm:py-24">
      {/* The photograph belongs here in this variant. The hero above runs the
          brand banner rather than the on-court shot, so this is the only place
          the two of them appear and it is not a duplicate. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start lg:gap-16">
        <figure className="bx-tile aspect-[4/3]">
          {/* eslint-disable-next-line @next/next/no-img-element -- local photo, no next/image optimization needed here */}
          <img
            src="/pictures/adrian-dav.jpg"
            alt="Daven and Adrian on court between points"
            width={1200}
            height={900}
            loading="lazy"
            decoding="async"
            className="object-[50%_28%]"
          />
        </figure>

        <div>
          {/* The headline step, not the peak one: this section outranks the
              shelf and ties the archive, but the newest episode leads the page
              and has to be able to say so. */}
          <h2 className="bx-h2 text-[clamp(1.375rem,3.2vw,1.875rem)]">
            Two rec players, not coaches
          </h2>
          <p className="mt-4 max-w-[46ch] text-[1.0625rem] leading-relaxed text-[var(--bx-muted)]">
            Most pickleball shows are hosted by people who have already arrived.
            This one is hosted by two people who lose to the same team every
            week and fight for the same 8pm court booking.
          </p>

          <dl className="mt-9 grid gap-8 sm:grid-cols-2">
            {team.map((member) => (
              <div key={member.name}>
                <dt className="flex items-baseline gap-2.5">
                  <span className="text-base font-semibold">{member.name}</span>
                  <span className="bx-meta">{member.role}</span>
                </dt>
                <dd className="mt-1.5 text-[0.9375rem] leading-relaxed text-[var(--bx-muted)]">
                  {member.funFact}
                  <a
                    href={member.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2.5 flex items-center gap-2 text-sm font-medium text-[var(--bx-ink)] transition-colors duration-200 hover:text-[var(--bx-muted)]"
                  >
                    <InstagramIcon className="size-4" />
                    Follow {member.name}
                  </a>
                </dd>
              </div>
            ))}
          </dl>

          <Link
            href="/about"
            className="group mt-8 inline-flex text-sm font-semibold transition-colors duration-200 hover:text-[var(--bx-muted)]"
          >
            The whole story
            <span aria-hidden className="ml-1.5 inline-block transition-transform duration-200 group-hover:translate-x-0.5">
              &rarr;
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
