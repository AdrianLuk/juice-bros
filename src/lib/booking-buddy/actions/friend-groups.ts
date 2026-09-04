"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { FRIENDS_PATH, GROUPS_PATH } from "../routes.ts";
import { readFailed, type ActionResult } from "./result.ts";
import { listConnections, type ConnectionPerson } from "./connections.ts";
import {
  isVisibilityLevel,
  resolveVisibilityByConnection,
  type VisibilityLevel,
} from "../visibility.ts";
import {
  groupWriteMessage,
  parseNewGroup,
  parseOverrideChoice,
} from "../friend-groups.ts";

export type { ActionResult } from "./result.ts";

export type FriendGroup = {
  id: string;
  name: string;
  defaultVisibility: VisibilityLevel;
  members: ConnectionPerson[];
};

export type FriendVisibility = {
  person: ConnectionPerson;
  /** What they actually see, after groups and any override are applied. */
  resolved: VisibilityLevel;
  /** Set only when the owner has pinned a level for this one friend. */
  override: VisibilityLevel | null;
};

export type GroupsPageData = {
  groups: FriendGroup[];
  friends: ConnectionPerson[];
};

/**
 * Everything the groups page renders: the owner's Friend Groups with their
 * members, and the friends available to add to one.
 *
 * Per-friend resolved Visibility lives on the friends page instead — see
 * `getFriendVisibilityList` — so this doesn't need the overrides table at all.
 */
export async function getGroupsPageData(): Promise<GroupsPageData> {
  await verifySession();
  const supabase = await createClient();

  const { friends } = await listConnections();

  const [groupsResult, membersResult] = await Promise.all([
    supabase
      .from("friend_groups")
      .select("id, name, default_visibility")
      .order("name"),
    supabase.from("friend_group_members").select("group_id, connection_id"),
  ]);

  if (groupsResult.error) {
    readFailed("your friend groups", groupsResult.error);
  }
  if (membersResult.error) {
    readFailed("who is in your friend groups", membersResult.error);
  }

  const groupRows = groupsResult.data ?? [];
  const memberRows = membersResult.data ?? [];

  const personByConnection = new Map(
    friends.map((person) => [person.connectionId, person]),
  );

  return {
    groups: groupRows.map((group) => ({
      id: group.id,
      name: group.name,
      defaultVisibility: group.default_visibility as VisibilityLevel,
      members: memberRows
        .filter((row) => row.group_id === group.id)
        // A membership can outlive the friends list within one render if the
        // Connection was just removed; dropping it beats rendering a blank row.
        .flatMap((row) => personByConnection.get(row.connection_id) ?? []),
    })),
    friends,
  };
}

/**
 * Every friend's resolved Visibility, for the friends page's combined friends
 * list — what they actually see, after Friend Groups and any override are
 * applied.
 *
 * Takes the friends the caller already has (from `getFriendsPageData`) rather
 * than fetching Connections again itself — the friends page renders one list
 * merging both, so a second `connections` query here would be redundant.
 *
 * Read as four queries and joined here rather than in SQL, because the
 * precedence chain that turns them into a level lives in application code
 * (ADR 0003) and is unit tested there. The fourth is the owner's own
 * `default_friend_visibility` — the floor the chain starts from (ADR 0021),
 * without which every ungrouped friend would resolve to `none` here while the
 * database happily showed them the calendar.
 */
export async function getFriendVisibilityList(
  friends: ConnectionPerson[],
): Promise<FriendVisibility[]> {
  const session = await verifySession();
  const supabase = await createClient();

  const [defaultResult, groupsResult, membersResult, overridesResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("default_friend_visibility")
        .eq("id", session.userId)
        .single(),
      supabase.from("friend_groups").select("id, default_visibility"),
      supabase.from("friend_group_members").select("group_id, connection_id"),
      supabase
        .from("visibility_overrides")
        .select("connection_id, level")
        .eq("owner_id", session.userId),
    ]);

  if (defaultResult.error) {
    readFailed("what your friends see by default", defaultResult.error);
  }
  if (groupsResult.error) {
    readFailed("your friend groups", groupsResult.error);
  }
  if (membersResult.error) {
    readFailed("who is in your friend groups", membersResult.error);
  }
  if (overridesResult.error) {
    readFailed("your per-friend visibility settings", overridesResult.error);
  }

  const defaultLevel = defaultResult.data?.default_friend_visibility;
  // `not null` with a `calendar` default in the schema, so this only trips if
  // the row went missing between the two reads. Failing loudly beats picking a
  // floor for the User: guessing high leaks, guessing low silently hides
  // friends the database is still showing.
  if (!isVisibilityLevel(defaultLevel)) {
    readFailed("what your friends see by default", defaultLevel);
  }

  const groupRows = groupsResult.data ?? [];
  const memberRows = membersResult.data ?? [];
  const overrideRows = (overridesResult.data ?? []).map((row) => ({
    connectionId: row.connection_id,
    level: row.level as VisibilityLevel,
  }));

  const resolved = resolveVisibilityByConnection({
    defaultLevel,
    connectionIds: friends.map((person) => person.connectionId),
    groups: groupRows.map((group) => ({
      id: group.id,
      defaultVisibility: group.default_visibility as VisibilityLevel,
    })),
    memberships: memberRows.map((row) => ({
      groupId: row.group_id,
      connectionId: row.connection_id,
    })),
    overrides: overrideRows,
  });

  const overrideByConnection = new Map(
    overrideRows.map((row) => [row.connectionId, row.level]),
  );

  return friends.map((person) => ({
    person,
    resolved: resolved.get(person.connectionId) ?? defaultLevel,
    override: overrideByConnection.get(person.connectionId) ?? null,
  }));
}

