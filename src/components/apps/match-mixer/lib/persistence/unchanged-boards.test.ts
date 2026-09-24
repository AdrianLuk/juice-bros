import assert from "node:assert/strict";
import test from "node:test";

import { drawPools } from "../engine/pools.ts";
import {
  decodeShareLink,
  encodeShareLink,
  GENERATOR_VERSION,
  SHARE_PARAM,
} from "./share-link.ts";

/**
 * Boards that existed before Pools (#552), pinned.
 *
 * RR-6 ships without bumping `GENERATOR_VERSION`, and that is only honest if
 * every Share Link already sitting in a group chat draws a byte-identical
 * board after it. Each row below is a link minted by the build before Pools
 * existed, and a fingerprint of the Schedule that build drew from it. Nothing
 * here is recomputed from today's code: the payloads and fingerprints were
 * taken off the previous engine and typed in, so a change that moves any of
 * these boards fails here rather than in somebody's gym.
 *
 * If one of these fails, the fix is not to update the fingerprint. It is to
 * find what moved, and either put it back or bump `GENERATOR_VERSION` on
 * purpose (see the Generator Version entry in `match-mixer/CONTEXT.md`).
 */

const BASE = "https://juicebrospickleball.com/tools/match-mixer";

/** The same FNV-1a the link's checksum uses, over the whole Schedule. */
function fingerprint(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/** "Player 1" to "Player n", with an M or F on alternate lines when mixed. */
function names(n: number, mixed: boolean): string {
  return Array.from(
    { length: n },
    (_, i) => `Player ${i + 1}${mixed ? (i % 2 ? " F" : " M") : ""}`,
  ).join("\n");
}

const MINTED_BEFORE_POOLS = [
  { label: "rotating n=8 on 2, a Table", n: 8, numbers: "1.2.7.3.1vpp81p.r", board: "fmbmdc" },
  { label: "rotating n=12", n: 12, numbers: "1.3.8.41.5zt24a.r", board: "v5gcqn" },
  { label: "rotating n=13 on 3", n: 13, numbers: "1.3.8.7.1avcd8b.r", board: "1k3lmqw" },
  { label: "rotating n=16 past its Table", n: 16, numbers: "1.4.18.99.cmsgba.r", board: "yrhny4" },
  { label: "rotating n=22 on 5", n: 22, numbers: "1.5.8.123456.14f999m.r", board: "1sp2ylm" },
  { label: "rotating n=32", n: 32, numbers: "1.8.8.2024.11tfg8.r", board: "1pwtpte" },
  { label: "fixed n=12 on 2", n: 12, numbers: "1.2.7.5.5zt24a.f", board: "71dh59" },
  { label: "fixed n=18", n: 18, numbers: "1.4.8.77.oph71j.f", board: "yejig6" },
  { label: "singles n=9", n: 9, numbers: "1.4.8.8.qz1b7v.s", board: "3mdoky" },
  { label: "singles n=16 on 6", n: 16, numbers: "1.6.10.31337.cmsgba.s", board: "r78jjy" },
  { label: "mixed 6M 6F", n: 12, numbers: "1.3.6.11.1y4uwzm.r.m", board: "16nldpm", mixed: true },
  { label: "mixed n=14 on 3", n: 14, numbers: "1.3.8.1234.6sano6.r.m", board: "1l4tgr6", mixed: true },
] as const;

test("the generator version did not move for pools", () => {
  assert.equal(GENERATOR_VERSION, 1);
});

for (const row of MINTED_BEFORE_POOLS) {
  const mixed = "mixed" in row && row.mixed;
  const payload = `${row.numbers}\n${names(row.n, mixed)}`;

  test(`a link minted before pools draws the board it drew: ${row.label}`, () => {
    const shared = decodeShareLink(payload);
    assert.ok(shared, "the link no longer opens");
    assert.equal(shared.current, true);
    assert.equal(shared.config.pools, 1);
    const pools = drawPools(shared.config);
    assert.equal(pools.length, 1);
    assert.equal(fingerprint(pools[0].schedule), row.board);
  });

  test(`sharing that board again mints the same link: ${row.label}`, () => {
    const shared = decodeShareLink(payload);
    assert.ok(shared);
    const link = encodeShareLink(shared.config, BASE);
    assert.ok(link);
    assert.equal(new URL(link).searchParams.get(SHARE_PARAM), payload);
  });
}
