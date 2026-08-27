# Onboarding surfaces Gender proactively, reversing its "don't nag" default

`profiles.gender` (issue #79) was deliberately built to never be prompted for — the migration adding it says outright "nothing here nags a User to fill it in," leaving it to Settings for whoever chooses to set it. The new Onboarding modal (see `CONTEXT.md`) puts Gender on the same screen as adding a first Facility, which on its face contradicts that.

**Decision**: Onboarding shows the Gender field, but it stays independently optional — a User can add Facilities and finish Onboarding without touching it, exactly as they always could from Settings. What changed is visibility (surfaced once, proactively, to every zero-Org User) not the constraint (never required, never blocking). The original "don't nag" intent — no User is forced or blocked over it — is preserved; only the passive "no one ever prompts you" behavior is traded for a single, skippable prompt at the one moment most Users will predictably pass through.

**Why override it**: Settings-only placement meant most Users never saw the field at all, so the gender-aware Slot division it exists for (issue #80) stayed mostly unusable. Onboarding is the one guaranteed touchpoint for every User, skippable or not — a better place to offer it once than to leave it undiscovered indefinitely.

## Amendment (issue #176, 2026-08-27)

The intent-branched Onboarding modal ([adr/0015](0015-onboarding-intent-branch.md)) moves the Gender field off the first-facility screen. It now appears **only in the "get my group on a time" branch**, collapsed behind a disclosure labelled with its actual purpose ("show men's / women's / mixed sign-up counts") — the branch where a gender-aware Slot division is the immediate reason to ask. A User who only ever picks the "track my court bookings" branch is never shown it during Onboarding (Settings still has it).

This keeps this ADR's intent intact: surfaced proactively, once, to Users for whom it's relevant; still independently optional; still never required and never blocking. Only the placement narrowed — from "every zero-Org User" to "every User who chooses the coordinate branch" — because that's where the field earns its prompt.
