/**
 * The demo night held in the browser (issue #631): one `TeamEventDoc`, every
 * write folded into it through `applyDemoWrite`, and a subscription so React
 * re-renders the screens (`useSyncExternalStore`). Writes made between
 * renders, as Let it run makes them, always fold onto the latest night.
 * Relative imports only, for `node --test`.
 */

import type { TeamEventDoc } from "../event-doc.ts";
import type { WriteResult } from "../live-seam.ts";
import { applyDemoWrite, type DemoActor, type DemoWrite } from "./reduce.ts";

export type DemoStore = {
  get(): TeamEventDoc;
  subscribe(listener: () => void): () => void;
  /** Applies one write as `actor`; a refused write changes nothing. */
  commit(actor: DemoActor, write: DemoWrite): Promise<WriteResult>;
  /** Puts `event` back, as Reset does. */
  reset(event: TeamEventDoc): void;
};

export function createDemoStore(start: TeamEventDoc, now: () => string = () => new Date().toISOString()): DemoStore {
  let event = start;
  const listeners = new Set<() => void>();
  const changed = (next: TeamEventDoc) => {
    event = next;
    for (const listener of listeners) listener();
  };

  return {
    get: () => event,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    commit(actor, write) {
      const applied = applyDemoWrite(event, actor, write, now());
      if (applied.result.ok) changed(applied.event);
      return Promise.resolve(applied.result);
    },
    reset: changed,
  };
}
