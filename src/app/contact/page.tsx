import type { Metadata } from "next";

import { getLatestInstagramPosts } from "@/lib/instagram";
import { pageMetadata } from "@/lib/metadata";
import { Reveal } from "@/components/motion/reveal";
import { PageHeading } from "@/components/typography/page-heading";
import { InstagramFeed } from "@/components/instagram-feed";
import { ContactForm } from "./sections/contact-form";
import { ContactInfo } from "./sections/contact-info";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description:
    "Get in touch with Juice Bros Pickleball - questions, guest pitches, sponsorships, and more.",
  path: "/contact",
});

export default async function ContactPage() {
  const instagramPosts = await getLatestInstagramPosts();

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <PageHeading
            eyebrow="Get In Touch"
            title="Say hey"
            description="Got a story from your local courts? A club we should know about? A hot take you need to get off your chest? We read everything. Yes, everything."
          />

          <div className="mt-8">
            <ContactForm />

            <p className="mt-8 text-sm text-muted-foreground">
              For sponsorships and partnerships, pick that option above and we&apos;ll
              get back to you fast. We&apos;re picky about who we work with - it has to
              be stuff we&apos;d actually use.
            </p>
          </div>
        </div>
      </section>

      {instagramPosts.length > 0 && (
        <Reveal>
          <InstagramFeed posts={instagramPosts} />
        </Reveal>
      )}
      <Reveal variant="scale">
        <ContactInfo />
      </Reveal>
    </div>
  );
}
