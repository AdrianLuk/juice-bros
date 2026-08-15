/**
 * Pure input handling for the Friend Group actions.
 *
 * The Server Actions themselves are meant to be thin: verify the session, hand
 * the form to one of these, make the write, translate the failure. Everything
 * decidable without a database lives here so it can be unit tested directly,
 * per the seam note in booking-buddy/PROGRESS.md.
 *
 * Free of Next.js and Supabase imports on purpose. The limits mirror the
 * `friend_groups` migration — change one and you must change the other.
 */

import { isVisibilityLevel, type VisibilityLevel } from "./visibility.ts";

export const GROUP_NAME_MAX_LENGTH = 60;

export type NewGroup = { name: string; level: VisibilityLevel };

export function parseNewGroup(formData: FormData): NewGroup | { error: string } {
  // Trimmed because the unique index compares btrim(lower(name)): an untrimmed
  // name would collide with its own twin for reasons the User cannot see.
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "Give the group a name." };
  }

  if (name.length > GROUP_NAME_MAX_LENGTH) {
    return {
      error: `That name is too long — ${GROUP_NAME_MAX_LENGTH} characters at most.`,
    };
  }

  const level = formData.get("level");
  // Never defaulted. This control decides what other people can see, so a
  // value that didn't arrive must stop the write rather than pick for them.
  if (!isVisibilityLevel(level)) {
    return { error: "Pick what this group can see." };
  }

  return { name, level };
}

/**
 * A per-friend choice: a level, or a deliberate return to group defaults.
 *
 * `"clear"` is a word rather than an empty value so that a level which failed
 * to reach the server cannot be mistaken for "go back to the group default" —
 * that mistake would quietly change what someone can see.
 */
export function parseOverrideChoice(
  value: FormDataEntryValue | null,
): VisibilityLevel | "clear" | null {
  if (value === "clear") {
    return "clear";
  }

  return isVisibilityLevel(value) ? value : null;
}

export type GroupWrite = "create" | "add" | "remove" | "delete" | "update";

const FAILED: Record<GroupWrite, string> = {
  create: "Couldn't create that group. Try again.",
  add: "Couldn't add them to that group.",
  remove: "Couldn't remove them from that group.",
  delete: "Couldn't delete that group. Try again.",
  update: "Couldn't update that group.",
};

/** Turns a failed write into something worth reading. */
export function groupWriteMessage(
  error: { code?: string },
  write: GroupWrite,
): string {
  switch (error.code) {
    case "23505":
      return "You already have a group with that name.";
    case "23514":
      // Raised by the assert_groupable_connection trigger: the Connection is
      // still pending, or isn't one of yours.
      return "You can only group people you're already friends with.";
    default:
      return FAILED[write];
  }
}
