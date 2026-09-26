# ADR-002 — Upstream-first extension policy

## Status
Accepted.

## Context
Sereia Content Engine is built on AgentTube, an actively used open-source project that already provides valuable research, planning, production, publishing and analytics infrastructure. Replacing working upstream behavior without evidence would create unnecessary maintenance cost and remove battle-tested capabilities.

## Decision
AgentTube remains the primary operational foundation.

Sereia-specific capabilities must follow these rules:

1. **Preserve before extending.** Existing AgentTube signals, agents and infrastructure remain active unless a measured defect requires intervention.
2. **Augment rather than duplicate.** New capabilities should consume or enrich upstream outputs instead of recreating equivalent systems.
3. **Wrap instead of fork-edit where practical.** Prefer bootstraps, adapters and profile-driven configuration over direct edits to upstream files.
4. **Fail open to AgentTube.** If a Sereia enrichment layer fails, the upstream AgentTube path continues whenever it is safe to do so.
5. **Replace only after evidence.** A Sereia component may take decision authority from an upstream component only after side-by-side validation demonstrates a material improvement.
6. **Protect updateability.** Architecture choices should minimize conflicts when pulling future fixes and features from AgentTube upstream.

## Phase 3 application
The research layer keeps AgentTube's existing:
- YouTube most-popular research;
- configured competitor analysis;
- channel history;
- approved learning recommendations.

It adds targeted YouTube search expansion using the same YouTube Data API client already present in AgentTube. The top upstream signals retain priority in the planning window, while a limited number of complementary search signals are inserted after them.

## Consequences
- Lower regression risk.
- Lower maintenance burden.
- Better ability to absorb upstream improvements.
- More disciplined evidence requirements before replacing proven behavior.
- Some Sereia capabilities may initially be less aggressive because compatibility is prioritized over wholesale rewrites.
