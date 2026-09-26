# ADR-001 — Preserve AgentTube core; add a channel-profile compatibility layer first

## Status
Accepted for Phase 1.

## Context
AgentTube v2.10.0 already contains `channel_profiles` and `channel_strategies`, but its public database methods treat both as singleton records identified by `default`. Production, review, engagement and autonomous-operator paths already rely on that contract.

A true multi-channel database migration now would require coordinated changes across generation jobs, productions, analytics, experiments, comments, scheduler, dashboard and review services. That creates a large regression surface before we have proven that concurrent multi-channel execution is even necessary.

## Decision
Keep AgentTube's singleton database contract intact in Phase 1.

Our fork stores richer, version-controlled channel definitions under `config/channels/*.json`. `ChannelProfileRegistry` validates the active profile and projects only the subset AgentTube needs into its existing `default` profile and strategy records.

The active profile is selected by `CHANNEL_PROFILE_ID` or `config/channels/active-profile.json`.

### Integration mechanism
Do **not** edit upstream `index.js` in Phase 1. `sereia.js` is our entry point. Before loading AgentTube it installs a narrow bootstrap around `Database.initialize()`. The bridge runs immediately after the upstream database initialization, while tables exist but before AgentTube initializes agents and schedulers.

This keeps a high-conflict upstream file untouched and makes future AgentTube updates easier to merge.

## Safety defaults
Applying any Sereia channel profile forces:

- `approval_required = true`
- `automation_paused = true`
- `auto_publish_enabled = false`
- `daily_content_enabled = false`

No publishing action is enabled by a channel profile in Phase 1.

## Why this is the lower-risk path
1. Upstream production, review, FFmpeg, analytics, OAuth and scene-repair logic remains unchanged.
2. Our editorial model evolves independently from the upstream database schema.
3. Upstream fixes should merge with fewer conflicts because `index.js` remains untouched.
4. We validate one pilot channel before paying the complexity cost of concurrent multi-channel execution.
5. A later schema migration becomes evidence-driven rather than speculative.

## Exit criteria for a real multi-channel DB migration
Do not spread `channel_id` foreign keys across the database until at least one is true:

- two channels must execute concurrently in one process;
- analytics from multiple channels must coexist in one database;
- the scheduler must automate multiple channels independently;
- switching active profiles becomes operationally costly or unsafe.
