export const siteConfig = {
  name: 'Juice Bros Pickleball',
  description:
    'The show everyday pickleball players actually relate to. Conversations, community, and everything in between.',
  url: 'https://juicebros.com',
  ogImage: '/brand/og-image.png',
  links: {
    youtube: 'https://www.youtube.com/@JuiceBrosPickleball',
    spotify: 'https://open.spotify.com/show/033oOtZrkX2ifvBZ8JQyt5',
    instagram: 'https://www.instagram.com/juicebrospickleball',
  },
  nav: [
    { title: 'Home', href: '/' },
    { title: 'Podcast', href: '/podcast' },
    { title: 'Gear', href: '/gear' },
    { title: 'About', href: '/about' },
    { title: 'Contact', href: '/contact' },
  ],
} as const;

export type NavItem = (typeof siteConfig.nav)[number];
