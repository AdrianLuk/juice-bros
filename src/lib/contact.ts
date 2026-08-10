export const contactReasons = [
  { value: "story", label: "Share a story from my courts" },
  { value: "guest-pitch", label: "Guest / interview pitch" },
  { value: "sponsorship", label: "Sponsorship or partnership" },
  { value: "club-feature", label: "Club or event feature" },
  { value: "hi", label: "Just saying hi" },
] as const;

export type ContactReason = (typeof contactReasons)[number]["value"];

export const contactReasonValues = contactReasons.map((r) => r.value);

export function isContactReason(value: unknown): value is ContactReason {
  return typeof value === "string" && (contactReasonValues as string[]).includes(value);
}
