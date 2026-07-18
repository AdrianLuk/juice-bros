import type { Metadata } from "next";

import { ContactInfo } from "./sections/contact-info";

export const metadata: Metadata = {
  title: "Contact",
};

export default function ContactPage() {
  return (
    <div className="flex w-full flex-1 flex-col px-4 py-16 sm:px-6 lg:px-8">
      <ContactInfo />
    </div>
  );
}
