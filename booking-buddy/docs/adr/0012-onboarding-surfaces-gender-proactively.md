# Onboarding surfaces Gender proactively, reversing its "don't nag" default

`profiles.gender` (issue #79) was deliberately built to never be prompted for — the migration adding it says outright "nothing here nags a User to fill it in," leaving it to Settings for whoever chooses to set it. The new Onboarding modal (see `CONTEXT.md`) puts Gender on the same screen as adding a first Facility, which on its face contradicts that.

**Decision**: Onboarding shows the Gender field, but it stays independently optional — a User can add Facilities and finish Onboarding without touching it, exactly as they always could from Settings. What changed is visibility (surfaced once, proactively, to every zero-Org User) not the constraint (never required, never blocking). The original "don't nag" intent — no User is forced or blocked over it — is preserved; only the passive "no one ever prompts you" behavior is traded for a single, skippable prompt at the one moment most Users will predictably pass through.

**Why override it**: Settings-only placement meant most Users never saw the field at all, so the gender-aware Slot division it exists for (issue #80) stayed mostly unusable. Onboarding is the one guaranteed touchpoint for every User, skippable or not — a better place to offer it once than to leave it undiscovered indefinitely.
