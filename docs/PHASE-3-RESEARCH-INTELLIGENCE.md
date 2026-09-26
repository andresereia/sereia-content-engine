# Phase 3 — Research Intelligence Layer

## Objective
Increase the quality and breadth of topic discovery without replacing AgentTube's existing research system.

## Existing AgentTube research kept intact
- YouTube most-popular videos.
- Configured competitor channels.
- Channel content history.
- Operator-approved performance learnings.
- Existing autonomous planning flow.

## Additive Sereia research
Phase 3 uses the same authenticated YouTube Data API client that AgentTube already depends on to run targeted search expansion.

Queries are seeded primarily from the active channel profile's content pillars and, when capacity remains, readable upstream topics. Search results are enriched with video statistics and converted into additional research signals.

## Planning-window policy
The research signal list intentionally reserves priority for AgentTube:

- first 10 slots: top AgentTube signals;
- next 5 slots: strongest complementary Sereia YouTube-search signals;
- remaining capacity: rest of AgentTube signals followed by additional expansion signals.

This means Sereia can add evidence to the autonomous planner while preserving AgentTube's strongest findings.

## Scoring of expansion results
Expansion signals use a lightweight evidence score based on:
- public view count;
- recency/freshness multiplier.

This score is not treated as a final editorial score. Phase 2's Topic Intelligence shadow layer still performs the richer editorial evaluation after planning.

## Quota protection
AgentTube calls trend analysis during initialization and again when autonomous planning starts. To avoid paying YouTube search quota twice for essentially the same research window, Sereia caches expansion results for 30 minutes by default while still letting AgentTube refresh its own upstream signals.

## Failure behavior
The research layer is fail-open:

- AgentTube research runs first.
- If Sereia expansion succeeds, additional signals are merged in.
- If Sereia expansion fails, AgentTube research continues unchanged.
- No publishing or production behavior is affected.

## Configuration
The active channel profile controls:

```json
{
  "researchIntelligence": {
    "enabled": true,
    "mode": "augment",
    "provider": "youtube-data-api",
    "lookbackDays": 365,
    "maxQueries": 5,
    "resultsPerQuery": 5,
    "upstreamSlots": 10,
    "expansionSlots": 5,
    "cacheMinutes": 30
  }
}
```

Emergency disable:

```bash
SEREIA_RESEARCH_INTELLIGENCE=false
```

## Validation target
Before adding external research providers, validate that this layer:
1. produces useful additional topic candidates;
2. does not degrade AgentTube's strongest upstream findings;
3. improves evidence depth and Sereia topic scores;
4. stays within acceptable YouTube API quota use.

Only after this validation should Phase 4 add new public data sources such as broader web/news/trend providers.
