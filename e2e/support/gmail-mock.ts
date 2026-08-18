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

  /** Makes the token exchange fail, to exercise the "couldn't connect" path. */
  registerTokenFailure(reason: TokenFailure): void {
    this.#tokenFailure = reason;
  }

  reset(): void {
    this.#account = null;
    this.#tokenFailure = null;
    this.#issuedCode = null;
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

    res.writeHead(404).end();
  }
}
