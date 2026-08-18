import http from "node:http";

/**
 * Fixed rather than OS-assigned, same reasoning as
 * `google-places-mock.ts`'s `GOOGLE_PLACES_MOCK_PORT`: `playwright.config.ts`
 * has to bake this URL into `webServer.env` before the dev server boots.
 * A different port from Places' 5602 so both mocks can run in the same
 * Playwright process without colliding.
 */
export const GMAIL_MOCK_PORT = 5603;
export const GMAIL_MOCK_URL = `http://127.0.0.1:${GMAIL_MOCK_PORT}`;

export type MockGoogleAccount = {
  email: string;
  accessToken: string;
  refreshToken: string;
};

/** One Gmail message a fixture inbox holds — what `registerMessages` seeds and `gmail-client.ts`'s search/fetch functions read back. */
export type MockGmailMessage = {
  id: string;
  subject: string;
  html: string;
};

type TokenFailure = "unreachable" | "invalid_grant";

async function readFormBody(req: http.IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

/**
 * A fixture stand-in for the three real hosts `gmail-client.ts` talks to
 * (Google's authorize screen, token endpoint, userinfo endpoint) — collapsed
 * onto one local server via `GMAIL_API_BASE_URL`, same collapsing `env.ts`'s
 * `readGmailApiBaseUrl` documents. `/authorize` simulates instant consent
 * (there's no real human at a keyboard in CI) by redirecting straight back
 * with a one-time code; nothing here ever reaches real Google infrastructure.
 */
export class GmailMock {
  #server: http.Server;
  #account: MockGoogleAccount | null = null;
  #tokenFailure: TokenFailure | null = null;
  #issuedCode: string | null = null;
  #messages: MockGmailMessage[] = [];

  constructor() {
    this.#server = http.createServer((req, res) => {
      this.#handle(req, res).catch((error: unknown) => {
        console.error("gmail-mock: request handling failed", error);
        res.writeHead(500).end();
      });
    });
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.#server.once("error", reject);
      this.#server.listen(GMAIL_MOCK_PORT, "127.0.0.1", () => resolve());
    });
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.#server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  /** The Google account "Connect Gmail" resolves to once consent completes. */
  registerAccount(account: MockGoogleAccount): void {
    this.#account = account;
    this.#tokenFailure = null;
  }

  /**
   * Makes the token exchange fail, to exercise the "couldn't connect" path
   * (an `authorization_code` grant) or, for issue #64's sync flow, the
   * "reconnect" path (a `refresh_token` grant) — the same `TokenFailure`
   * reason covers both, since `/token` branches on the request's own
   * `grant_type` to decide which one it's simulating.
   */
  registerTokenFailure(reason: TokenFailure): void {
    this.#tokenFailure = reason;
  }

  /** What a live "Sync from Email" search finds (issue #64) — served back by the list/get endpoints below. */
  registerMessages(messages: MockGmailMessage[]): void {
    this.#messages = messages;
  }

  reset(): void {
    this.#account = null;
    this.#tokenFailure = null;
    this.#issuedCode = null;
    this.#messages = [];
  }

  async #handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", GMAIL_MOCK_URL);

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

      // A refresh (issue #64's sync flow) carries a `refresh_token`, not a
      // one-time `code` — checked against the account's own, not against
      // `#issuedCode`, which only ever exists for the initial
      // `authorization_code` exchange below.
      if (body.get("grant_type") === "refresh_token") {
        const account = this.#account;
        const refreshTokenMatches = account !== null && body.get("refresh_token") === account.refreshToken;

        if (this.#tokenFailure === "invalid_grant" || !account || !refreshTokenMatches) {
          res
            .writeHead(400, { "Content-Type": "application/json" })
            .end(JSON.stringify({ error: "invalid_grant" }));
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json" }).end(
          JSON.stringify({
            access_token: account.accessToken,
            expires_in: 3600,
            token_type: "Bearer",
          }),
        );
        return;
      }

      const codeMatches = body.get("code") === this.#issuedCode && this.#issuedCode !== null;

      if (this.#tokenFailure === "invalid_grant" || !codeMatches || !this.#account) {
        res
          .writeHead(400, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: "invalid_grant" }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          access_token: this.#account.accessToken,
          refresh_token: this.#account.refreshToken,
          expires_in: 3600,
          token_type: "Bearer",
        }),
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/userinfo") {
      const authHeader = req.headers.authorization ?? "";
      const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

      if (!this.#account || accessToken !== this.#account.accessToken) {
        res
          .writeHead(401, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: "invalid_token" }));
        return;
      }

      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify({ email: this.#account.email }));
      return;
    }

    // Issue #64's "Sync from Email" — `gmail-client.ts`'s
    // `searchGmailMessages`/`fetchGmailMessage` against the real Gmail API
    // shape (`users.messages.list`/`.get`), reduced to what those two
    // functions actually read.
    if (req.method === "GET" && url.pathname === "/gmail/v1/users/me/messages") {
      if (!this.#bearerTokenValid(req)) {
        res
          .writeHead(401, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: "invalid_token" }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({ messages: this.#messages.map((message) => ({ id: message.id, threadId: message.id })) }),
      );
      return;
    }

    const messageMatch = /^\/gmail\/v1\/users\/me\/messages\/([^/]+)$/.exec(url.pathname);
    if (req.method === "GET" && messageMatch) {
      if (!this.#bearerTokenValid(req)) {
        res
          .writeHead(401, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: "invalid_token" }));
        return;
      }

      const message = this.#messages.find((candidate) => candidate.id === messageMatch[1]);
      if (!message) {
        res.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "not_found" }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          id: message.id,
          payload: {
            headers: [{ name: "Subject", value: message.subject }],
            mimeType: "text/html",
            body: { data: Buffer.from(message.html, "utf8").toString("base64url") },
          },
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
