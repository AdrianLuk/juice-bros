import { personLabel } from "@/lib/booking-buddy/connections";
import type { ConnectionPerson } from "@/lib/booking-buddy/actions/connections";

/**
 * A titled list of people, used for all three friends-page sections. The
 * buttons differ per section, so they are passed in rather than branched on.
 */
export function ConnectionList({
  title,
  description,
  people,
  emptyMessage,
  renderActions,
}: {
  title: string;
  description?: string;
  people: ConnectionPerson[];
  emptyMessage?: string;
  renderActions: (person: ConnectionPerson) => React.ReactNode;
}) {
  // Sections that are only noise when empty (pending requests) pass no empty
  // message and disappear entirely.
  if (people.length === 0 && !emptyMessage) {
    return null;
  }

  return (
    <section>
      <h2 className="bb-h text-[1.05rem]">
        {title}
        {people.length > 0 && (
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {people.length}
          </span>
        )}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}

      {people.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-4 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border/60 overflow-hidden bb-card">
          {people.map((person) => (
            <li
              key={person.connectionId}
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <PersonName person={person} />
              <div className="flex shrink-0 items-start gap-2">
                {renderActions(person)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PersonName({
  person,
}: {
  person: { displayName: string | null; username: string | null };
}) {
  const name = personLabel(person);

  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium">{name}</p>
      {/* Shown whenever it isn't already the name: two Users can share a
          display name, and the handle is what tells them apart. */}
      {person.username && person.username !== name && (
        <p className="truncate text-xs text-muted-foreground">
          @{person.username}
        </p>
      )}
    </div>
  );
}
