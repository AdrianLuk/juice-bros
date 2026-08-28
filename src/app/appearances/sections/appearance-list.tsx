import type { Appearance } from "@/lib/appearances";
import { AppearanceRow } from "./appearance-row";

export function AppearanceList({ appearances }: { appearances: Appearance[] }) {
  if (appearances.length === 0) {
    return (
      <p className="mt-10 text-muted-foreground">
        Nothing on the calendar right now. We&apos;ll add tournaments here as we
        sign up, so check back.
      </p>
    );
  }

  return (
    <ul className="mt-10 flex flex-col gap-3">
      {appearances.map((appearance) => (
        <AppearanceRow key={appearance.name} appearance={appearance} />
      ))}
    </ul>
  );
}
