# Context Map

## Contexts

- [Podcast Site](./CONTEXT.md) — Juice Bros' marketing/podcast hub (Home, Podcast, Gear, About, Contact); glossary covers the Podcast/Episode domain and the Instagram feed
- [Booking Buddy](./booking-buddy/CONTEXT.md) — friend-group pickleball scheduling app (Apps section)
- [On Deck](./on-deck/CONTEXT.md) — live court-rotation app for club pickleball socials (Apps section)

The three contexts are independent — no shared domain concepts or data relationship, just the same Next.js app shell.

Booking Buddy and On Deck are both pickleball scheduling tools and deliberately do not share a model. Booking Buddy coordinates *before* an event, between friends who know each other (Connections, availability, booking a court). On Deck runs the two hours *during* one club event, among ~60 mostly-strangers with no accounts. Several words collide across the two — **Player** means a name on a past Booking in Booking Buddy but a live participant in On Deck; **User**, **Org**, **Connection**, and **Invite Link** are Booking Buddy's alone and are explicitly avoided in On Deck. Check the right glossary before reusing a term.
