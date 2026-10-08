/**
 * The demo night's one structural promise (issue #631): opening
 * `/tools/team-tally/demo` reaches no database.
 *
 * A rendering test can't show that. A Supabase client only has to be
 * constructed to read an anon key and open a socket, and a Server Action only
 * has to be imported to become a public endpoint the page ships an id for. So
 * this walks the route's import graph from the page outwards and fails on the
 * first module that could. The pattern is On Deck's
 * (src/lib/on-deck/demo/import-graph.test.ts).
 *
 * The walk covers the demo page and Team Tally's layout, which together are
 * everything the route itself pulls in. The root app layout is shared by every
 * page on the site and is not this ticket's to constrain.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
/** `<repo>/`: this file sits at `src/lib/team-tally/demo/`. */
const ROOT = resolve(HERE, "..", "..", "..", "..");
const SRC = join(ROOT, "src");

const ENTRY_POINTS = [
  "src/app/tools/team-tally/demo/page.tsx",
  "src/app/tools/team-tally/layout.tsx",
];

/**
 * Packages that are a database connection by definition. Matched as prefixes:
 * `@supabase/realtime-js` and `@supabase/postgrest-js` are reachable without
 * going through `supabase-js`, and "realtime channel" is the acceptance
 * criterion's own word, so the whole scope is out rather than the two entry
 * packages that happen to be in `package.json` today.
 */
const FORBIDDEN_PACKAGES = ["@supabase", "server-only"];

/** Source trees that only exist to talk to Postgres. */
const FORBIDDEN_DIRS = [
  join("src", "lib", "team-tally", "actions"),
  join("src", "lib", "team-tally", "supabase"),
  join("supabase"),
];

const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx"];
const INDEXES = ["index.ts", "index.tsx"];

/** Every `from "…"` specifier in a module, static and dynamic alike. */
function specifiersIn(source: string): string[] {
  const found: string[] = [];
  const patterns = [
    /\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

/**
 * An `import(…)` or `require(…)` whose argument is not a plain string
 * literal: a template literal, a variable, a concatenation. The walk cannot
 * follow one, so a module containing one would silently drop a whole subtree
 * out of the graph and the test would pass for the wrong reason. Better to
 * fail and make somebody either write the specifier out or widen this.
 */
function hasUnresolvableImport(source: string): string | null {
  const dynamic = /\b(?:import|require)\s*\(\s*([^)]*?)\s*\)/g;
  for (const match of source.matchAll(dynamic)) {
    const argument = match[1].trim();
    if (argument === "") continue;
    if (/^["'][^"']*["']$/.test(argument)) continue;
    // `import.meta`, and TypeScript's `import("./x").Type` are handled by the
    // string-literal case above; anything left is computed.
    return match[0];
  }
  return null;
}

/** A specifier to a file on disk, or null when it is a bare package. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) {
    base = join(SRC, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    base = resolve(dirname(fromFile), specifier);
  } else {
    return null;
  }

  // `./foo.ts` in source resolves straight through; `@/foo` needs an extension.
  for (const extension of EXTENSIONS) {
    const candidate = base + extension;
    if (isFile(candidate)) return candidate;
  }
  for (const index of INDEXES) {
    const candidate = join(base, index);
    if (isFile(candidate)) return candidate;
  }
  return null;
}

function isFile(path: string): boolean {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

test("nothing that can reach the database is in the demo route's import graph", () => {
  const seen = new Set<string>();
  const queue = ENTRY_POINTS.map((p) => join(ROOT, p));
  /** How each module was reached, so a failure names the chain to fix. */
  const reachedVia = new Map<string, string>();

  while (queue.length > 0) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);

    const where = relative(ROOT, file).split(sep).join("/");
    const source = readFileSync(file, "utf8");
    const via = reachedVia.get(file);
    const trail = via ? `${where} (imported by ${via})` : where;

    assert.ok(
      !/^\s*["']use server["']/m.test(source),
      `${trail} is a "use server" module`,
    );

    const computed = hasUnresolvableImport(source);
    assert.equal(
      computed,
      null,
      `${trail} has a computed import (${computed}) this walk cannot follow`,
    );

    for (const dir of FORBIDDEN_DIRS) {
      assert.ok(
        !file.startsWith(join(ROOT, dir)),
        `${trail} lives under ${dir.split(sep).join("/")}`,
      );
    }

    for (const specifier of specifiersIn(source)) {
      const bare = !specifier.startsWith(".") && !specifier.startsWith("@/");
      if (bare) {
        assert.ok(
          !FORBIDDEN_PACKAGES.some(
            (pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`),
          ),
          `${trail} imports ${specifier}`,
        );
        continue;
      }
      const resolved = resolveSpecifier(file, specifier);
      assert.notEqual(
        resolved,
        null,
        `${trail} imports ${specifier}, which this walk could not resolve; ` +
          "widen the resolver rather than letting the graph go unchecked",
      );
      if (!seen.has(resolved!)) reachedVia.set(resolved!, where);
      queue.push(resolved!);
    }
  }

  // A walk that found almost nothing would pass for the wrong reason.
  assert.ok(seen.size >= 20, `only walked ${seen.size} modules`);
  for (const reached of [
    join("demo", "night.ts"),
    join("demo", "reduce.ts"),
    join("team-tally", "transitions.ts"),
    join("team-tally", "score-link-screen.tsx"),
    join("team-tally", "tv-stage.tsx"),
  ]) {
    assert.ok(
      [...seen].some((f) => f.endsWith(reached)),
      `the walk never reached ${reached.split(sep).join("/")}`,
    );
  }
});
