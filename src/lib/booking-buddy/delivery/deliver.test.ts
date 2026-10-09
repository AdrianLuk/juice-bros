import assert from "node:assert/strict";
import { test } from "node:test";

import { deliver, type DeliveryPorts, type PlannedSend, type PushSender } from "./deliver.ts";

type TestSend = PlannedSend & { slotId: string };

/** In-memory stand-ins for Resend, web-push, the address lookup and a `*_sends` table. */
function inMemoryPorts(overrides: Partial<DeliveryPorts<TestSend>> = {}) {
  const emails: { to: string; subject: string; html: string }[] = [];
  const marked: TestSend[] = [];
  const ports: DeliveryPorts<TestSend> = {
    logTag: "test-run",
    lookupAddress: async (userId) => `${userId}@example.com`,
    sendEmail: async (email) => {
      emails.push(email);
      return { status: "ok" };
    },
    sendPush: null,
    markSent: async (send) => {
      marked.push(send);
      return null;
    },
    ...overrides,
  };
  return { ports, emails, marked };
}

const email: TestSend = {
  channel: "email",
  slotId: "slot-1",
  userId: "ben",
  subject: "Tuesday at 7",
  html: "<p>See you there</p>",
};

test("an email the provider accepts is sent to the User's address, marked sent and counted", async () => {
  const { ports, emails, marked } = inMemoryPorts();

  const result = await deliver([email], ports);

  assert.deepEqual(result, { sent: 1, failed: 0, skipped: 0 });
  assert.deepEqual(emails, [
    { to: "ben@example.com", subject: "Tuesday at 7", html: "<p>See you there</p>" },
  ]);
  assert.deepEqual(marked, [email]);
});

test("a User with no address fails without sending or marking anything", async (t) => {
  t.mock.method(console, "error", () => {});
  const { ports, emails, marked } = inMemoryPorts({ lookupAddress: async () => null });

  const result = await deliver([email], ports);

  assert.deepEqual(result, { sent: 0, failed: 1, skipped: 0 });
  assert.deepEqual(emails, []);
  assert.deepEqual(marked, []);
});

test("an email the provider rejects fails and is not marked sent", async (t) => {
  t.mock.method(console, "error", () => {});
  const { ports, marked } = inMemoryPorts({
    sendEmail: async () => ({ status: "error", error: new Error("rate limited") }),
  });

  const result = await deliver([email], ports);

  assert.deepEqual(result, { sent: 0, failed: 1, skipped: 0 });
  assert.deepEqual(marked, []);
});

test("a send another run already logged (23505) still counts as sent, and is sent once", async (t) => {
  const errors = t.mock.method(console, "error", () => {});
  const { ports, emails } = inMemoryPorts();
  let marks = 0;
  ports.markSent = async () => {
    marks += 1;
    return { code: "23505" };
  };

  const result = await deliver([email], ports);

  assert.deepEqual(result, { sent: 1, failed: 0, skipped: 0 });
  assert.equal(emails.length, 1);
  assert.equal(marks, 1);
  assert.equal(errors.mock.callCount(), 0);
});

test("a failed log write is reported but the delivered send still counts as sent", async (t) => {
  const errors = t.mock.method(console, "error", () => {});
  const { ports } = inMemoryPorts({ markSent: async () => ({ code: "42501" }) });

  const result = await deliver([email], ports);

  assert.deepEqual(result, { sent: 1, failed: 0, skipped: 0 });
  assert.equal(errors.mock.callCount(), 1);
});

test("with no Resend key every email is skipped, with one warning for the whole run", async (t) => {
  const warnings = t.mock.method(console, "warn", () => {});
  const { ports, marked } = inMemoryPorts({ sendEmail: null });
  const lookups: string[] = [];
  ports.lookupAddress = async (userId) => {
    lookups.push(userId);
    return `${userId}@example.com`;
  };

  const result = await deliver([email, { ...email, userId: "anna" }], ports);

  assert.deepEqual(result, { sent: 0, failed: 0, skipped: 2 });
  assert.equal(warnings.mock.callCount(), 1);
  assert.deepEqual(lookups, []);
  assert.deepEqual(marked, []);
});

