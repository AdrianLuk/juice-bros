export const siteConfig = {
  name: "Juice Bros Pickleball",
  description:
    "Juice Bros Pickleball is a podcast covering the game, the gear, and the culture.",
  url: "https://juicebros.com",
  ogImage: "/og.png",
  links: {
    youtube: "https://www.youtube.com/@juicebros",
    spotify: "https://open.spotify.com/show/placeholder",
    instagram: "https://www.instagram.com/juicebros",
  },
  nav: [
    { title: "Home", href: "/" },
    { title: "Podcast", href: "/podcast" },
    { title: "Gear", href: "/gear" },
    { title: "About", href: "/about" },
    { title: "Contact", href: "/contact" },
  ],
} as const;

export type NavItem = (typeof siteConfig.nav)[number];
