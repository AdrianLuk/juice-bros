export function Intro() {
  return (
    <div className="mt-10 grid gap-10 sm:grid-cols-2 sm:items-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- local trusted asset, no next/image optimization needed */}
      <img
        src="/brand/JB_Banner.jpeg"
        alt="The Juice Bros"
        width={1600}
        height={900}
        className="aspect-video w-full rounded-2xl border object-cover"
      />
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">
          Juice Bros Pickleball started the way most good ideas do — two friends who
          couldn&apos;t stop talking about pickleball decided to hit record. What began as
          court-side rants turned into a podcast about the game, the gear, and the culture
          growing up around it.
        </p>
        <p className="text-muted-foreground">
          We&apos;re not pros. We&apos;re paddle-obsessed regulars who talk to the players,
          brands, and characters shaping the sport, and bring it back to you every week.
        </p>
      </div>
    </div>
  );
}
