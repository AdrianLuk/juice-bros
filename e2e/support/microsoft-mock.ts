import http from "node:http";

import { listenOnFixedPort } from "./mock-server.ts";

/**
 * The Microsoft counterpart of `gmail-mock.ts` (spec #280). A fixture stand-in
 * for the Microsoft identity host (`login.microsoftonline.com`), collapsed onto
 * one local server via `MICROSOFT_API_BASE_URL` — same collapsing `env.ts`'s
 * `readMicrosoftApiBaseUrl` documents.
 *
 * Fixed port rather than OS-assigned, same reasoning as the Gmail mock:
 * `playwright.config.ts` bakes this URL into `webServer.env` before the dev
 * server boots. A different port from Gmail's 5603 so both mocks run in one
 * Playwright process.
 *
 * `/authorize` simulates instant consent by redirecting straight back with a
 * one-time code; `/token` handles the auth-code exchange and the
 * rotating-refresh-token exchange; and `/v1.0/me/messages` + `/v1.0/me/messages/{id}`
 * stand in for the Microsoft Graph list/get the Outlook adapter reads
 * CourtReserve mail through (issue #284 — "Microsoft sync"), against the real
 * Graph response shapes reduced to what `graph-query.ts` / the adapter read.
 */
export const MICROSOFT_MOCK_PORT = 5604;
export const MICROSOFT_MOCK_URL = `http://127.0.0.1:${MICROSOFT_MOCK_PORT}`;

export type MockMicrosoftAccount = {
  email: string;
  accessToken: string;
  refreshToken: string;
};

/**
 * One message a fixture Outlook inbox holds — the same shape `GmailMock`'s
 * `MockGmailMessage` uses, so `sync-from-email-scenarios.ts` can seed either
 * mock from one fixture list. `receivedAt` (epoch ms) becomes Graph's
 * `receivedDateTime`.
 */
export type MockGraphMessage = {
  id: string;
  subject: string;
  html: string;
  receivedAt?: number;
};

type TokenFailure = "unreachable" | "invalid_grant";

async function readFormBody(req: http.IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

/** An unsigned JWT whose payload carries the `email` claim — the adapter reads the claim, not the signature. */
function idTokenFor(email: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ email })).toString("base64url");
  return `${header}.${payload}.`;
}

export class MicrosoftMock {
  #server: http.Server;
  #account: MockMicrosoftAccount | null = null;
  #tokenFailure: TokenFailure | null = null;
  #issuedCode: string | null = null;
  // Microsoft rotates the refresh token on every exchange; this holds the one
  // currently considered valid, so a test can assert rotation is persisted.
  #currentRefreshToken: string | null = null;
  #messages: MockGraphMessage[] = [];

