import { NewsletterForm } from "@/components/newsletter-form";
import { SectionHeading } from "@/components/typography/section-heading";

export function Newsletter() {
  return (
    <section className="bg-brand-black text-white">
      <div className="flex w-full flex-col items-center gap-4 px-4 py-20 text-center sm:px-6 lg:px-8">
        <SectionHeading title="Get every episode in your inbox" />
        <p className="max-w-md text-white/70">
          New episodes, gear picks, and no spam. Straight from the Juice Bros.
        </p>
        <div className="mt-2 flex w-full justify-center [&_input]:bg-white/5 [&_input]:text-white [&_input]:border-white/20 [&_input]:placeholder:text-white/40">
          <NewsletterForm />
        </div>
      </div>
    </section>
  );
}
