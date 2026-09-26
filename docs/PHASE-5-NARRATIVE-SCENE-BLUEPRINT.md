# Phase 5 — Narrative Scene Blueprint Shadow Mode

## Goal

Measure whether a finer narrative and visual-beat map can improve pacing, visual specificity, asset reuse, and future retention analysis without replacing AgentTube's current script, production, scene repair, or render pipeline.

## What AgentTube already does well and remains preserved

AgentTube already provides a strong production foundation:

- Script Writer output flows directly into production.
- Production Management creates visual assets, narration, captions, and final assembly.
- Scene Repair creates a persisted scene-addressable manifest after production.
- Individual scenes can be edited, reordered, regenerated, re-narrated, locked, and reviewed.
- Scene revisions, provenance, narration state, and regeneration cost evidence are already tracked.

Phase 5 does not replace any of those capabilities.

## Gap being measured

The current upstream scene blueprint is intentionally coarse. It generally maps:

- one Hook scene;
- one Introduction scene;
- one scene per main script section;
- one Conclusion scene;
- one CTA scene.

The initial Production Management visual prompts are similarly broad: video title plus section titles with generic explanatory-visual guidance, capped to a small number of prompts for cost control.

That is a sensible default for a general-purpose automation agent, but Cidade Econômica needs tighter visual rhythm and more reusable, intentional visual beats.

## Shadow-mode behavior

After AgentTube's final Script Writer output is available, Sereia analyzes that exact script and attaches a `sereiaNarrativeBlueprint` object to script metadata.

The analyzer does not change the script and does not change production.

It creates smaller visual beats from:

- hook;
- introduction;
- main sections split by sentence/word density;
- conclusion;
- CTA.

Each proposed beat records:

- source section;
- narration text;
- estimated duration;
- visual intent;
- library-first asset strategy when configured;
- recurring character reference;
- continuity guidance.

## Narrative diagnostics

The shadow analyzer currently checks for:

- missing or excessively long hooks;
- weak tension signals in the hook;
- generic greetings in the opening;
- first-person credibility claims that may be unsupported;
- visual beats that are too long;
- scene density that is too low;
- weak/generic visual intent;
- alignment between the Phase 4 central promise and the actual opening.

These findings are diagnostics only. They do not automatically rewrite the script in Phase 5.

## Why generic greeting and credibility warnings matter

The upstream template fallback can generate phrases such as generic channel greetings or first-person credibility statements. Those are acceptable defaults for a general YouTube automation project, but they can conflict with a faceless documentary/explainer format and may imply experience the channel cannot substantiate.

Phase 5 detects these patterns without altering AgentTube's output automatically.

## No additional AI cost

The Phase 5 blueprint is deterministic. It does not make another model/API call. This keeps the shadow comparison inexpensive while we establish whether the finer map is useful.

## Decision criteria before production integration

Do not connect this blueprint to visual generation or the persisted scene manifest simply because it produces more beats.

Promotion to a future assisted-production phase requires evidence that the blueprint improves several of the following:

1. visual specificity compared with the current section-level prompts;
2. useful asset reuse from the Cidade Econômica library;
3. editability and scene-level repair without excessive scene fragmentation;
4. pacing appropriate to narration and retention goals;
5. fewer generic visual requests;
6. better mapping between future retention drop-offs and meaningful narrative beats;
7. acceptable provider cost and generation volume.

## Potential next step after validation

If the shadow blueprint proves useful, a later phase may project selected beats into AgentTube's existing visual-prompt and Scene Repair pipeline. That future phase should still reuse the current Production Management, Scene Repair, provenance, regeneration, and review infrastructure rather than replacing it.
