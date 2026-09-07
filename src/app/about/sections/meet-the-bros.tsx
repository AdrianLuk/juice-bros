import { team } from "@/content/team";
import { InstagramIcon } from "@/components/icons";

/**
 * The two hosts, with the on-court photograph at the size it deserves.
 *
 * The home page runs a smaller crop of this shot beside a two-line summary;
 * this is the page someone comes to when that summary wasn't enough, so the
 * photograph is full width and each host gets a panel of their own.
 *
 * The `bio` strings in `content/team.ts` are interim by design - Adrian is
 * writing the real ones in each host's own words - so the layout doesn't
 * depend on their length, and the paddle-and-shot line beneath (which is real
 * copy) reads as its own fact rather than as the end of a paragraph.
 */
export function MeetTheBros() {
  return (
    <section className="bx-measure py-16 sm:py-24">
      <h2 className="bx-h2 text-[clamp(1.375rem,3.2vw,1.875rem)]">Meet the Bros</h2>

      <figure className="bx-tile mt-8 aspect-[16/9]">
        {/* eslint-disable-next-line @next/next/no-img-element -- local trusted asset, no next/image optimization needed */}
        <img
          src="/pictures/adrian-dav.jpg"
          alt="Daven and Adrian courtside, mid-match"
          width={2000}
          height={1333}
          loading="lazy"
          decoding="async"
          className="object-[50%_30%]"
        />
      </figure>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {team.map((member) => (
          <div key={member.name} className="bx-panel flex flex-col p-6 sm:p-7">
            <h3 className="bx-h2 text-lg sm:text-xl">{member.name}</h3>
            <p className="bx-meta mt-2">{member.role}</p>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-[var(--bx-muted)]">
              {member.bio}
            </p>
            <p className="mt-4 border-t border-[var(--bx-line-soft)] pt-4 text-[0.9375rem] leading-relaxed">
              {member.funFact}
            </p>
            <a
              href={member.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bx-actionlink mt-5 gap-2"
            >
              <InstagramIcon className="size-4" />
              Follow {member.name}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
