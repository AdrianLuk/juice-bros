import { SectionHeading } from "@/components/typography/section-heading";

type Bro = {
  name: string;
};

const bros: Bro[] = [{ name: "Daven" }, { name: "Adrian" }];

export function MeetTheBros() {
  return (
    <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
      <div className="border-t pt-16">
        <SectionHeading eyebrow="The Two Behind the Mic" title="Meet the Bros" />

        {/* eslint-disable-next-line @next/next/no-img-element -- local trusted asset, no next/image optimization needed */}
        <img
          src="/pictures/adrian-dav.jpg"
          alt="Daven and Adrian courtside, mid-match"
          width={2000}
          height={1333}
          className="mx-auto mt-8 aspect-video w-full max-w-3xl rounded-2xl border object-cover"
        />

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {bros.map((bro) => (
            <div
              key={bro.name}
              className="flex flex-col gap-2 rounded-xl border border-dashed p-6"
            >
              <p className="font-heading text-xl font-bold">{bro.name}</p>
              <p className="text-sm text-muted-foreground italic">
                Bio coming soon - in {bro.name}&apos;s own words.
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
