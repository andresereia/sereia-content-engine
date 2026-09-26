# Phase 1 — Editorial core and safe profile bridge

## Objective
Turn the AgentTube fork into a maintainable base for Sereia Content Engine without rewriting the production/publishing infrastructure before it is necessary.

## Phase 1 adds
- Version-controlled channel profiles.
- Strict profile validation.
- Cidade Econômica as the pilot profile.
- Deterministic topic scoring with hard market-validation gates.
- A low-conflict startup bridge into AgentTube.
- Safety defaults that prevent autonomous generation/publishing.

## Deliberately unchanged
- YouTube OAuth.
- Publishing implementation.
- FFmpeg assembly.
- Scene Repair Studio.
- Analytics/retention ingestion.
- Dashboard UI.
- Existing DB foreign-key structure.
- Provider integrations.
- Upstream `index.js`.

## Startup path
`npm start` now launches `sereia.js`.

`sereia.js` installs `core/bootstrap.js`, then instantiates the upstream `YouTubeAutomationAgent`. The bootstrap wraps only `Database.initialize()`:

1. AgentTube creates/updates its tables.
2. The active Sereia channel profile is loaded and validated.
3. The profile is projected into AgentTube's existing singleton profile/strategy records.
4. Safe settings are forced (`approval_required`, paused automation, no auto-publish).
5. AgentTube continues its normal initialization.

This timing means all downstream agents continue using the upstream DB interface while receiving our active profile.

## Commands
```bash
npm run profile:validate
npm run test:editorial
npm start
```

## CI gate
Pull requests into `master` run Sereia profile validation and editorial/bootstrap tests before the upstream lint and test suite. Phase branches are not merged until those checks are green.

## Pilot scope
The only active pilot is `cidade-economica`. Narration speed `0.95` is explicitly tagged as testing, not a permanent voice standard.

## Next implementation slice
Integrate `TopicIntelligenceEngine` into `ContentStrategyAgent.researchAndPlanChannel()` **behind a feature flag**. For at least the first validation cycle, record upstream ranking and Sereia ranking side-by-side. Do not replace upstream topic selection until the new engine demonstrates better editorial candidates against our documented criteria.
