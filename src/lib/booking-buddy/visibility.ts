/**
 * Pure logic for resolving Visibility (see CONTEXT.md).
 *
 * Per ADR 0003 the precedence chain lives here, in application code, rather
 * than in RLS predicates — RLS only holds the coarse "this is my row" net.
 * Kept free of Next.js and Supabase imports so it can be unit tested directly.
 */

export type VisibilityLevel = "none" | "slots" | "calendar";

/**
 * Least to most permissive. The order is the whole model — "most permissive
 * wins" reads straight off this array, and so does the picker's option list,
 * so adding a level means inserting it in the right place here and in the
 * `visibility_level` enum, and nowhere else.
 */
export const VISIBILITY_LEVELS: readonly VisibilityLevel[] = [
  "none",
  "slots",
  "calendar",
];

const NO_VISIBILITY: VisibilityLevel = "none";

function isAtLeast(level: VisibilityLevel, required: VisibilityLevel): boolean {
  return VISIBILITY_LEVELS.indexOf(level) >= VISIBILITY_LEVELS.indexOf(required);
}

/**
 * What one friend can see.
 *
 * An explicit per-friend override wins outright, in both directions — it is
 * the only way to shut one person out without dismantling the group they are
 * in. Otherwise the most permissive of their groups applies, so adding someone
 * to a more open group can only ever expand what they see.
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

  return groupLevels.reduce<VisibilityLevel>(
    (best, level) => (isAtLeast(level, best) ? level : best),
    NO_VISIBILITY,
  );
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
