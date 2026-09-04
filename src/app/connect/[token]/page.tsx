import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { cn } from "@/lib/utils";
import { PageHeading } from "@/components/typography/page-heading";
import { buttonVariants } from "@/components/ui/button";
import { BOOKING_BUDDY_ROOT, FRIENDS_PATH } from "@/lib/booking-buddy/routes";
import { getConnectionRequestByToken } from "@/lib/booking-buddy/connection-request-notify";
import { respondToConnectionRequestAction } from "@/lib/booking-buddy/actions/connection-invites";
import {
  CONNECTION_VISIBILITY_NOTICE,
  CONNECTION_ACCEPTED_VISIBILITY_NOTICE,
} from "@/lib/booking-buddy/connection-copy";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;

  return {
    ...pageMetadata({
      title: "Friend request",
      description: "Someone wants to connect with you on Booking Buddy.",
      path: `/connect/${token}`,
    }),
    // Meant for whoever holds the link, not for search engines.
    robots: { index: false, follow: false },
  };
}

/** The terminal states — after acting, or landing on a link that's already spent. */
const DONE_COPY: Record<string, { title: string; description: string }> = {
  accepted: {
    title: "You're connected",
    description: CONNECTION_ACCEPTED_VISIBILITY_NOTICE,
  },
  declined: {
    title: "Request declined",
    description: "Nothing was shared, and they aren't told. That's the end of it.",
  },
  "already-handled": {
    title: "This one's already sorted",
    description:
      "This request was accepted, declined, or cancelled already. Nothing more to do here.",
  },
  invalid: {
    title: "This link isn't valid",
    description:
      "It may be mistyped, or the request may have been cancelled. Ask them to send a new one.",
  },
  failed: {
    title: "Something went wrong",
    description:
      "That didn't go through, and nothing was changed. Try the link again, or open your Friends page.",
  },
};

function Shell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <PageHeading eyebrow="Booking Buddy" title={title} description={description} />
          {children}
        </div>
      </section>
    </div>
  );
}

function FriendsLink({ label = "Go to your Friends page" }: { label?: string }) {
  return (
    <div className="mt-8">
      <Link
        href={FRIENDS_PATH}
        className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
      >
        {label}
      </Link>
    </div>
  );
}

export default async function ConnectPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;

  if (done) {
    const copy = DONE_COPY[done] ?? DONE_COPY.failed;
    return (
      <Shell title={copy.title} description={copy.description}>
        <FriendsLink />
      </Shell>
    );
  }

  const request = await getConnectionRequestByToken(token);

  if (!request) {
    return (
      <Shell
        title={DONE_COPY.invalid.title}
        description={DONE_COPY.invalid.description}
      >
        <p className="mt-6 text-sm text-muted-foreground">
          Already on Booking Buddy?{" "}
          <Link
            href={BOOKING_BUDDY_ROOT}
            className="text-foreground underline underline-offset-2"
          >
            Open the app
          </Link>
          .
        </p>
      </Shell>
    );
  }

  if (request.state === "handled") {
    return (
      <Shell
        title={DONE_COPY["already-handled"].title}
        description={DONE_COPY["already-handled"].description}
      >
        <FriendsLink />
      </Shell>
    );
  }

  return (
    <Shell
      title={`${request.requesterLabel} wants to connect`}
      description={`On Booking Buddy, connecting is mutual. ${CONNECTION_VISIBILITY_NOTICE}`}
    >
      <form action={respondToConnectionRequestAction} className="mt-8 flex flex-wrap gap-3">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          name="a"
          value="accept"
          className={cn(buttonVariants({ variant: "default", size: "lg" }))}
        >
          Accept
        </button>
        <button
          type="submit"
          name="a"
          value="decline"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          Decline
        </button>
      </form>
      <p className="mt-4 text-xs text-muted-foreground">
        This link works once. If you don&apos;t recognise the name, Decline is safe.
      </p>
    </Shell>
  );
}
