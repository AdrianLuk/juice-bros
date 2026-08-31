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

  async redirects() {
    return [
      // Short, say-out-loud vanity link for promoting Booking Buddy on the
      // podcast. Carries podcast UTM params so signups from an episode show up
      // as their own source in Vercel Analytics (which reads utm_* off the
      // landing URL automatically). Temporary (307) on purpose: it's a
      // marketing alias, not a moved page, and the destination may change.
      {
        source: "/bb",
        destination:
          "/booking-buddy?utm_source=podcast&utm_medium=podcast&utm_campaign=booking-buddy",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
