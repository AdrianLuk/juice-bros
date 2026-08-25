# Episode pages are generated live, not scaffolded content

Episode pages could have used a hand-authored content layer per video (MDX or a `content/episodes.ts` array, as originally sketched in PROGRESS.md) populated by an import/scaffold script. Instead, every Episode page is generated on request straight from its YouTube video data (title, description, thumbnail, published date) with the slug computed live via `slugify(title)` — there is no persisted per-episode record and no scaffold script, so every historical and future qualifying video gets a working page immediately, with nothing to backfill.

The only persisted state is `content/episode-overrides.ts`, a hand-maintained, opt-in exceptions file for the two things live generation can't cover: `redirectFrom`, added the one time a title is deliberately renamed post-publish (since a live-computed slug would otherwise change with it and break the old URL), and `showNotes`, for once hand-written show notes eventually replace the auto-displayed YouTube description.

Trade-off accepted: there is no editorial review gate before an episode's page goes live — every qualifying video, including the entire back catalog, appears at once with no staged rollout — in exchange for zero content-sync burden and no scaffold tooling to maintain.
