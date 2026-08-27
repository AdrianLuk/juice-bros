"use client";

import { useEffect, useState, useTransition } from "react";

import { Label } from "@/components/ui/label";
import {
  removePushSubscription,
  savePushSubscription,
} from "@/lib/booking-buddy/actions/push";

const SW_PATH = "/booking-buddy-sw.js";
const SW_SCOPE = "/booking-buddy";

/**
 * `PushManager.subscribe` wants the VAPID public key as a `Uint8Array` over a
 * real `ArrayBuffer`, not the base64url string it's issued as.
 * `Uint8Array.from` types as `Uint8Array<ArrayBufferLike>`, which `lib.dom`'s
 * `BufferSource` refuses (it also admits `SharedArrayBuffer`) — building the
 * backing `ArrayBuffer` explicitly avoids the mismatch.
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
 * The signed-in User's own opt-in for web push, on *this* device (issue
 * #12). Deliberately reads its checked state from the browser's own
 * subscription, not from `notification_preferences.push_enabled` — that
 * column is an account-wide "is push on for this User at all" flag, but a
 * subscription is per-device, and this control is asking "is push on for the
 * device I'm looking at right now."
 */
export function PushNotificationsForm() {
  const [support, setSupport] = useState<Support>("checking");
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot feature-detection on mount, not derived state
      setSupport("unsupported");
      return;
    }

    let cancelled = false;
    navigator.serviceWorker
      .getRegistration(SW_SCOPE)
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => {
        if (!cancelled) {
          setSubscribed(Boolean(subscription));
        }
      })
      .catch(() => {
        // Nothing registered yet is the normal first-visit state, not an error.
      })
      .finally(() => {
        if (!cancelled) {
          setSupport("supported");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const enable = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setError("Push notifications aren't set up yet.");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register(SW_PATH, {
          scope: SW_SCOPE,
        });
        await navigator.serviceWorker.ready;

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setError(
            "Notifications are blocked for this site. Allow them in your browser's site settings, then try again.",
          );
          return;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        const json = subscription.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          setError("Couldn't set up push on this browser. Try again.");
          return;
        }

        const result = await savePushSubscription({
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        });
        if (result.error) {
          setError(result.error);
          return;
        }

        setSubscribed(true);
        setSaved(true);
      } catch {
        setError("Couldn't enable push notifications. Try again.");
      }
    });
  };

  const disable = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
        const subscription = await registration?.pushManager.getSubscription();

        if (subscription) {
          const endpoint = subscription.endpoint;
          await subscription.unsubscribe();
          const result = await removePushSubscription(endpoint);
          if (result.error) {
            setError(result.error);
            return;
          }
        }

        setSubscribed(false);
        setSaved(true);
      } catch {
        setError("Couldn't turn off push notifications. Try again.");
      }
    });
  };

  if (support === "unsupported") {
    return (
      <p className="text-sm text-muted-foreground">
        Push notifications aren&apos;t supported in this browser. Email
        reminders still work.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          id="push-enabled"
          type="checkbox"
          checked={subscribed}
          disabled={support === "checking" || pending}
          onChange={(event) => (event.target.checked ? enable() : disable())}
          className="h-5 w-5 rounded border-input accent-primary"
        />
        <Label htmlFor="push-enabled" className="font-normal">
          Push me a reminder on this device
        </Label>
      </div>

      <p className="text-xs text-muted-foreground">
        On iPhone/iPad, add Booking Buddy to your home screen first (Share →
        Add to Home Screen). Safari only allows push notifications for
        installed apps.
      </p>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="text-sm text-muted-foreground" role="status">
          Saved.
        </p>
      )}
    </div>
  );
}
