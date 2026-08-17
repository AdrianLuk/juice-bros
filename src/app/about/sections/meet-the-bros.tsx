import { team } from "@/content/team";
import { InstagramIcon } from "@/components/icons";
import { SectionHeading } from "@/components/typography/section-heading";

export function MeetTheBros() {
  return (
    <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading eyebrow="The Two Behind the Mic" title="Meet the Bros" />

      {/* eslint-disable-next-line @next/next/no-img-element -- local trusted asset, no next/image optimization needed */}
      <img
        src="/pictures/adrian-dav.jpg"
        alt="Daven and Adrian courtside, mid-match"
        width={2000}
        height={1333}
        loading="lazy"
        className="mx-auto mt-8 aspect-video w-full max-w-3xl rounded-2xl border object-cover"
      />

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {team.map((member) => (
          <div
            key={member.name}
            className="flex flex-col gap-2 rounded-xl border p-6"
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
              className="mt-3 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
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
