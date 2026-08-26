import Image from "next/image";

import { team } from "@/content/team";
import { InstagramIcon } from "@/components/icons";
import { SectionHeading } from "@/components/typography/section-heading";

export function MeetTheBros() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
      <SectionHeading title="Meet the Bros" />

      <div className="mx-auto mt-8 max-w-3xl rounded-[1.75rem] bg-black/3 p-1.5 ring-1 ring-black/5">
        <Image
          src="/pictures/adrian-dav.jpg"
          alt="Daven and Adrian courtside, mid-match"
          width={2000}
          height={1333}
          loading="lazy"
          sizes="(min-width: 640px) 48rem, 100vw"
          className="aspect-video w-full rounded-[1.25rem] object-cover"
        />
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {team.map((member) => (
          <div
            key={member.name}
            className="flex flex-col gap-2 rounded-[1.5rem] bg-card p-7 shadow-brand"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-heading text-xl font-bold">{member.name}</p>
              <span className="text-xs text-muted-foreground">{member.role}</span>
            </div>
            <p className="text-sm text-muted-foreground">{member.bio}</p>
            <p className="mt-1 text-sm font-medium">{member.funFact}</p>
            <a
              href={member.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 transition-colors duration-300 hover:text-[#e1306c]"
            >
              <InstagramIcon className="size-4 text-[#e1306c]" />
              Follow {member.name}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
