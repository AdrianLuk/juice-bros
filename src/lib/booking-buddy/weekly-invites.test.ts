import assert from "node:assert/strict";
import test from "node:test";

import {
  planWeeklyInviteRun,
  type PlanWeeklyInviteRunInput,
  type PostedSlotForInvite,
} from "./weekly-invites.ts";
import { visibleText } from "./email-test-text.ts";

const ORIGIN = "https://juice.example";
const AMY = "amy";
const BEN = "ben";

function postedSlot(overrides: Partial<PostedSlotForInvite> = {}): PostedSlotForInvite {
  return {
    slotId: "slot-1",
    standingGameId: "weekly-1",
    ownerId: AMY,
    organizerName: "Amy Walters",
    // Tuesday Oct 13 2026, 8 to 10pm Toronto.
    proposedStart: "2026-10-14T00:00:00.000Z",
    proposedEnd: "2026-10-14T02:00:00.000Z",
    timeZone: "America/Toronto",
    ...overrides,
  };
}

function input(overrides: Partial<PlanWeeklyInviteRunInput> = {}): PlanWeeklyInviteRunInput {
  return {
    slots: [postedSlot()],
    regularsByGame: new Map([["weekly-1", [BEN]]]),
    connectedPairs: new Set([`${AMY}:${BEN}`]),
    inviteEnabledByUser: new Map(),
    pushEnabledByUser: new Map(),
    alreadySent: new Set(),
    subscriptionsByUser: new Map(),
    pushConfigured: true,
    origin: ORIGIN,
    ...overrides,
  };
}

const BEN_DEVICE = { id: "sub-1", endpoint: "https://push.example/1", p256dh: "k", auth: "a" };

test("a Regular with default preferences gets the Weekly Invite email linking to the game", () => {
  const { sends } = planWeeklyInviteRun(input());

  assert.equal(sends.length, 1);
  const [send] = sends;
  assert.equal(send.channel, "email");
  assert.equal(send.slotId, "slot-1");
  assert.equal(send.userId, BEN);
  if (send.channel === "email") {
    assert.match(send.subject, /Tue, Oct 13/);
    assert.match(send.html, /Amy Walters/);
    assert.match(send.html, /https:\/\/juice\.example\/booking-buddy\/slots\/slot-1/);
  }
});

test("a Regular with push on and a device gets a push as well as the email", () => {
  const { sends } = planWeeklyInviteRun(
    input({
      pushEnabledByUser: new Map([[BEN, true]]),
      subscriptionsByUser: new Map([[BEN, [BEN_DEVICE]]]),
    }),
  );

  assert.deepEqual(
    sends.map((send) => send.channel),
    ["email", "push"],
  );
  const push = sends[1];
  if (push.channel === "push") {
    assert.deepEqual(push.subscriptions, [BEN_DEVICE]);
    assert.equal(push.payload.url, `${ORIGIN}/booking-buddy/slots/slot-1`);
    assert.match(push.payload.body, /Amy Walters/);
  }
});

test("push off means email only, even with a device on file", () => {
  const { sends } = planWeeklyInviteRun(
    input({
      pushEnabledByUser: new Map([[BEN, false]]),
      subscriptionsByUser: new Map([[BEN, [BEN_DEVICE]]]),
    }),
  );

  assert.deepEqual(
    sends.map((send) => send.channel),
    ["email"],
  );
});

test("push on but no device on file sends no push", () => {
  const { sends } = planWeeklyInviteRun(input({ pushEnabledByUser: new Map([[BEN, true]]) }));

  assert.deepEqual(
    sends.map((send) => send.channel),
    ["email"],
  );
});

test("a deploy without push configured sends email only", () => {
  const { sends } = planWeeklyInviteRun(
    input({
      pushConfigured: false,
      pushEnabledByUser: new Map([[BEN, true]]),
      subscriptionsByUser: new Map([[BEN, [BEN_DEVICE]]]),
    }),
  );

  assert.deepEqual(
    sends.map((send) => send.channel),
    ["email"],
  );
});

test("the Weekly game invites preference off stops both channels", () => {
  const { sends } = planWeeklyInviteRun(
    input({
      inviteEnabledByUser: new Map([[BEN, false]]),
      pushEnabledByUser: new Map([[BEN, true]]),
      subscriptionsByUser: new Map([[BEN, [BEN_DEVICE]]]),
    }),
  );

  assert.deepEqual(sends, []);
});

test("a duplicate run sends nothing already recorded, per channel", () => {
  const pushOn = {
    pushEnabledByUser: new Map([[BEN, true]]),
    subscriptionsByUser: new Map([[BEN, [BEN_DEVICE]]]),
  };

  const both = planWeeklyInviteRun(
    input({ ...pushOn, alreadySent: new Set(["slot-1:ben:email", "slot-1:ben:push"]) }),
  );
  assert.deepEqual(both.sends, []);

  const emailOnly = planWeeklyInviteRun(input({ ...pushOn, alreadySent: new Set(["slot-1:ben:email"]) }));
  assert.deepEqual(
    emailOnly.sends.map((send) => send.channel),
    ["push"],
  );
});

test("a Regular who is no longer a Connection of the organizer is not invited", () => {
  const { sends } = planWeeklyInviteRun(input({ connectedPairs: new Set() }));

  assert.deepEqual(sends, []);
});

test("the organizer is never sent their own invite", () => {
  const { sends } = planWeeklyInviteRun(
    input({ regularsByGame: new Map([["weekly-1", [AMY, BEN]]]) }),
  );

  assert.deepEqual(
    sends.map((send) => send.userId),
    [BEN],
  );
});

test("each posted game invites its own Standing Game's Regulars only", () => {
  const { sends } = planWeeklyInviteRun(
    input({
      slots: [
        postedSlot(),
        postedSlot({ slotId: "slot-2", standingGameId: "weekly-2" }),
      ],
      regularsByGame: new Map([
        ["weekly-1", [BEN]],
        ["weekly-2", ["cal"]],
      ]),
      connectedPairs: new Set([`${AMY}:${BEN}`, `${AMY}:cal`]),
    }),
  );

  assert.deepEqual(
    sends.map((send) => `${send.slotId}:${send.userId}`),
    ["slot-1:ben", "slot-2:cal"],
  );
});

test("the invite copy says game, never slot, and carries no em-dash", () => {
  const { sends } = planWeeklyInviteRun(
    input({
      pushEnabledByUser: new Map([[BEN, true]]),
      subscriptionsByUser: new Map([[BEN, [BEN_DEVICE]]]),
    }),
  );
  const [email, push] = sends;
  assert.ok(email.channel === "email" && push.channel === "push");

  const read = [email.subject, visibleText(email.html), push.payload.title, push.payload.body].join(" ");
  assert.match(read, /game/);
  assert.doesNotMatch(read, /slot/i);
  assert.doesNotMatch(read, /\u2014/);
  assert.match(visibleText(email.html), /View the game/);
});
