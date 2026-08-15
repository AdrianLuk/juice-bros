import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // geo-tz (issue #20's coordinate → time zone lookup) reads its data file at
  // runtime via `fs` and a `path.join(__dirname, ...)` relative to its own
  // package directory. Turbopack rewrites `__dirname` for anything it bundles
  // into a synthetic path, which breaks that read with a silent ENOENT
  // (caught and treated as "couldn't derive a zone", degrading to UTC — no
  // crash, but silently wrong). Marking it external keeps Next from touching
  // it at all: it's `require()`d directly in the Node server process instead,
  // where `__dirname` is real.
  serverExternalPackages: ["geo-tz"],
};

export default nextConfig;
