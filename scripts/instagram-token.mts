/**
 * One-time bootstrap for the Instagram feed's long-lived access token.
 * Full walkthrough (Meta app setup + where the token goes): docs/instagram-feed-setup.md.
 *
 * Needs INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_OAUTH_REDIRECT_URI
 * in the shell (see .env.example).
 *
 *   # 1. print the login URL, open it, approve as @juicebrospickleball
 *   node scripts/instagram-token.mts
 *
 *   # 2. paste the ?code=... from the redirect back in
 *   node scripts/instagram-token.mts "<code>"
 *
 * Step 2 prints the long-lived token and the exact JSON to store in Edge
 * Config (key `instagram_token`). After that the refresh cron keeps it alive.
 */
const appId = requireEnv("INSTAGRAM_APP_ID");
const appSecret = requireEnv("INSTAGRAM_APP_SECRET");
const redirectUri = requireEnv("INSTAGRAM_OAUTH_REDIRECT_URI");

const rawCode = process.argv[2];

if (!rawCode) {
  const authUrl = new URL("https://www.instagram.com/oauth/authorize");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "instagram_business_basic");

  console.log(
    [
      "1. Open this URL and approve as the @juicebrospickleball account:",
      "",
      `   ${authUrl}`,
      "",
      "2. You'll be redirected to your redirect URI with `?code=...` in the",
      "   address bar. Copy that code value and run:",
      "",
      '   node scripts/instagram-token.mts "<code>"',
      "",
    ].join("\n"),
  );
  process.exit(0);
}

// Instagram appends `#_` to the redirect; a pasted code often carries it.
const code = rawCode.replace(/#_$/, "").trim();

const shortLived = await exchangeCodeForShortLivedToken(code);
const longLived = await exchangeForLongLivedToken(shortLived);

const stored = {
  token: longLived.access_token,
  expiresAt: Math.floor(Date.now() / 1000) + longLived.expires_in,
};

const expiryDate = new Date(stored.expiresAt * 1000).toISOString().slice(0, 10);

console.log(
  [
    "",
    `Long-lived token (expires ~${expiryDate}, ${Math.round(longLived.expires_in / 86400)} days):`,
    "",
    `   ${longLived.access_token}`,
    "",
    "Store this in the Vercel Edge Config store, key `instagram_token`, value:",
    "",
    `   ${JSON.stringify(stored)}`,
    "",
    "For local dev instead, put just the token in .env as INSTAGRAM_ACCESS_TOKEN.",
    "",
  ].join("\n"),
);

async function exchangeCodeForShortLivedToken(authCode: string): Promise<string> {
  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code: authCode,
    }),
  });
  const body = (await res.json()) as { access_token?: string; error_message?: string };
  if (!res.ok || !body.access_token) {
    fail(`code exchange failed (${res.status}): ${body.error_message ?? JSON.stringify(body)}`);
  }
  return body.access_token;
}

async function exchangeForLongLivedToken(
  shortLivedToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("access_token", shortLivedToken);

  const res = await fetch(url);
  const body = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!res.ok || !body.access_token || !body.expires_in) {
    fail(`long-lived exchange failed (${res.status}): ${body.error?.message ?? JSON.stringify(body)}`);
  }
  return { access_token: body.access_token, expires_in: body.expires_in };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set. See .env.example and docs/instagram-feed-setup.md.`);
    process.exit(1);
  }
  return value;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
