"use client";

import { useEffect, useState, useTransition } from "react";

import {
  subscribeTurnNotifications,
  unsubscribeTurnNotifications,
} from "@/lib/on-deck/actions/turn-notify";

const SW_PATH = "/on-deck-sw.js";
const SW_SCOPE = "/on-deck";

/**
 * `PushManager.subscribe` wants the VAPID public key as a `Uint8Array` over a
 * real `ArrayBuffer`, not the base64url string it's issued as. Same helper as
 * Booking Buddy's `push-notifications.tsx`.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes;
}

type Support = "checking" | "unsupported" | "supported";

/**
 * The opt-in turn notification (issue #260): a one-tap enable on the Player's
 * own status screen, offered only under `self-serve` / `hybrid` Floor Mode
 * (the caller gates that). Off by default.
 *
 * Everything degrades silently — a browser that can't subscribe, a denied
 * permission, a deploy with no VAPID keys: the control just quietly stays off,
 * never an error. The Display and Kiosk remain the primary surface.
 */
export function TurnNotifications({
  sessionId,
  token,
}: {
  sessionId: string;
  token: string;
}) {
  const [support, setSupport] = useState<Support>("checking");
  const [enabled, setEnabled] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot feature-detection on mount
      setSupport("unsupported");
      return;
    }

    let cancelled = false;
    navigator.serviceWorker
      .getRegistration(SW_SCOPE)
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => {
        if (!cancelled) setEnabled(Boolean(subscription));
      })
      .catch(() => {
        // Nothing registered yet is the normal first-visit state.
      })
      .finally(() => {
        if (!cancelled) setSupport("supported");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const enable = () => {
    startTransition(async () => {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) return;

      try {
        const registration = await navigator.serviceWorker.register(SW_PATH, {
          scope: SW_SCOPE,
        });
        await navigator.serviceWorker.ready;

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          // Denied or dismissed — fail silent, the feature stays off.
          return;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        const json = subscription.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          return;
        }

        const result = await subscribeTurnNotifications(sessionId, token, {
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        });
        if (result.ok) setEnabled(true);
      } catch {
        // Any failure — the control just stays off.
      }
    });
  };

  const disable = () => {
    startTransition(async () => {
      try {
        const registration =
          await navigator.serviceWorker.getRegistration(SW_SCOPE);
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          const endpoint = subscription.endpoint;
          await subscription.unsubscribe();
          await unsubscribeTurnNotifications(endpoint);
        }
        setEnabled(false);
      } catch {
        // Leave it as-is.
      }
    });
  };

  if (support !== "supported") {
    // "checking" holds nothing; "unsupported" degrades silently — no message,
    // the Display is still there.
    return null;
  }

  return (
    <div className="mt-4 border-t pt-3" data-testid="turn-notify">
      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          disabled={pending}
          onChange={(event) => (event.target.checked ? enable() : disable())}
          className="h-5 w-5 shrink-0 rounded border-input accent-brand-orange"
        />
        <span className="font-medium">Buzz my phone when I&apos;m up</span>
      </label>
      <p className="mt-1.5 pl-7.5 text-xs text-muted-foreground">
        One buzz when your foursome is on deck, one when you&apos;re on a court.
        That&apos;s it.
      </p>
    </div>
  );
}
