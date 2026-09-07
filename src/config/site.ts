const YOUTUBE_CHANNEL = 'https://www.youtube.com/@JuiceBrosPickleball';

export const siteConfig = {
  name: 'Juice Bros Pickleball',
  tagline: 'Juice Bros Pickleball | The Podcast for Everyday Players',
  description:
    'The show everyday pickleball players actually relate to. Conversations, community, and everything in between.',
  url: 'https://juicebrospickleball.com',
  ogImage: '/brand/og-image.png',
  links: {
    youtube: YOUTUBE_CHANNEL,
    spotify: 'https://open.spotify.com/show/033oOtZrkX2ifvBZ8JQyt5',
    instagram: 'https://www.instagram.com/juicebrospickleball',
  },
  /**
   * The channel with YouTube's own subscribe-confirmation dialog asked for, so
   * a click that said "subscribe" is met with an offer to subscribe instead of
   * the channel page and a hunt for the button. For subscribe CTAs only - a
   * "Watch on YouTube" button, the catalogue's fallback link and the footer's
   * social icon all keep the clean channel URL, because none of them asked.
   *
   * Deliberately not a fourth key under `links`: that object is what
   * `buildOrganizationJsonLd` spreads into `sameAs`, and a URL carrying a
   * dialog parameter is not one of the organisation's canonical profiles.
   */
  youtubeSubscribe: `${YOUTUBE_CHANNEL}?sub_confirmation=1`,
  nav: [
    { title: 'Home', href: '/' },
    { title: 'Podcast', href: '/podcast' },
    { title: 'Tools', href: '/tools' },
    { title: 'Gear', href: '/gear' },
    { title: 'Appearances', href: '/appearances' },
    { title: 'About', href: '/about' },
    { title: 'Contact', href: '/contact' },
  ],
} as const;

export type NavItem = (typeof siteConfig.nav)[number];
