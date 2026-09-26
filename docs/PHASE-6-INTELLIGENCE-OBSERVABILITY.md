# Phase 6 — Sereia Intelligence Observability

## Goal

Stop adding authority before we can see the evidence.

Phases 2–5 introduced research augmentation, topic shadow scoring, editorial packaging assistance, and a narrative scene blueprint. Phase 6 makes those layers observable inside the existing AgentTube operator console so future decisions are based on real runs and productions rather than assumptions.

## Upstream-first implementation

Phase 6 does not replace the AgentTube dashboard or edit its large `index.html`, `app.js`, or `enhance.js` files.

Instead:

1. `sereia.js` installs a small additive diagnostics API before AgentTube starts.
2. The existing dashboard root HTML is read and one extra script tag is injected at runtime.
3. AgentTube still serves all existing dashboard assets and routes normally.
4. `dashboard/sereia-intelligence.js` adds one `Sereia Intelligence` view to the existing navigation.

This keeps upstream UI updates easier to merge later.

## Data sources

No new database schema is created.

The diagnostics service reuses data AgentTube already persists:

- autonomous operator runs for `research + plan`;
- the Phase 3 `sereiaResearchIntelligence` research metadata;
- the Phase 2 `sereiaTopicIntelligence` shadow comparison;
- production bundles and script metadata;
- Phase 4 `sereiaEditorialBrief` data;
- Phase 5 `sereiaNarrativeBlueprint` diagnostics.

## Dashboard evidence

The view shows:

### Layer status

Whether each Sereia layer is:

- disabled;
- waiting for a research run;
- waiting for a production;
- observed in real persisted data.

### Research

The latest observed research expansion includes:

- AgentTube upstream signal count;
- added YouTube search signals;
- merged signal count;
- preserved upstream count;
- search queries attempted/succeeded/failed.

### Topic shadow

For recent planned topics the view shows:

- AgentTube plan rank;
- Sereia shadow rank;
- rank delta;
- Sereia score;
- evidence depth/confidence;
- gate failures.

### Packaging and narrative samples

Recent productions expose:

- central promise;
- refined angle;
- packaging generation source;
- visual beat count;
- generic visual beat count;
- narrative warnings.

## Promotion gate

Three observed samples is a minimum checkpoint for human review, not an automatic success threshold.

The system explicitly returns:

`automaticPromotionAllowed: false`

Even after three samples, promotion from shadow/assist to stronger authority requires qualitative review and, when available, performance evidence such as CTR and retention.

## Failure behavior

Observability is read-only and fail-soft:

- missing runs return empty evidence states;
- inaccessible production bundles are skipped;
- diagnostics errors do not affect generation, production, review, or publishing;
- the upstream dashboard remains the operational console.

## Why this phase comes before deeper automation

The project now has enough added intelligence that another feature layer would increase complexity faster than confidence.

Phase 6 creates the measurement surface needed to answer the questions that matter next:

- Is Sereia finding useful topics AgentTube ranks differently?
- Does the research expansion add meaningful evidence rather than noise?
- Are the packaging briefs improving actual outputs?
- Does the finer narrative map identify recurring weaknesses?
- Which layers deserve more authority, and which should remain advisory?

The next development decision should be made from these observations and an end-to-end pilot run, not from architecture alone.
