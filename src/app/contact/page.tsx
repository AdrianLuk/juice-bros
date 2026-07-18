import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { ContactInfo } from "./sections/contact-info";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description:
    "Get in touch with Juice Bros Pickleball - questions, guest pitches, sponsorships, and more.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <div className="flex w-full flex-1 flex-col px-4 py-16 sm:px-6 lg:px-8">
      <ContactInfo />
    </div>
  );
}
