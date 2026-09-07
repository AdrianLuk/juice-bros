import type { Metadata } from "next";

import { getLatestInstagramPosts } from "@/lib/instagram";
import { pageMetadata } from "@/lib/metadata";
import { PageHead } from "@/components/bx/page-head";
import { InstagramStrip } from "@/components/bx/instagram-strip";
import { ContactForm } from "./sections/contact-form";
import { ContactInfo } from "./sections/contact-info";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description:
    "Get in touch with Juice Bros Pickleball - questions, guest pitches, sponsorships, and more.",
  path: "/contact",
});

/**
 * Contact, in Broadcast Dark.
 *
 * The only Operate surface on the marketing site: someone here has a task, so
 * the form is the page and it starts within the first screen.
 *
 * It runs on the same left-aligned 72rem measure as every other route rather
 * than in a narrow centred column. A centred column left the form's own
 * sections starting 200px inboard of the footer and the strip beneath it,
 * which read as two different pages stacked - and it wasted the right half of
 * the screen on nothing. The form keeps a comfortable column width; the
 * Instagram alternative fills the space the form doesn't need, where someone
 * who has decided not to type will actually see it.
 *
 * The sponsorship note moved from under the form into the header. It changes
 * whether someone fills the form in at all, so it belongs where it is read
 * before they start rather than after they have finished.
 */
export default async function ContactPage() {
  const instagramPosts = await getLatestInstagramPosts();

  return (
    <div className="flex w-full flex-1 flex-col">
      <PageHead
        title="Say hey"
        lead="Got a story from your local courts? A club we should know about? A hot take you need to get off your chest? We read everything. Yes, everything."
        note={
          <>
            For sponsorships and partnerships, pick that option below and
            we&apos;ll get back to you fast. We&apos;re picky about who we work
            with. It has to be stuff we&apos;d actually use.
          </>
        }
      />

      <div className="bx-measure pb-16 sm:pb-20">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] lg:gap-12">
          <ContactForm />
          <ContactInfo />
        </div>
      </div>

      <InstagramStrip
        posts={instagramPosts}
        title="What we've been posting"
        className="bx-measure bx-hair py-14 sm:py-20"
      />
    </div>
  );
}
