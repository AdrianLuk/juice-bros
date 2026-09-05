import Link from "next/link";

import { team } from "@/content/team";
import { InstagramIcon } from "@/components/icons";

/**
 * The two hosts. A category-standard podcast home page carries one, and it is
 * the section that does the positioning work the h1 only gestures at: these
 * are rec players, not coaches.
 *
 * The bios in `content/team.ts` are interim copy pending Adrian writing the
 * real ones, and they say so on the page rather than pretending otherwise.
 */
export function TheHosts() {
  return (
    <section className="bx-measure bx-hair py-14 sm:py-20">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-center lg:gap-14">
        <figure className="bx-tile aspect-[4/3] lg:aspect-square">
          {/* eslint-disable-next-line @next/next/no-img-element -- local photo, no next/image optimization needed here */}
          <img
            src="/pictures/adrian-dav.jpg"
            alt="Daven and Adrian at the net during a rec game"
            width={1200}
            height={1200}
            loading="lazy"
            decoding="async"
            className="object-[50%_35%]"
          />
        </figure>

        <div>
          <h2 className="bx-h2 text-[1.375rem] sm:text-2xl">Two rec players, not coaches</h2>
          <p className="mt-3 max-w-[54ch] text-[1.0625rem] leading-relaxed text-[var(--bx-muted)]">
            Most pickleball shows are hosted by people who have already arrived. This one is
            hosted by two people who lose to the same team every week and fight for the same
            8pm court booking.
          </p>

          <dl className="mt-8 grid gap-6 sm:grid-cols-2">
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
            className="mt-8 inline-flex text-sm font-semibold transition-colors duration-200 hover:text-[var(--bx-muted)]"
          >
            The whole story
            <span aria-hidden className="ml-1.5">&rarr;</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
