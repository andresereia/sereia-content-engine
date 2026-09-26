'use strict';

class EditorialPackagingLayer {
  constructor(profile, options = {}) {
    if (!profile?.editorial) throw new Error('Active profile is missing editorial rules');
    this.profile = profile;
    this.config = {
      enabled: true,
      mode: 'assist',
      useAI: true,
      titleCandidateCount: 3,
      thumbnailTextMaxWords: 3,
      applyRefinedAngleToUpstream: true,
      preserveUpstreamOutput: true,
      ...(profile.editorialPackaging || {}),
      ...(options.config || {})
    };
    this.now = options.now || (() => new Date());
  }

  async build({ strategy = {}, aiTextService = null }) {
    const generatedAt = this.now().toISOString();
    const base = {
      schemaVersion: 1,
      mode: 'assist',
      generatedAt,
      activeProfileId: this.profile.id,
      preservesUpstreamAgents: true,
      originalAngle: String(strategy.angle || '').trim(),
      researchSourceCount: Array.isArray(strategy.researchSources) ? strategy.researchSources.length : 0
    };

    if (this.config.useAI && aiTextService?.isAvailable?.()) {
      try {
        const prompt = this.buildPrompt(strategy);
        const response = await aiTextService.generateText(prompt, {
          maxTokens: 1600,
          temperature: 0.65
        });
        const parsed = this.parseAIJsonResponse(response);
        return {
          ...base,
          generationSource: 'ai',
          ...this.normalize(parsed, strategy)
        };
      } catch (_error) {
        // Fall through to deterministic guidance. Packaging must never block the upstream pipeline.
      }
    }

    return {
      ...base,
      generationSource: 'fallback',
      ...this.buildFallback(strategy)
    };
  }

  buildPrompt(strategy) {
    const sources = (strategy.researchSources || []).slice(0, 20).map(source => ({
      title: source?.title || null,
      url: source?.url || null,
      publisher: source?.publisher || null,
      publishedAt: source?.publishedAt || null
    }));

    return `You are the editorial packaging lead for a YouTube explainer channel.\n` +
      `Create a concise pre-script briefing that improves click and retention without replacing the existing script, thumbnail, or SEO agents.\n` +
      `Return only valid JSON with this exact shape:\n` +
      `{\n` +
      `  "promise": "single viewer promise",\n` +
      `  "angle": "specific differentiated angle",\n` +
      `  "hook": "opening line or two, no greeting",\n` +
      `  "titleCandidates": ["title 1", "title 2", "title 3"],\n` +
      `  "thumbnailConcept": {\n` +
      `    "coreTension": "one visual tension",\n` +
      `    "visualSubject": "main subject to show",\n` +
      `    "contrast": "what should visually oppose or contrast",\n` +
      `    "text": "0-3 words, may be empty",\n` +
      `    "composition": "simple composition instruction"\n` +
      `  },\n` +
      `  "rationale": "why this packaging fits the audience and evidence"\n` +
      `}\n\n` +
      `Channel: ${this.profile.identity?.channelName || ''}\n` +
      `Audience: ${strategy.targetAudience || this.profile.strategy?.audience || ''}\n` +
      `Topic: ${strategy.topic || ''}\n` +
      `Existing angle: ${strategy.angle || ''}\n` +
      `Content pillar: ${strategy.contentPillar || ''}\n` +
      `Content type: ${strategy.contentType || ''}\n` +
      `Plan rationale: ${strategy.planRationale || ''}\n` +
      `Brand voice: ${strategy.brandVoice || this.profile.editorial?.brandVoice || ''}\n` +
      `Packaging rules: ${JSON.stringify(this.profile.editorial?.packagingRules || [])}\n` +
      `Narrative rules: ${JSON.stringify(this.profile.editorial?.narrativeRules || [])}\n` +
      `Research sources: ${JSON.stringify(sources)}\n\n` +
      `Rules: one central promise; hook must immediately expose a contradiction, cost, consequence, or unanswered mechanism; ` +
      `titles must stay under 100 characters; thumbnail text must not repeat the title; do not invent statistics, urgency, certainty, or facts not supported by the supplied topic/research. ` +
      `Prefer a concrete visual tension over generic icons or hype.`;
  }

