# Roadmap: Deferred Research Sources

This file records intentionally deferred research sources so they are not forgotten.

## Current policy
AgentTube research remains the primary foundation. Sereia currently augments it with targeted YouTube Data API search only.

## Deferred sources to evaluate later
- Google Trends or equivalent search-interest data
- recent news / current-event signals
- Reddit/community demand signals
- broader web search / authoritative sources
- other niche-specific demand sources if evidence justifies them

## Do not add by default
These sources should only be added if the current stack (AgentTube + expanded YouTube search + Sereia scoring) shows a measurable research gap.

## Trigger conditions
Evaluate adding one or more sources when at least one of these becomes true:
1. too many candidate topics fail the market-evidence gate despite plausible channel fit;
2. the system repeatedly misses timely topics that later perform strongly on YouTube;
3. candidate diversity is too narrow or overly dependent on the same competitor cluster;
4. shadow-mode comparisons show weak confidence because evidence comes from too few independent sources;
5. a specific source can answer a research question that YouTube data cannot answer reliably.

## Evaluation criteria
For each proposed source, compare:
- incremental signal quality;
- overlap with existing YouTube evidence;
- API / scraping reliability;
- quota or monetary cost;
- latency;
- maintenance burden;
- legal / terms-of-service constraints;
- measurable improvement to topic selection.

## Architecture rule
Prefer additive adapters. Do not replace working AgentTube research unless side-by-side evidence demonstrates a clear advantage.

## Decision gate
Keep these sources deferred until real production data gives us a reason to add them. Add sources one at a time and measure incremental value before adding the next one.
