# Phase 4 — Editorial Packaging Assist

## Goal

Improve the editorial briefing before scripting without replacing AgentTube's existing Script Writer, Thumbnail Designer, or SEO agents.

## Upstream-first design

The Sereia layer creates a pre-script brief with:

- one central viewer promise;
- a refined angle;
- an opening hook direction;
- up to three title directions;
- one thumbnail concept;
- a short editorial rationale.

AgentTube remains responsible for final script generation, thumbnail concept execution, SEO metadata, production, review, and publishing.

## Integration points already exposed by AgentTube

AgentTube's script prompt already consumes `angle`, `planRationale`, `targetAudience`, `brandVoice`, `channelGoal`, `channelValueProposition`, `channelConstraints`, `callToAction`, keywords, and research sources.

Phase 4 deliberately uses these existing inputs instead of creating a second script generator.

### Script Writer

Before `ScriptWriterAgent.generateScript()` runs, the Sereia briefing is created. A copy of the strategy is enriched with:

- the refined angle (when profile configuration allows it);
- the existing plan rationale plus the Sereia packaging guidance;
- `sereiaEditorialBrief` for traceability.

The upstream Script Writer still generates the actual title, hook, sections, claims, CTA, and full script. Sereia does not overwrite the returned script title or hook in this phase.

### Thumbnail Designer

The upstream `generateConcept()` result is preserved. Sereia adds `sereiaEditorialConcept` and title directions to that concept.

The original thumbnail prompt is also preserved and receives an additive editorial section describing the central tension, main subject, contrast, optional 0–3 word text, and composition guidance.

### SEO Optimizer

The upstream SEO optimizer receives a copied strategy using the refined angle from the same briefing. The original strategy object is not mutated.

## Failure behavior

The layer is fail-open. If profile loading, AI generation, parsing, or briefing generation fails, AgentTube's original script flow runs unchanged.

If no AI text provider is available, the Sereia layer builds deterministic fallback guidance from the approved topic, existing angle, and channel rules. This fallback still does not replace upstream agents.

## Cidade Econômica pilot

The active profile enables `editorialPackaging` in `assist` mode with:

- AI briefing enabled;
- three title candidates;
- thumbnail text limited to three words;
- refined angle projected to upstream agents;
- upstream output explicitly preserved.

## Decision authority

Phase 4 improves inputs, not authority. Final generated packaging remains subject to the existing human review gate.

We should only move from `assist` to stronger decision authority after real production comparisons show that the Sereia briefing consistently improves title quality, thumbnail clarity, CTR-oriented packaging, and opening retention without introducing unsupported claims.
