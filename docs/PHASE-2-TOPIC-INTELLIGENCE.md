# Phase 2 — Topic Intelligence shadow integration

## Objective
Measure the Sereia editorial ranking against AgentTube's existing autonomous planning without changing which topics AgentTube selects or the order it uses for production.

## Why shadow mode first
AgentTube's autonomous planner does not expose a numeric final score for every planned video. It produces an ordered plan after combining research signals and AI planning. Inventing an "AgentTube score" would create false precision.

Phase 2 therefore records:

- `upstreamRank`: the order produced by AgentTube.
- `upstreamSignalScore`: the nearest matching live research signal score when one exists.
- `sereiaScore`: the deterministic score from Sereia Topic Intelligence.
- `sereiaRank`: the ranking implied by Sereia's score and validation gates.
- `rankDelta`: disagreement between the two rankings.
- evidence count, confidence, scoring metrics and validation failures.

## Non-invasive integration
`core/strategy-shadow-bootstrap.js` wraps `ContentStrategyAgent.researchAndPlanChannel()` at startup from `sereia.js`.

The original AgentTube file is intentionally unchanged.

Execution order:

1. AgentTube researches and creates its plan normally.
2. Sereia loads the active channel profile.
3. The shadow evaluator scores the already-created plan using the same research catalog.
4. The comparison is attached to `research.sereiaTopicIntelligence`.
5. The original `plan` is returned without reordering, filtering or replacement.
6. AgentTube continues production exactly as before.

Because `AutonomousChannelOperator` persists its `research` object, the comparison becomes part of the operator run record without a database migration.

## Metrics currently inferred
The deterministic shadow evaluator derives provisional metrics from the evidence AgentTube already collected:

- demand evidence: relative live-signal strength plus evidence depth;
- curiosity/contradiction: explicit tension cues in topic and angle;
- packaging potential: curiosity, specificity and readable title length;
- relevance: overlap with channel pillars and strategy;
- differentiation: similarity against recent channel topics;
- recency: age of the newest usable evidence;
- evergreen potential: time-sensitive vs mechanism/explainer cues;
- visual potential: presence of concrete, depictable economic entities;
- saturation: density and breadth of similar live signals.

These are **provisional editorial heuristics**, not claims about future video performance. Phase 2 exists to collect comparisons before any replacement decision.

## Confidence
- `high`: at least 3 evidence items and source/publisher breadth;
- `medium`: at least 2 evidence items;
- `low`: fewer than 2 evidence items.

The Cidade Econômica market-validation gates still apply to the Sereia shadow score. A high-curiosity topic can therefore be rejected when demand evidence is insufficient.

## Feature control
The Cidade Econômica profile enables shadow mode with:

```json
"shadowModeEnabled": true
```

It can be disabled without code changes:

```bash
SEREIA_TOPIC_SHADOW_MODE=false
```

## Promotion rule
Do not let Sereia Topic Intelligence alter topic selection until we have a validation sample large enough to inspect:

- how often rankings disagree;
- whether rejected topics genuinely lack evidence;
- false rejects caused by weak matching;
- false positives caused by trend noise;
- relationship between shadow score and later CTR/retention/impressions when videos are eventually published.

The next phase should improve research breadth and candidate generation before enabling any automatic replacement of AgentTube ranking.