/** A push sender whose devices answer from `outcomes` (by device id), recording what it forgot. */
function pushSender(outcomes: Record<string, "ok" | "gone" | "error">) {
  const delivered: { deviceId: string; payload: unknown }[] = [];
  const forgotten: string[] = [];
  const sender: PushSender = {
    send: async (device, payload) => {
      const outcome = outcomes[device.id];
      if (outcome === "error") {
        return { status: "error", error: new Error("push service 500") };
      }
      if (outcome === "ok") {
        delivered.push({ deviceId: device.id, payload });
      }
      return { status: outcome };
    },
    forget: async (deviceId) => {
      forgotten.push(deviceId);
    },
  };
  return { sender, delivered, forgotten };
}

function device(id: string) {
  return { id, endpoint: `https://push.example/${id}`, p256dh: "p256dh", auth: "auth" };
}

function push(...deviceIds: string[]): TestSend {
  return {
    channel: "push",
    slotId: "slot-1",
    userId: "ben",
    subscriptions: deviceIds.map(device),
    payload: { title: "Tuesday at 7" },
  };
}

test("a push that reaches one of the User's devices is sent and marked once", async (t) => {
  t.mock.method(console, "error", () => {});
  const { sender, delivered } = pushSender({ phone: "ok", laptop: "error" });
  const { ports, marked } = inMemoryPorts({ sendPush: sender });

  const result = await deliver([push("phone", "laptop")], ports);

  assert.deepEqual(result, { sent: 1, failed: 0, skipped: 0 });
  assert.deepEqual(delivered, [{ deviceId: "phone", payload: { title: "Tuesday at 7" } }]);
  assert.equal(marked.length, 1);
});

test("a device the push service reports gone (404/410) is forgotten", async () => {
  const { sender, forgotten } = pushSender({ phone: "ok", "old-tablet": "gone" });
  const { ports } = inMemoryPorts({ sendPush: sender });

  const result = await deliver([push("phone", "old-tablet")], ports);

  assert.deepEqual(result, { sent: 1, failed: 0, skipped: 0 });
  assert.deepEqual(forgotten, ["old-tablet"]);
});

test("a push no device took fails, is not marked sent, and only forgets the gone devices", async (t) => {
  t.mock.method(console, "error", () => {});
  const { sender, forgotten } = pushSender({ phone: "error", "old-tablet": "gone" });
  const { ports, marked } = inMemoryPorts({ sendPush: sender });

  const result = await deliver([push("phone", "old-tablet")], ports);

  assert.deepEqual(result, { sent: 0, failed: 1, skipped: 0 });
  assert.deepEqual(marked, []);
  assert.deepEqual(forgotten, ["old-tablet"]);
});

test("a push to a User with no devices is skipped", async () => {
  const { sender } = pushSender({});
  const { ports, marked } = inMemoryPorts({ sendPush: sender });

  const result = await deliver([push()], ports);

  assert.deepEqual(result, { sent: 0, failed: 0, skipped: 1 });
  assert.deepEqual(marked, []);
});

test("with no VAPID keys pushes are skipped with one warning, and email still goes", async (t) => {
  const warnings = t.mock.method(console, "warn", () => {});
  const { ports, emails } = inMemoryPorts({ sendPush: null });

  const result = await deliver([push("phone"), email, push("laptop")], ports);

  assert.deepEqual(result, { sent: 1, failed: 0, skipped: 2 });
  assert.equal(emails.length, 1);
  assert.equal(warnings.mock.callCount(), 1);
});

test("a port that throws fails that one send and the run carries on", async (t) => {
  t.mock.method(console, "error", () => {});
  const { ports, emails } = inMemoryPorts();
  ports.lookupAddress = async (userId) => {
    if (userId === "ben") {
      throw new Error("auth admin API down");
    }
    return `${userId}@example.com`;
  };

  const result = await deliver([email, { ...email, userId: "anna" }], ports);

  assert.deepEqual(result, { sent: 1, failed: 1, skipped: 0 });
  assert.deepEqual(
    emails.map((sent) => sent.to),
    ["anna@example.com"],
  );
});

test("a send with no log writer is delivered and counted the same", async () => {
  const { ports, emails } = inMemoryPorts({ markSent: undefined });

  const result = await deliver([email], ports);

  assert.deepEqual(result, { sent: 1, failed: 0, skipped: 0 });
  assert.equal(emails.length, 1);
});
