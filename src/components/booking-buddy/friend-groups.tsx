"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PersonName } from "@/components/booking-buddy/connection-list";
import {
  FormSelect,
  VisibilitySelect,
  visibilityLabel,
} from "@/components/booking-buddy/visibility-select";
import { personLabel, personOptionLabel } from "@/lib/booking-buddy/connections";
import type { ConnectionPerson } from "@/lib/booking-buddy/actions/connections";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import {
  createFriendGroup,
  deleteFriendGroup,
  setFriendVisibilityOverride,
  setGroupMembership,
  setGroupVisibility,
  type FriendGroup,
  type FriendVisibility,
} from "@/lib/booking-buddy/actions/friend-groups";

const EMPTY: ActionResult = {};

function ActionError({ state }: { state: ActionResult }) {
  if (!state.error) {
    return null;
  }

  return (
    <p className="text-xs text-destructive" role="alert">
      {state.error}
    </p>
  );
}

export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState(createFriendGroup, EMPTY);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Label htmlFor="group-name">Group name</Label>
        <Input
          id="group-name"
          name="name"
          placeholder="Tuesday crew"
          maxLength={60}
          required
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Label htmlFor="group-level">What they can see</Label>
        <VisibilitySelect id="group-level" defaultValue="slots" />
      </div>
      <div className="flex flex-col items-start gap-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create group"}
        </Button>
        <ActionError state={state} />
      </div>
    </form>
  );
}

export function GroupCard({
  group,
  friends,
}: {
  group: FriendGroup;
  friends: ConnectionPerson[];
}) {
  const memberIds = new Set(group.members.map((member) => member.connectionId));
  const addable = friends.filter(
    (friend) => !memberIds.has(friend.connectionId),
  );

  return (
    <section className="rounded-lg border border-border">
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h3 className="truncate font-heading text-base font-semibold tracking-tight">
            {group.name}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {group.members.length === 1
              ? "1 friend"
              : `${group.members.length} friends`}
            {" · "}
            {visibilityLabel(group.defaultVisibility)}
          </p>
        </div>
        <DeleteGroupButton group={group} />
      </header>

      <div className="flex flex-col gap-5 px-5 py-4">
        <GroupVisibilityForm group={group} />

        {group.members.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {group.members.map((member) => (
              <li
                key={member.connectionId}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <PersonName person={member} />
                <RemoveMemberForm
                  groupId={group.id}
                  connectionId={member.connectionId}
                />
              </li>
            ))}
          </ul>
        )}

        <AddMemberForm groupId={group.id} addable={addable} />
      </div>
    </section>
  );
}

function GroupVisibilityForm({ group }: { group: FriendGroup }) {
  const [state, formAction, pending] = useActionState(setGroupVisibility, EMPTY);
  const selectId = `group-${group.id}-level`;

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="group_id" value={group.id} />
      <Label htmlFor={selectId}>What this group can see</Label>
      <div className="flex items-center gap-2">
        {/* Keyed on the saved value so a successful save remounts the
            select — see the note on BookingWindowForm in orgs.tsx. */}
        <VisibilitySelect
          key={group.defaultVisibility}
          id={selectId}
          defaultValue={group.defaultVisibility}
          className="flex-1"
        />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Anyone here with their own setting below keeps it — that always wins.
      </p>
      <ActionError state={state} />
    </form>
  );
}

function RemoveMemberForm({
  groupId,
  connectionId,
}: {
  groupId: string;
  connectionId: string;
}) {
  const [state, formAction, pending] = useActionState(setGroupMembership, EMPTY);

  return (
    <form action={formAction} className="flex shrink-0 flex-col items-end gap-1">
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="connection_id" value={connectionId} />
      <input type="hidden" name="member" value="no" />
      <Button type="submit" size="sm" variant="destructive" disabled={pending}>
        {pending ? "Removing…" : "Remove"}
      </Button>
      <ActionError state={state} />
    </form>
  );
}

function AddMemberForm({
  groupId,
  addable,
}: {
  groupId: string;
  addable: ConnectionPerson[];
}) {
  const [state, formAction, pending] = useActionState(setGroupMembership, EMPTY);
  const selectId = `group-${groupId}-add`;

  if (addable.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Everyone you&apos;re connected to is already in this group.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="member" value="yes" />
      <Label htmlFor={selectId}>Add a friend</Label>
      <div className="flex items-center gap-2">
        <FormSelect
          id={selectId}
          name="connection_id"
          defaultValue=""
          required
          className="flex-1"
        >
          <option value="" disabled>
            Pick someone
          </option>
          {addable.map((friend) => (
            <option key={friend.connectionId} value={friend.connectionId}>
              {personOptionLabel(friend)}
            </option>
          ))}
        </FormSelect>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
      <ActionError state={state} />
    </form>
  );
}

function DeleteGroupButton({ group }: { group: FriendGroup }) {
  const [state, formAction, pending] = useActionState(deleteFriendGroup, EMPTY);

  // The form lives inside the dialog so the confirm button is the only thing
  // that can submit it — the same shape as removing a friend.
  const form = (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="group_id" value={group.id} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Deleting…" : "Delete group"}
      </Button>
      <ActionError state={state} />
    </form>
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button size="sm" variant="ghost" />}>
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{group.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            Everyone in it stays your friend, but they&apos;ll drop back to
            whatever your other groups give them — which may be nothing.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep group</AlertDialogCancel>
          {form}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function FriendVisibilityRow({ friend }: { friend: FriendVisibility }) {
  const [state, formAction, pending] = useActionState(
    setFriendVisibilityOverride,
    EMPTY,
  );
  const selectId = `friend-${friend.person.connectionId}-level`;

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <PersonName person={friend.person} />
        <p className="mt-0.5 text-xs text-muted-foreground">
          {friend.override
            ? `Set just for them: ${visibilityLabel(friend.resolved)}`
            : `From your groups: ${visibilityLabel(friend.resolved)}`}
        </p>
      </div>

      <form action={formAction} className="flex flex-col items-stretch gap-1 sm:items-end">
        <input
          type="hidden"
          name="connection_id"
          value={friend.person.connectionId}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor={selectId} className="sr-only">
            What {personLabel(friend.person)} can see
          </Label>
          {/* Keyed on the saved value so a successful save remounts the
              select — see the note on BookingWindowForm in orgs.tsx. */}
          <VisibilitySelect
            key={friend.override ?? "clear"}
            id={selectId}
            defaultValue={friend.override ?? "clear"}
            extraOptions={[{ value: "clear", label: "Use my group defaults" }]}
            className="sm:w-56"
          />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
        <ActionError state={state} />
      </form>
    </li>
  );
}
