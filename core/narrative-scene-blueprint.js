'use strict';

const GENERIC_GREETING = /\b(hey everyone|welcome back|welcome to (the|this) channel|hi everyone|hello everyone)\b/i;
const CREDIBILITY_RISK = /\b(i('| a)m|i have|i've) (spent|worked|helped|researched)|working with hundreds|years of experience\b/i;
const HOOK_CUES = ['why', 'but', 'hidden', 'behind', 'cost', 'pay', 'profit', 'actually', 'really', 'despite', 'instead', 'yet', 'almost', 'never', 'harder', 'easier', 'more expensive'];

class NarrativeSceneBlueprint {
  constructor(profile, options = {}) {
    this.profile = profile;
    this.config = {
      enabled: true,
      mode: 'shadow',
      targetBeatSeconds: 10,
      maxBeatSeconds: 18,
      minBeatWords: 12,
      maxBeatWords: 42,
      maxBeats: 60,
      ...(profile?.narrativeBlueprint || {}),
      ...(options.config || {})
    };
    this.now = options.now || (() => new Date());
  }

  analyze(script = {}) {
    const beats = this.buildBeats(script).slice(0, Math.max(1, Number(this.config.maxBeats) || 60));
    const warnings = [];
    const hookText = String(script.hook?.text || script.hook || '').trim();
    const introText = this.introductionText(script.introduction);
    const fullOpening = `${hookText} ${introText}`.trim();
    const hookWords = this.wordCount(hookText);
    const greetingDetected = GENERIC_GREETING.test(introText);
    const credibilityRiskDetected = CREDIBILITY_RISK.test(introText);
    const hookCueCount = HOOK_CUES.filter(cue => hookText.toLowerCase().includes(cue)).length;
    const longBeats = beats.filter(beat => beat.estimatedSeconds > Number(this.config.maxBeatSeconds || 18)).length;
    const weakVisualBeats = beats.filter(beat => beat.visualIntent === 'generic explanatory visual').length;

    if (!hookText) warnings.push('missing_hook');
    if (hookWords > 45) warnings.push('hook_too_long');
    if (hookText && hookCueCount === 0) warnings.push('hook_has_weak_tension_signal');
    if (greetingDetected) warnings.push('generic_greeting_detected');
    if (credibilityRiskDetected) warnings.push('unverified_first_person_credibility_detected');
    if (longBeats > 0) warnings.push('visual_beats_too_long');
    if (beats.length < 4) warnings.push('scene_density_too_low');

    const packagingBrief = script.metadata?.sereiaEditorialBrief || script.metadata?.strategy?.sereiaEditorialBrief || null;
    const promiseAlignment = packagingBrief?.promise
      ? this.tokenOverlap(packagingBrief.promise, fullOpening)
      : null;
    if (promiseAlignment !== null && promiseAlignment < 0.12) warnings.push('opening_does_not_reflect_central_promise');

    return {
      schemaVersion: 1,
      mode: 'shadow',
      generatedAt: this.now().toISOString(),
      activeProfileId: this.profile.id,
      affectsScript: false,
      affectsProduction: false,
      upstreamScenePipelinePreserved: true,
      diagnostics: {
        hookWords,
        hookCueCount,
        genericGreetingDetected: greetingDetected,
        credibilityRiskDetected,
        sourceSectionCount: Array.isArray(script.mainContent?.sections) ? script.mainContent.sections.length : 0,
        blueprintBeatCount: beats.length,
        averageBeatSeconds: beats.length ? Number((beats.reduce((sum, beat) => sum + beat.estimatedSeconds, 0) / beats.length).toFixed(1)) : 0,
        longBeatCount: longBeats,
        weakVisualBeatCount: weakVisualBeats,
        promiseAlignment: promiseAlignment === null ? null : Number(promiseAlignment.toFixed(3)),
        warnings
      },
      beats
    };
  }

  buildBeats(script) {
    const beats = [];
    const pushBeat = ({ source, label, text, sectionIndex = null, beatIndex = null }) => {
      const scriptText = String(text || '').replace(/\s+/g, ' ').trim();
      if (!scriptText) return;
      const words = this.wordCount(scriptText);
      const seconds = Math.max(2, Number((words / 2.5).toFixed(1)));
      beats.push({
        id: `beat_${beats.length + 1}`,
        source,
        label,
        sectionIndex,
        beatIndex,
        scriptText,
        wordCount: words,
        estimatedSeconds: seconds,
        visualIntent: this.visualIntent(scriptText, label),
        assetStrategy: this.profile.visual?.libraryFirst ? 'library-first' : 'generate-if-needed',
        recurringCharacter: this.profile.visual?.recurringCharacter || null,
        transitionIntent: beats.length === 0 ? 'open on tension' : 'preserve narrative continuity'
      });
    };

    if (script.hook?.text) pushBeat({ source: 'hook', label: 'Hook', text: script.hook.text });

    const intro = this.introductionText(script.introduction);
    for (const [index, chunk] of this.chunkText(intro).entries()) {
      pushBeat({ source: 'introduction', label: 'Introduction', text: chunk, beatIndex: index });
    }

    for (const [sectionIndex, section] of (script.mainContent?.sections || []).entries()) {
      const text = this.sectionText(section);
      const chunks = this.chunkText(text);
      for (const [beatIndex, chunk] of chunks.entries()) {
        pushBeat({
          source: 'section',
          label: section.title || `Section ${sectionIndex + 1}`,
          text: chunk,
          sectionIndex,
          beatIndex
        });
      }
    }

    const conclusion = this.conclusionText(script.conclusion);
    for (const [index, chunk] of this.chunkText(conclusion).entries()) {
      pushBeat({ source: 'conclusion', label: 'Conclusion', text: chunk, beatIndex: index });
    }

    const cta = this.ctaText(script.callToAction);
    if (cta) pushBeat({ source: 'cta', label: 'Call to action', text: cta });

    return beats;
  }

  chunkText(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return [];
    const maxWords = Math.max(16, Number(this.config.maxBeatWords) || 42);
    const minWords = Math.max(6, Math.min(maxWords, Number(this.config.minBeatWords) || 12));
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(item => item.trim()).filter(Boolean) || [text];
    const chunks = [];
    let current = [];
    let count = 0;

    const flush = () => {
      if (!current.length) return;
      chunks.push(current.join(' ').trim());
      current = [];
      count = 0;
    };

    for (const sentence of sentences) {
      const sentenceWords = this.wordCount(sentence);
      if (sentenceWords > maxWords) {
        flush();
        const words = sentence.split(/\s+/);
        for (let i = 0; i < words.length; i += maxWords) {
          chunks.push(words.slice(i, i + maxWords).join(' '));
        }
        continue;
      }
      if (count >= minWords && count + sentenceWords > maxWords) flush();
      current.push(sentence);
      count += sentenceWords;
    }
    flush();
    return chunks;
  }

  sectionText(section = {}) {
    if (typeof section.content === 'string') return section.content;
    if (Array.isArray(section.content)) return section.content.filter(Boolean).join(' ');
    if (Array.isArray(section.items)) return section.items.map(item => `${item.title || ''}. ${item.description || ''}`).join(' ');
    if (Array.isArray(section.steps)) return section.steps.map(item => `${item.title || ''}. ${item.description || ''}`).join(' ');
    return '';
  }

  introductionText(intro = {}) {
    if (!intro || typeof intro !== 'object') return '';
    return [intro.greeting, intro.topicIntro, intro.valueProposition, intro.credibility].filter(Boolean).join(' ');
  }

  conclusionText(conclusion = {}) {
    if (!conclusion || typeof conclusion !== 'object') return '';
    return [...(Array.isArray(conclusion.recap) ? conclusion.recap : []), conclusion.finalThought].filter(Boolean).join(' ');
  }

  ctaText(cta = {}) {
    if (!cta || typeof cta !== 'object') return '';
    return [cta.subscribe, cta.like, cta.comment, cta.nextVideo].filter(value => typeof value === 'string').join(' ');
  }

  visualIntent(text, label) {
    const lower = `${label || ''} ${text || ''}`.toLowerCase();
    const cues = [
      ['price', 'show price or bill changing'],
      ['fee', 'show fee appearing on a receipt or statement'],
      ['subscription', 'show recurring payment or subscription interface'],
      ['bank', 'show bank/card/payment mechanism'],
      ['insurance', 'show risk moving between person and company'],
      ['company', 'show company incentive or revenue flow'],
      ['cost', 'show visible price versus hidden cost'],
      ['profit', 'show money flow toward the beneficiary'],
      ['pay', 'show who pays and where the money moves'],
      ['loan', 'show financing timeline and interest flow']
    ];
    const match = cues.find(([cue]) => lower.includes(cue));
    return match ? match[1] : 'generic explanatory visual';
  }

  tokenOverlap(a, b) {
    const left = this.tokens(a);
    const right = this.tokens(b);
    if (!left.size || !right.size) return 0;
    let intersection = 0;
    for (const token of left) if (right.has(token)) intersection++;
    return intersection / Math.max(1, left.size);
  }

  tokens(value) {
    const stop = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'you', 'who', 'how', 'why', 'what', 'show', 'viewer']);
    return new Set(String(value || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(token => token.length >= 3 && !stop.has(token)));
  }

  wordCount(value) {
    return String(value || '').trim().split(/\s+/).filter(Boolean).length;
  }
}

module.exports = { NarrativeSceneBlueprint };
