import { NewsletterForm } from "@/components/newsletter-form";
import { SectionHeading } from "@/components/typography/section-heading";

export function Newsletter() {
  return (
    <section className="bg-brand-black text-white">
      <div className="flex w-full flex-col items-center gap-4 px-4 py-24 text-center sm:px-6 lg:px-8">
        <SectionHeading title="Get every episode in your inbox" />
        <p className="max-w-md text-white/60">
          New episodes, gear picks, and no spam. Straight from the Juice Bros.
        </p>
        <div className="mt-3 flex w-full justify-center [&_input]:h-12 [&_input]:rounded-full [&_input]:border-white/15 [&_input]:bg-white/5 [&_input]:px-5 [&_input]:text-white [&_input]:placeholder:text-white/40">
          <NewsletterForm />
        </div>
      </div>
    </section>
  );
}
