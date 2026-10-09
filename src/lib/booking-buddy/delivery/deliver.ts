/**
 * Booking Buddy's one delivery loop (spec #610): every Reminder, Booking
 * Reminder, Weekly Invite, Connection Request Email, Connection Accepted Email
 * and "it's off" email goes out
 * through `deliver`. The planners (`reminder-run.ts`, `weekly-invites.ts`)
 * decide who gets what; this carries the sends out — the address lookup, the
 * channel dispatch, pruning a dead push device, the best-effort send-log
 * write — and counts each one under one rule.
 *
 * Resend, web-push and Supabase sit behind four ports (address lookup, email
 * sender, push sender, log writer), so this file imports nothing and runs
 * under `node --test` with in-memory adapters. The real ones are thin files
 * beside it: `resend-sender.ts`, `web-push-sender.ts` (both `server-only`) and
 * `supabase-adapters.ts`.
 *
 * Never throws: a port that throws is logged and counts as that send failing
 * (or, for the log writer, as a log failure), so one bad recipient can't stop
 * the rest, and an unlogged caller from `after()` can't fail its request.
 */

/** One email to one User. The address is looked up here, not by the planner: no table exposes one. */
export type EmailSend = { channel: "email"; userId: string; subject: string; html: string };

/** One `push_subscriptions` row: one device. `id` rides along for the 404/410 prune. */
export type StoredPushSubscription = { id: string; endpoint: string; p256dh: string; auth: string };

/** One push to every device a User has registered. */
export type PushSend = {
  channel: "push";
  userId: string;
  subscriptions: readonly StoredPushSubscription[];
  /** Serialized by the push sender. */
  payload: unknown;
};

/** Callers pass their own send type (with a `slotId`, say); the log writer gets it back unchanged. */
export type PlannedSend = EmailSend | PushSend;

export type SendResult = { status: "ok" } | { status: "error"; error: unknown };

/** `gone`: the push service says the device is unregistered (404/410), so it is forgotten. */
export type PushResult = SendResult | { status: "gone" };

export type EmailSender = (email: {
  to: string;
  subject: string;
  html: string;
}) => Promise<SendResult>;

export type PushSender = {
  send(subscription: StoredPushSubscription, payload: unknown): Promise<PushResult>;
  /** Deletes a subscription the push service reported gone, so later runs stop trying it. */
  forget(subscriptionId: string): Promise<void>;
};

/** The User's address, or `null` when they have none. Throw on a lookup error. */
export type AddressLookup = (userId: string) => Promise<string | null>;

/**
 * Records a delivered send in its `*_sends` table. Resolves the insert's error
 * (or `null`); a `23505` means another run already recorded it, which is the
 * outcome wanted, so it counts as success.
 */
export type MarkSent<S> = (send: S) => Promise<{ code?: string } | null>;

export type DeliveryPorts<S extends PlannedSend> = {
  /** Prefixes every log line, e.g. `"send-reminders"`. */
  logTag: string;
  lookupAddress: AddressLookup;
  /** `null` when Resend isn't configured: every email is `skipped`. */
  sendEmail: EmailSender | null;
  /** `null` when the VAPID keys aren't configured: every push is `skipped`. */
  sendPush: PushSender | null;
  /** Leave out for the sends that keep no log (the two Connection emails and the "it's off" email). */
  markSent?: MarkSent<S>;
};

/**
 * Every planned send lands in exactly one:
 * - `sent`: the email was accepted, or at least one push device took it.
 * - `failed`: no address, a provider error, or every device failed.
 * - `skipped`: the channel isn't configured, or a push has no devices.
 */
export type DeliveryResult = { sent: number; failed: number; skipped: number };

type Outcome = keyof DeliveryResult;

export async function deliver<S extends PlannedSend>(
  sends: readonly S[],
  ports: DeliveryPorts<S>,
): Promise<DeliveryResult> {
  const result: DeliveryResult = { sent: 0, failed: 0, skipped: 0 };
  // One warning per unconfigured channel per run, not one per send.
  const warned = new Set<PlannedSend["channel"]>();

  for (const send of sends) {
    const attempt = attemptOnChannel(send, ports);
    if (attempt === null) {
      if (!warned.has(send.channel)) {
        warned.add(send.channel);
        console.warn(`${ports.logTag}: ${send.channel} is not configured, skipping it this run.`);
      }
      result.skipped += 1;
      continue;
    }

    let outcome: Outcome;
    try {
      outcome = await attempt();
    } catch (error) {
      console.error(`${ports.logTag}: sending to ${send.userId} failed`, error);
      outcome = "failed";
    }

    if (outcome === "sent" && ports.markSent) {
      await markSent(send, ports.markSent, ports.logTag);
    }
    result[outcome] += 1;
  }

  return result;
}

/** The send bound to its channel's port, or `null` when that channel isn't configured. */
function attemptOnChannel<S extends PlannedSend>(
  send: S,
  ports: DeliveryPorts<S>,
): (() => Promise<Outcome>) | null {
  if (send.channel === "email") {
    const sendEmail = ports.sendEmail;
    return sendEmail ? () => deliverEmail(send, sendEmail, ports) : null;
  }
  const sendPush = ports.sendPush;
  return sendPush ? () => deliverPush(send, sendPush, ports.logTag) : null;
}

async function deliverEmail(
  send: EmailSend,
  sendEmail: EmailSender,
  ports: Pick<DeliveryPorts<PlannedSend>, "logTag" | "lookupAddress">,
): Promise<Outcome> {
  const to = await ports.lookupAddress(send.userId);
  if (!to) {
    console.error(`${ports.logTag}: no email for recipient`, send.userId);
    return "failed";
  }

  const result = await sendEmail({ to, subject: send.subject, html: send.html });
  if (result.status === "error") {
    console.error(`${ports.logTag}: Resend error`, result.error);
    return "failed";
  }
  return "sent";
}

async function deliverPush(send: PushSend, sendPush: PushSender, logTag: string): Promise<Outcome> {
  // A User with push on but no device registered: nothing to send to, not a failure.
  if (send.subscriptions.length === 0) {
    return "skipped";
  }

  let anyDelivered = false;
  for (const subscription of send.subscriptions) {
    let result: PushResult;
    try {
      result = await sendPush.send(subscription, send.payload);
    } catch (error) {
      result = { status: "error", error };
    }

    if (result.status === "ok") {
      anyDelivered = true;
    } else if (result.status === "gone") {
      try {
        await sendPush.forget(subscription.id);
      } catch (error) {
        console.error(`${logTag}: forgetting a dead push device failed`, error);
      }
    } else {
      console.error(`${logTag}: web-push error`, result.error);
    }
  }
  return anyDelivered ? "sent" : "failed";
}

/** Best-effort: the message is already out, so a failed write is logged, never counted against it. */
async function markSent<S>(send: S, mark: MarkSent<S>, logTag: string): Promise<void> {
  try {
    const error = await mark(send);
    if (error && error.code !== "23505") {
      console.error(`${logTag}: recording the send failed`, error);
    }
  } catch (error) {
    console.error(`${logTag}: recording the send failed`, error);
  }
}