  normalize(raw, strategy) {
    const titleLimit = Math.max(1, Math.min(5, Number(this.config.titleCandidateCount) || 3));
    const fallback = this.buildFallback(strategy);
    const titleCandidates = this.normalizeTitles(raw?.titleCandidates, strategy).slice(0, titleLimit);
    const thumbnailConcept = this.normalizeThumbnail(raw?.thumbnailConcept, fallback.thumbnailConcept);

    return {
      promise: this.cleanText(raw?.promise, 320) || fallback.promise,
      angle: this.cleanText(raw?.angle, 500) || fallback.angle,
      hook: this.cleanText(raw?.hook, 320) || fallback.hook,
      titleCandidates: titleCandidates.length ? titleCandidates : fallback.titleCandidates,
      thumbnailConcept,
      rationale: this.cleanText(raw?.rationale, 800) || fallback.rationale
    };
  }

  normalizeTitles(values, strategy) {
    const candidates = Array.isArray(values) ? values : [];
    const seen = new Set();
    const output = [];
    for (const value of candidates) {
      const title = this.cleanText(value, 100);
      if (!title) continue;
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(title);
    }
    if (!output.length) return this.buildFallback(strategy).titleCandidates;
    return output;
  }

  normalizeThumbnail(value, fallback) {
    const concept = value && typeof value === 'object' ? value : {};
    return {
      coreTension: this.cleanText(concept.coreTension, 240) || fallback.coreTension,
      visualSubject: this.cleanText(concept.visualSubject, 240) || fallback.visualSubject,
      contrast: this.cleanText(concept.contrast, 240) || fallback.contrast,
      text: this.limitWords(this.cleanText(concept.text, 80), this.config.thumbnailTextMaxWords),
      composition: this.cleanText(concept.composition, 320) || fallback.composition
    };
  }

  buildFallback(strategy) {
    const topic = this.cleanText(strategy.topic, 180) || 'the topic';
    const existingAngle = this.cleanText(strategy.angle, 500);
    const angle = existingAngle || `Reveal the hidden mechanism behind ${topic}, who benefits, who pays, and why it matters.`;
    const titleCandidates = this.uniqueTitles([
      existingAngle && existingAngle.length <= 100 ? existingAngle : null,
      `The Hidden Economics of ${topic}`,
      `${topic}: Who Pays and Who Profits?`
    ]).slice(0, Math.max(1, Math.min(5, Number(this.config.titleCandidateCount) || 3)));

    return {
      promise: `Show the viewer how ${topic} really works by making the hidden mechanism, incentives, costs, and consequences visible.`,
      angle,
      hook: `What looks simple about ${topic} hides a mechanism most people never see.`,
      titleCandidates,
      thumbnailConcept: {
        coreTension: 'visible outcome versus hidden mechanism',
        visualSubject: topic,
        contrast: 'what the viewer sees versus what is happening underneath',
        text: '',
        composition: 'one dominant subject, one contrasting mechanism or consequence, minimal clutter'
      },
      rationale: 'Deterministic fallback derived from the approved topic and the channel editorial rules; the upstream agents remain responsible for final execution.'
    };
  }

  parseAIJsonResponse(response) {
    const text = String(response || '').trim();
    const withoutFences = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    try {
      return JSON.parse(withoutFences);
    } catch (error) {
      const match = withoutFences.match(/\{[\s\S]*\}/);
      if (!match) throw error;
      return JSON.parse(match[0]);
    }
  }

  cleanText(value, maxLength) {
    if (value === undefined || value === null) return '';
    return String(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  limitWords(value, maxWords) {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    const limit = Math.max(0, Number(maxWords) || 0);
    return limit ? words.slice(0, limit).join(' ') : '';
  }

  uniqueTitles(values) {
    const seen = new Set();
    const titles = [];
    for (const value of values) {
      const title = this.cleanText(value, 100);
      if (!title) continue;
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      titles.push(title);
    }
    return titles;
  }
}

module.exports = { EditorialPackagingLayer };
