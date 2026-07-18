import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { InstagramIcon } from "@/components/icons";
import { SectionHeading } from "@/components/typography/section-heading";

export function JoinIn() {
  return (
    <section className="bg-brand-black text-white">
      <div className="flex w-full flex-col items-center gap-4 px-4 py-20 text-center sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Join In"
          title="This only works if you're part of it"
          align="center"
        />
        <p className="max-w-md text-white/70">
          Got a story from your local courts? A club we should know about? A hot take
          you need to get off your chest? We want to hear it. Follow along, send us a
          message, or just show up in the comments - that&apos;s half the show.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            nativeButton={false}
            className="h-11 bg-[#e1306c] px-6 text-base text-white hover:bg-[#e1306c]/90"
            render={<a href={siteConfig.links.instagram} target="_blank" rel="noopener noreferrer" />}
          >
            <InstagramIcon className="size-5" />
            Follow on Instagram
          </Button>
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            className="h-11 border-white/20 bg-transparent px-6 text-base text-white hover:bg-white/10 hover:text-white"
            render={<a href="/contact" />}
          >
            Send Us a Message
          </Button>
        </div>
      </div>
    </section>
  );
}
