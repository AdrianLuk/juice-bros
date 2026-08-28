import type { Appearance } from "@/lib/appearances";
import { SectionHeading } from "@/components/typography/section-heading";
import { AppearanceRow } from "./appearance-row";

export function UpcomingAppearances({ appearances }: { appearances: Appearance[] }) {
  return (
    <section className="mt-14">
      <SectionHeading title="Upcoming" weight="semibold" />
      {appearances.length === 0 ? (
        <p className="mt-4 text-muted-foreground">
          Nothing on the calendar right now. We&apos;ll add tournaments here as we
          sign up, so check back.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {appearances.map((appearance) => (
            <AppearanceRow key={appearance.name} appearance={appearance} />
          ))}
        </ul>
      )}
    </section>
  );
}