export async function createFriendGroup(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const parsed = parseNewGroup(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("friend_groups").insert({
    owner_id: session.userId,
    name: parsed.name,
    default_visibility: parsed.level,
  });

  if (error) {
    return { error: groupWriteMessage(error, "create") };
  }

  revalidatePath(GROUPS_PATH);
  return { ok: true };
}

export async function deleteFriendGroup(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();
  const groupId = String(formData.get("group_id") ?? "");

  const supabase = await createClient();
  // Selecting the deleted row is what distinguishes "gone" from "RLS matched
  // nothing" — a delete naming a group that isn't yours succeeds with zero
  // rows, and reporting that as done would be a lie.
  const { data, error } = await supabase
    .from("friend_groups")
    .delete()
    .eq("id", groupId)
    .select("id");

  if (error || !data?.length) {
    return { error: groupWriteMessage(error ?? {}, "delete") };
  }

  revalidatePath(GROUPS_PATH);
  return { ok: true };
}

/**
 * Change what a group's members can see by default. Anyone in the group with
 * a per-friend override is unaffected — the override still wins.
 */
export async function setGroupVisibility(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();
  const groupId = String(formData.get("group_id") ?? "");
  const level = parseOverrideChoice(formData.get("level"));

  if (!level || level === "clear") {
    return { error: "Pick a visibility level." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("friend_groups")
    .update({ default_visibility: level })
    .eq("id", groupId)
    .select("id");

  if (error || !data?.length) {
    return { error: groupWriteMessage(error ?? {}, "update") };
  }

  revalidatePath(GROUPS_PATH);
  return { ok: true };
}

/**
 * Put a friend in a group, or take them out of it — one action, because the
 * form is one control with two states.
 *
 * The database refuses a Connection that isn't accepted, or one the group's
 * owner isn't party to, so this doesn't re-check either.
 */
export async function setGroupMembership(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();
  const groupId = String(formData.get("group_id") ?? "");
  const connectionId = String(formData.get("connection_id") ?? "");
  const shouldBeMember = formData.get("member") === "yes";

  if (!groupId || !connectionId) {
    return { error: "Pick a friend to add." };
  }

  const supabase = await createClient();

  // Both branches select the row back, so a write that RLS filtered down to
  // nothing reports a failure rather than a cheerful no-op.
  const { data, error } = shouldBeMember
    ? await supabase
        .from("friend_group_members")
        .upsert(
          { group_id: groupId, connection_id: connectionId },
          { onConflict: "group_id,connection_id" },
        )
        .select("group_id")
    : await supabase
        .from("friend_group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("connection_id", connectionId)
        .select("group_id");

  if (error || !data?.length) {
    return {
      error: groupWriteMessage(error ?? {}, shouldBeMember ? "add" : "remove"),
    };
  }

  revalidatePath(GROUPS_PATH);
  return { ok: true };
}

/**
 * Pin one friend's Visibility, or clear the pin and fall back to their groups.
 *
 * `"clear"` is a distinct value rather than an empty string, so a level that
 * failed to reach the server can't be mistaken for a deliberate "back to
 * group defaults".
 */
export async function setFriendVisibilityOverride(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();
  const connectionId = String(formData.get("connection_id") ?? "");
  const choice = parseOverrideChoice(formData.get("level"));

  if (!connectionId) {
    return { error: "Pick a friend." };
  }

  if (!choice) {
    return { error: "Pick a visibility level." };
  }

  const supabase = await createClient();

  if (choice === "clear") {
    // No row-count check here, unlike the writes above: clearing an override
    // that was never set is the state the User asked for, not a failure.
    const { error } = await supabase
      .from("visibility_overrides")
      .delete()
      .eq("owner_id", session.userId)
      .eq("connection_id", connectionId);

    if (error) {
      return { error: "Couldn't go back to the group default." };
    }

    revalidatePath(FRIENDS_PATH);
    return { ok: true };
  }

  const { error } = await supabase.from("visibility_overrides").upsert(
    { owner_id: session.userId, connection_id: connectionId, level: choice },
    { onConflict: "owner_id,connection_id" },
  );

  if (error) {
    return { error: "Couldn't set that. Try again." };
  }

  revalidatePath(FRIENDS_PATH);
  return { ok: true };
}