  constructor() {
    this.#server = http.createServer((req, res) => {
      this.#handle(req, res).catch((error: unknown) => {
        console.error("microsoft-mock: request handling failed", error);
        res.writeHead(500).end();
      });
    });
  }

  async start(): Promise<void> {
    await listenOnFixedPort(this.#server, MICROSOFT_MOCK_PORT, "microsoft-mock");
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.#server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  /** The Microsoft account "Connect Outlook" resolves to once consent completes. */
  registerAccount(account: MockMicrosoftAccount): void {
    this.#account = account;
    this.#currentRefreshToken = account.refreshToken;
    this.#tokenFailure = null;
  }

  /** Makes the token exchange fail — an `authorization_code` grant ("couldn't connect") or a `refresh_token` grant ("reconnect"). */
  registerTokenFailure(reason: TokenFailure): void {
    this.#tokenFailure = reason;
  }

  /** What a live "Sync from Email" Graph search finds (issue #284). */
  registerMessages(messages: MockGraphMessage[]): void {
    this.#messages = messages;
  }

  reset(): void {
    this.#account = null;
    this.#tokenFailure = null;
    this.#issuedCode = null;
    this.#currentRefreshToken = null;
    this.#messages = [];
  }

  async #handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", MICROSOFT_MOCK_URL);

    if (req.method === "GET" && url.pathname === "/authorize") {
      const redirectUri = url.searchParams.get("redirect_uri");
      const state = url.searchParams.get("state") ?? "";

      if (!redirectUri) {
        res.writeHead(400).end();
        return;
      }

      this.#issuedCode = `mock-code-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const target = new URL(redirectUri);
      target.searchParams.set("code", this.#issuedCode);
      target.searchParams.set("state", state);
      res.writeHead(302, { Location: target.toString() }).end();
      return;
    }

    if (req.method === "POST" && url.pathname === "/token") {
      const body = await readFormBody(req);

      if (this.#tokenFailure === "unreachable") {
        res
          .writeHead(500, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: "server_error" }));
        return;
      }

      const account = this.#account;

      if (body.get("grant_type") === "refresh_token") {
        const matches =
          account !== null && body.get("refresh_token") === this.#currentRefreshToken;

        if (this.#tokenFailure === "invalid_grant" || !account || !matches) {
          res
            .writeHead(400, { "Content-Type": "application/json" })
            .end(JSON.stringify({ error: "invalid_grant" }));
          return;
        }

        // Rotate — the old refresh token stops working from here on.
        this.#currentRefreshToken = `${account.refreshToken}-rotated-${Date.now()}`;
        res.writeHead(200, { "Content-Type": "application/json" }).end(
          JSON.stringify({
            access_token: account.accessToken,
            refresh_token: this.#currentRefreshToken,
            expires_in: 3600,
            token_type: "Bearer",
          }),
        );
        return;
      }

      const codeMatches = body.get("code") === this.#issuedCode && this.#issuedCode !== null;

      if (this.#tokenFailure === "invalid_grant" || !codeMatches || !account) {
        res
          .writeHead(400, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: "invalid_grant" }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          access_token: account.accessToken,
          refresh_token: account.refreshToken,
          id_token: idTokenFor(account.email),
          expires_in: 3600,
          token_type: "Bearer",
        }),
      );
      return;
    }

    // Issue #284's "Sync from Email" — the Outlook adapter's Graph
    // list/get (`GET /me/messages` + `GET /me/messages/{id}`), reduced to what
    // `graph-query.ts` and `fetchMessage` actually read. The fixture set is
    // small enough to fit one page, so `@odata.nextLink` is never emitted —
    // the pagination loop itself is covered by `graph-query.test.ts`.
    if (req.method === "GET" && url.pathname === "/v1.0/me/messages") {
      if (!this.#bearerTokenValid(req)) {
        res
          .writeHead(401, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: { code: "InvalidAuthenticationToken" } }));
        return;
      }

      // Newest-first, mirroring the adapter's own `$orderby=receivedDateTime desc`.
      const ordered = [...this.#messages].sort(
        (a, b) => (b.receivedAt ?? 0) - (a.receivedAt ?? 0),
      );
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify({ value: ordered.map((message) => ({ id: message.id })) }));
      return;
    }

    const messageMatch = /^\/v1\.0\/me\/messages\/([^/]+)$/.exec(url.pathname);
    if (req.method === "GET" && messageMatch) {
      if (!this.#bearerTokenValid(req)) {
        res
          .writeHead(401, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: { code: "InvalidAuthenticationToken" } }));
        return;
      }

      const message = this.#messages.find(
        (candidate) => candidate.id === decodeURIComponent(messageMatch[1]),
      );
      if (!message) {
        res
          .writeHead(404, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: { code: "ErrorItemNotFound" } }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          id: message.id,
          subject: message.subject,
          receivedDateTime: new Date(message.receivedAt ?? 0).toISOString(),
          body: { contentType: "html", content: message.html },
        }),
      );
      return;
    }

    res.writeHead(404).end();
  }

  #bearerTokenValid(req: http.IncomingMessage): boolean {
    const authHeader = req.headers.authorization ?? "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    return this.#account !== null && accessToken === this.#account.accessToken;
  }
}
