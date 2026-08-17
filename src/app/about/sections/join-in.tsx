import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { InstagramIcon } from "@/components/icons";
import { SectionHeading } from "@/components/typography/section-heading";

export function JoinIn() {
  return (
    <section className="relative overflow-hidden bg-brand-black text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,color-mix(in_oklch,var(--brand-orange),transparent_88%)_0%,transparent_60%)]"
      />
      <div className="relative flex w-full flex-col items-center gap-4 px-4 py-24 text-center sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Join In"
          title="This only works if you're part of it"
          align="center"
        />
        <p className="max-w-md text-white/60">
          Got a story from your local courts? A club we should know about? A hot take
          you need to get off your chest? We want to hear it. Follow along, send us a
          message, or just show up in the comments - that&apos;s half the show.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            nativeButton={false}
            className="group h-12 rounded-full bg-[#e1306c] pr-2 pl-6 text-base text-white hover:bg-[#e1306c]/90"
            render={<a href={siteConfig.links.instagram} target="_blank" rel="noopener noreferrer" />}
          >
            Follow on Instagram
            <span className="flex size-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5">
              <InstagramIcon className="size-4" />
            </span>
          </Button>
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            className="h-12 rounded-full border-white/15 bg-white/5 px-6 text-base text-white hover:bg-white/10 hover:text-white"
            render={<a href="/contact" />}
          >
            Send Us a Message
          </Button>
        </div>
      </div>
    </section>
  );
}
