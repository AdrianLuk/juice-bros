/**
 * The demo's one structural promise (issue #519): opening `/on-deck/demo`
 * reaches no database.
 *
 * That is not something a rendering test can show — a Supabase client only has
 * to be *constructed* to start reading an anon key and opening a socket, and a
 * Server Action only has to be imported to become a public endpoint the page
 * ships an id for. So this walks the route's import graph from the page
 * outwards and fails on the first module that could. It is the test that keeps
 * the demo cheap to serve, safe to leave public, and honest about being
 * client-only.
 *
 * The walk covers the demo page and On Deck's section layout, which together
 * are everything the route itself pulls in. The root app layout is shared by
 * every page on the site and is not this ticket's to constrain.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
/** `<repo>/` — this file sits at `src/lib/on-deck/demo/`. */
const ROOT = resolve(HERE, "..", "..", "..", "..");
const SRC = join(ROOT, "src");

const ENTRY_POINTS = [
  "src/app/on-deck/demo/page.tsx",
  "src/app/on-deck/layout.tsx",
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
  join("src", "lib", "on-deck", "actions"),
  join("src", "lib", "on-deck", "supabase"),
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
 * literal — a template literal, a variable, a concatenation. The walk cannot
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
        `${trail} imports ${specifier}, which this walk could not resolve — ` +
          "widen the resolver rather than letting the graph go unchecked",
      );
      if (!seen.has(resolved!)) reachedVia.set(resolved!, where);
      queue.push(resolved!);
    }
  }

  // A walk that found almost nothing would pass for the wrong reason.
  assert.ok(seen.size >= 10, `only walked ${seen.size} modules`);
  assert.ok(
    [...seen].some((f) => f.endsWith(join("demo", "night.ts"))),
    "the walk never reached the authored log",
  );
  assert.ok(
    [...seen].some((f) => f.endsWith(join("session", "reduce.ts"))),
    "the walk never reached the fold",
  );
});
