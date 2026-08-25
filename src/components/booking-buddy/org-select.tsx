import { FormSelect } from "@/components/booking-buddy/visibility-select";
import type { Org } from "@/lib/booking-buddy/actions/orgs";

/**
 * The Booking form's own Org picker, extracted (issue #64) so the "Sync from
 * Email" review screen can prefill it with a matched Org, or leave it for the
 * User to pick, without a second copy of this markup drifting from the
 * original. No hooks of its own, so it needs no "use client" — it's plain
 * enough to render from either a client or server tree.
 */
export function OrgSelect({
  id,
  name = "org_id",
  orgs,
  defaultValue = "",
  required = true,
}: {
  id: string;
  name?: string;
  orgs: Org[];
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <FormSelect id={id} name={name} defaultValue={defaultValue} required={required}>
      <option value="" disabled>
        Pick a facility
      </option>
      {orgs.map((org) => (
        <option key={org.id} value={org.id}>
          {org.displayName}
        </option>
      ))}
    </FormSelect>
  );
}

/**
 * The same picker, for a field where no facility is a real, first-class
 * choice rather than something still being decided — the Slot's own intended
 * Org (issue #36), settable on the detail page and at creation alike. Unlike
 * `OrgSelect`'s placeholder, "Not set" isn't `disabled`: it has to stay
 * reachable so an already-set facility can be cleared back to unset.
 */
export function OptionalOrgSelect({
  id,
  name = "org_id",
  orgs,
  defaultValue = "",
  className,
}: {
  id: string;
  name?: string;
  orgs: Org[];
  defaultValue?: string;
  className?: string;
}) {
  return (
    <FormSelect id={id} name={name} defaultValue={defaultValue} className={className}>
      <option value="">Not set</option>
      {orgs.map((org) => (
        <option key={org.id} value={org.id}>
          {org.displayName}
        </option>
      ))}
    </FormSelect>
  );
}
