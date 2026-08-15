/**
 * Pure logic for resolving Visibility (see CONTEXT.md).
 *
 * Per ADR 0003 the precedence chain lives here, in application code, rather
 * than in RLS predicates — RLS only holds the coarse "this is my row" net.
 * Kept free of Next.js and Supabase imports so it can be unit tested directly.
 */

export type VisibilityLevel = "none" | "slots" | "open_time" | "calendar";

/**
 * Not a total order. `slots` and `open_time` are independent, incomparable
 * grants — one shares Slots without Availability Windows, the other shares
 * Availability Windows without Slots — and `calendar` is both together.
 * `none` is bottom, `calendar` is top; that's the whole order there is. This
 * array is only display order for the picker's option list; the actual
 * merge logic is `grantsOf`/`levelFromGrants` below, so adding a level means
 * updating those two (and the `visibility_level` enum), not this array.
 */
export const VISIBILITY_LEVELS: readonly VisibilityLevel[] = [
  "none",
  "slots",
  "open_time",
  "calendar",
];

type Grants = { slots: boolean; openTime: boolean };

const GRANTS_BY_LEVEL: Record<VisibilityLevel, Grants> = {
  none: { slots: false, openTime: false },
  slots: { slots: true, openTime: false },
  open_time: { slots: false, openTime: true },
  calendar: { slots: true, openTime: true },
};

function levelFromGrants(grants: Grants): VisibilityLevel {
  if (grants.slots && grants.openTime) {
    return "calendar";
  }
  if (grants.slots) {
    return "slots";
  }
  if (grants.openTime) {
    return "open_time";
  }
  return "none";
}

/**
 * What one friend can see.
 *
 * An explicit per-friend override wins outright, in both directions — it is
 * the only way to shut one person out without dismantling the group they are
 * in. Otherwise every one of their groups contributes whatever it grants, and
 * the grants union — so being in a `slots` group and an `open_time` group
 * gives the same access as being in one `calendar` group, and adding someone
 * to a more open group can only ever expand what they see, never retract it.
 */
export function resolveVisibility({
  groupLevels,
  override,
}: {
  groupLevels: VisibilityLevel[];
  override?: VisibilityLevel | null;
}): VisibilityLevel {
  if (override) {
    return override;
  }

  const grants = groupLevels.reduce<Grants>(
    (acc, level) => {
      const g = GRANTS_BY_LEVEL[level];
      return { slots: acc.slots || g.slots, openTime: acc.openTime || g.openTime };
    },
    { slots: false, openTime: false },
  );

  return levelFromGrants(grants);
}

export type FriendGroupDefault = {
  id: string;
  defaultVisibility: VisibilityLevel;
};

export type GroupMembership = { groupId: string; connectionId: string };

export type VisibilityOverride = {
  connectionId: string;
  level: VisibilityLevel;
};

/**
 * The resolved level for every one of the owner's accepted Connections.
 *
 * Driven by `connectionIds` rather than by the membership rows, so a friend in
 * no group still gets an entry. A caller reading a missing key as "unknown"
 * instead of "no access" is exactly the mistake this prevents.
 */
export function resolveVisibilityByConnection({
  connectionIds,
  groups,
  memberships,
  overrides,
}: {
  connectionIds: string[];
  groups: FriendGroupDefault[];
  memberships: GroupMembership[];
  overrides: VisibilityOverride[];
}): Map<string, VisibilityLevel> {
  const levelByGroup = new Map(
    groups.map((group) => [group.id, group.defaultVisibility]),
  );
  const overrideByConnection = new Map(
    overrides.map((override) => [override.connectionId, override.level]),
  );

  const groupLevelsByConnection = new Map<string, VisibilityLevel[]>();
  for (const membership of memberships) {
    const level = levelByGroup.get(membership.groupId);
    if (!level) {
      continue;
    }
    const levels = groupLevelsByConnection.get(membership.connectionId) ?? [];
    levels.push(level);
    groupLevelsByConnection.set(membership.connectionId, levels);
  }

  return new Map(
    connectionIds.map((connectionId) => [
      connectionId,
      resolveVisibility({
        groupLevels: groupLevelsByConnection.get(connectionId) ?? [],
        override: overrideByConnection.get(connectionId) ?? null,
      }),
    ]),
  );
}

export function isVisibilityLevel(value: unknown): value is VisibilityLevel {
  return VISIBILITY_LEVELS.includes(value as VisibilityLevel);
}
