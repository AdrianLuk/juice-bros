/**
 * Pure logic for reading a User's Connections.
 *
 * A Connection is symmetric — one row covers the pair in both directions — so
 * the same row means different things depending on who is looking at it. This
 * module turns rows into the three lists the friends page shows, and is kept
 * free of Next.js and Supabase imports so it can be unit tested directly.
 */

export type ConnectionStatus = "pending" | "accepted";

/** A `public.connections` row, as selected. */
export type ConnectionRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  created_at: string;
};

export type ConnectionEntry = {
  connectionId: string;
  /** The other party — the viewer is never their own friend. */
  otherUserId: string;
  createdAt: string;
};

export type GroupedConnections = {
  /** Accepted, whichever side asked. */
  friends: ConnectionEntry[];
  /** Pending, waiting on the viewer to answer. */
  received: ConnectionEntry[];
  /** Pending, waiting on the other person. */
  sent: ConnectionEntry[];
};

export function groupConnections(
  rows: ConnectionRow[],
  viewerId: string,
): GroupedConnections {
  const grouped: GroupedConnections = { friends: [], received: [], sent: [] };

  for (const row of rows) {
    const isRequester = row.requester_id === viewerId;
    const isAddressee = row.addressee_id === viewerId;

    // RLS already scopes the select to the viewer's own Connections. Dropping
    // anything else means a lapse there shows nothing rather than someone
    // else's friendships.
    if (!isRequester && !isAddressee) {
      continue;
    }

    const entry: ConnectionEntry = {
      connectionId: row.id,
      otherUserId: isRequester ? row.addressee_id : row.requester_id,
      createdAt: row.created_at,
    };

    if (row.status === "accepted") {
      grouped.friends.push(entry);
    } else if (isAddressee) {
      // Only the addressee can accept, so only they see it as actionable.
      grouped.received.push(entry);
    } else {
      grouped.sent.push(entry);
    }
  }

  for (const bucket of [grouped.friends, grouped.received, grouped.sent]) {
    bucket.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return grouped;
}

/**
 * What to call someone on screen.
 *
 * Display name is optional — magic-link signups never supply one — but a
 * Username is always assigned, so there is normally something better than the
 * last-resort placeholder.
 */
export function personLabel(
  person: {
    displayName: string | null;
    username: string | null;
  },
  fallback = "A Booking Buddy user",
): string {
  return person.displayName?.trim() || person.username?.trim() || fallback;
}

/**
 * The same person on one line, for places with no room for a second — an
 * `<option>`, mainly.
 *
 * Two Users can share a display name (ADR 0004 is why Usernames exist), so the
 * handle comes along unless it is already the name. Without it, a picker
 * listing two "Ben Backhand"s offers no way to tell which is which.
 */
export function personOptionLabel(person: {
  displayName: string | null;
  username: string | null;
}): string {
  const name = personLabel(person);
  const username = person.username?.trim();

  return username && username !== name ? `${name} (@${username})` : name;
}
