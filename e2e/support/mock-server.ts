import type http from "node:http";

/**
 * `server.listen(port)` for the fixture mocks, with an `EADDRINUSE` failure
 * that says what to do instead of Node's bare `Error: listen EADDRINUSE`.
 *
 * The mocks bind fixed ports (5602 Places, 5603 Gmail, 5604 Microsoft) because
 * `playwright.config.ts` bakes their URLs into `webServer.env` before the app
 * boots — the port has to be known ahead of time, not discovered after
 * listening. The cost of that: a `playwright test` run killed mid-flight
 * (Ctrl-C, a CI timeout) never runs the mock's `afterAll` `stop()`, so the
 * port is still held by a stray `node` process on the next run, and the raw
 * error names neither the cause nor the fix.
 */
export function listenOnFixedPort(
  server: http.Server,
  port: number,
  label: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        reject(
          new Error(
            `${label} can't bind 127.0.0.1:${port} — a previous e2e run left a ` +
              `mock holding it (its stop() was skipped by a Ctrl-C or a timeout). ` +
              `Kill the stray process and re-run: npx kill-port ${port}`,
          ),
        );
        return;
      }
      reject(error);
    });
    server.listen(port, "127.0.0.1", () => resolve());
  });
}
