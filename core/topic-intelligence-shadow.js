'use strict';

const { TopicIntelligenceEngine } = require('./topic-intelligence-engine');

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'your', 'about', 'what', 'when',
  'where', 'which', 'while', 'have', 'has', 'had', 'are', 'was', 'were', 'why', 'how', 'who',
  'their', 'they', 'them', 'you', 'our', 'out', 'not', 'but', 'can', 'could', 'would', 'should',
  'uma', 'para', 'com', 'como', 'por', 'que', 'dos', 'das', 'não', 'mais', 'sua', 'seu'
]);

const clamp100 = value => Math.max(0, Math.min(100, Number(value) || 0));

class TopicIntelligenceShadowService {
  constructor(profile) {
    if (!profile?.editorial?.topicScoring) throw new Error('Active profile is missing topic scoring rules');
    this.profile = profile;
    this.engine = new TopicIntelligenceEngine(profile);
  }

  evaluate({ research = {}, plan = [], channelStrategy = {} }) {
    const items = (plan || []).map((item, index) => this.evaluatePlanItem({
      item,
      upstreamRank: index + 1,
      research,
      channelStrategy
    }));

    const ranked = [...items].sort((a, b) => {
      const statusRank = { candidate: 0, hold: 1, reject: 2 };
      return (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9) || b.sereiaScore - a.sereiaScore;
    });
    const sereiaRankByTopic = new Map(ranked.map((item, index) => [item.topic.toLowerCase(), index + 1]));

    for (const item of items) {
      item.sereiaRank = sereiaRankByTopic.get(item.topic.toLowerCase()) || null;
      item.rankDelta = item.sereiaRank == null ? null : item.upstreamRank - item.sereiaRank;
    }

    return {
      schemaVersion: 1,
      mode: 'shadow',
      generatedAt: new Date().toISOString(),
      activeProfileId: this.profile.id,
      affectsPlanSelection: false,
      methodNote: 'AgentTube autonomous planning exposes selection order rather than a numeric plan score. upstreamRank records that order; upstreamSignalScore records the closest live research signal score when available.',
      items,
      summary: {
        evaluated: items.length,
        candidates: items.filter(item => item.status === 'candidate').length,
        holds: items.filter(item => item.status === 'hold').length,
        rejects: items.filter(item => item.status === 'reject').length,
        rankDisagreements: items.filter(item => item.rankDelta !== 0).length,
        lowConfidence: items.filter(item => item.confidence === 'low').length
      }
    };
  }

  evaluatePlanItem({ item, upstreamRank, research, channelStrategy }) {
    const match = this.matchResearch(item, research);
    const metrics = {
      demandEvidence: this.scoreDemand(match, research),
      curiosityContradiction: this.scoreCuriosity(item),
      packagingPotential: this.scorePackaging(item),
      relevance: this.scoreRelevance(item, channelStrategy),
      differentiation: this.scoreDifferentiation(item, research.recentTopics || []),
      recency: this.scoreRecency(match.evidence),
      evergreenPotential: this.scoreEvergreen(item),
      visualPotential: this.scoreVisualPotential(item),
      saturation: this.scoreSaturation(match, research)
    };

    const result = this.engine.score({
      topic: item.topic,
      angle: item.angle,
      metrics,
      evidence: match.evidence
    });

    const publishers = new Set(match.evidence.map(source => source.publisher).filter(Boolean));
    const sourceTypes = new Set(match.evidence.map(source => source.sourceType).filter(Boolean));
    const confidence = match.evidence.length >= 3 && (publishers.size >= 2 || sourceTypes.size >= 2)
      ? 'high'
      : match.evidence.length >= 2
        ? 'medium'
        : 'low';

    return {
      topic: result.topic,
      angle: result.angle,
      upstreamRank,
      upstreamSignalScore: match.bestSignal ? Number(match.bestSignal.score || 0) : null,
      sereiaRank: null,
      rankDelta: null,
      sereiaScore: result.score,
      status: result.status,
      confidence,
      metrics: result.metrics,
      saturationPenalty: result.saturationPenalty,
      evidenceCount: result.evidenceCount,
      matchedSignals: match.signals.slice(0, 5).map(signal => ({
        topic: signal.topic,
        score: Number(signal.score || 0),
        similarity: Number(signal.similarity.toFixed(3))
      })),
      reasons: result.reasons,
      failures: result.failures
    };
  }

  matchResearch(item, research) {
    const itemText = `${item.topic || ''} ${item.angle || ''}`;
    const itemTokens = this.tokenize(itemText);
    const requestedUrls = new Set((item.sourceUrls || []).map(String));
    const signals = (research.signals || []).map(signal => {
      const similarity = this.jaccard(itemTokens, this.tokenize(signal.topic));
      const signalUrls = new Set((signal.evidence || []).map(source => source.url).filter(Boolean));
      const directSourceMatch = [...requestedUrls].some(url => signalUrls.has(url));
      return { ...signal, similarity: directSourceMatch ? Math.max(similarity, 0.8) : similarity };
    }).filter(signal => signal.similarity >= 0.12)
      .sort((a, b) => b.similarity - a.similarity || Number(b.score || 0) - Number(a.score || 0));

    const catalog = new Map((research.sourceCatalog || []).filter(source => source.url).map(source => [source.url, source]));
    const evidence = [];
    for (const url of requestedUrls) {
      if (catalog.has(url)) evidence.push(catalog.get(url));
    }
    for (const signal of signals.slice(0, 5)) {
      for (const source of signal.evidence || []) {
        if (source.url && !evidence.some(existing => existing.url === source.url)) evidence.push(source);
      }
    }

    return {
      signals,
      bestSignal: signals[0] || null,
      evidence: evidence.slice(0, 12)
    };
  }

  scoreDemand(match, research) {
    if (!match.signals.length && !match.evidence.length) return 0;
    const maxSignalScore = Math.max(1, ...(research.signals || []).map(signal => Number(signal.score || 0)));
    const relativeSignal = match.bestSignal ? clamp100((Number(match.bestSignal.score || 0) / maxSignalScore) * 100) : 0;
    const evidenceDepth = clamp100((match.evidence.length / 3) * 100);
    return Math.round((relativeSignal * 0.7) + (evidenceDepth * 0.3));
  }

  scoreCuriosity(item) {
    const text = `${item.topic || ''} ${item.angle || ''}`.toLowerCase();
    const cues = ['hidden', 'almost', 'but', 'despite', 'behind', 'really', 'actually', 'why', 'who pays', 'who profits', 'cost', 'trap', 'friction', 'versus', 'vs', 'without', 'invisible', 'secret'];
    const cueCount = cues.filter(cue => text.includes(cue)).length;
    const angleAddsInformation = this.jaccard(this.tokenize(item.topic), this.tokenize(item.angle)) < 0.7;
    return clamp100(38 + Math.min(42, cueCount * 12) + (angleAddsInformation ? 15 : 0));
  }

  scorePackaging(item) {
    const topic = String(item.topic || '').trim();
    const tokenCount = this.tokenize(topic).size;
    const lengthScore = topic.length >= 24 && topic.length <= 85 ? 90 : topic.length <= 110 ? 70 : 45;
    const specificity = clamp100(35 + tokenCount * 7);
    const curiosity = this.scoreCuriosity(item);
    return Math.round((curiosity * 0.45) + (specificity * 0.35) + (lengthScore * 0.2));
  }

  scoreRelevance(item, strategy) {
    const candidate = this.tokenize(`${item.topic || ''} ${item.angle || ''} ${item.pillar || ''}`);
    const pillars = (strategy.contentPillars || []).map(pillar => this.jaccard(candidate, this.tokenize(pillar)));
    const strategicText = `${strategy.objective || ''} ${strategy.value_proposition || strategy.valueProposition || ''} ${strategy.audience || ''}`;
    const strategyOverlap = this.jaccard(candidate, this.tokenize(strategicText));
    const pillarOverlap = pillars.length ? Math.max(...pillars) : 0;
    const explicitPillar = item.pillar && (strategy.contentPillars || []).some(pillar => String(pillar).toLowerCase() === String(item.pillar).toLowerCase());
    return clamp100(35 + pillarOverlap * 45 + strategyOverlap * 35 + (explicitPillar ? 15 : 0));
  }

  scoreDifferentiation(item, recentTopics) {
    const candidate = this.tokenize(`${item.topic || ''} ${item.angle || ''}`);
    const similarities = (recentTopics || []).map(topic => this.jaccard(candidate, this.tokenize(topic)));
    const closest = similarities.length ? Math.max(...similarities) : 0;
    return clamp100(100 - closest * 100);
  }

  scoreRecency(evidence) {
    const ages = (evidence || []).map(source => {
      const time = Date.parse(source.publishedAt || '');
      if (!Number.isFinite(time)) return null;
      return Math.max(0, (Date.now() - time) / 86400000);
    }).filter(age => age != null);
    if (!ages.length) return 40;
    const newest = Math.min(...ages);
    if (newest <= 30) return 100;
    if (newest <= 90) return 85;
    if (newest <= 180) return 70;
    if (newest <= 365) return 55;
    return 35;
  }

  scoreEvergreen(item) {
    const text = `${item.topic || ''} ${item.angle || ''}`.toLowerCase();
    let score = 78;
    if (/\b(today|breaking|latest|this week|this month|202[0-9])\b/.test(text)) score -= 30;
    if (/\b(why|how|economics|mechanism|system|business model|explained|works|behind)\b/.test(text)) score += 12;
    return clamp100(score);
  }

  scoreVisualPotential(item) {
    const text = `${item.topic || ''} ${item.angle || ''}`.toLowerCase();
    const concreteCues = ['company', 'bank', 'card', 'store', 'factory', 'city', 'building', 'fee', 'bill', 'subscription', 'insurance', 'loan', 'price', 'money', 'app', 'airport', 'ship', 'cable', 'data center', 'market', 'house', 'car'];
    const concreteHits = concreteCues.filter(cue => text.includes(cue)).length;
    return clamp100(55 + Math.min(35, concreteHits * 10));
  }

  scoreSaturation(match, research) {
    if (!match.signals.length) return 15;
    const similarSignals = match.signals.filter(signal => signal.similarity >= 0.25).length;
    const sourceBreadth = new Set(match.evidence.map(source => source.publisher || source.sourceType).filter(Boolean)).size;
    const relativeDensity = (research.signals || []).length
      ? (similarSignals / Math.max(1, research.signals.length)) * 100
      : 0;
    return clamp100(20 + similarSignals * 12 + sourceBreadth * 5 + relativeDensity * 0.4);
  }

  tokenize(value) {
    return new Set(String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .map(token => token.replace(/^-+|-+$/g, ''))
      .filter(token => token.length >= 3 && !STOP_WORDS.has(token)));
  }

  jaccard(a, b) {
    if (!a?.size || !b?.size) return 0;
    let intersection = 0;
    for (const token of a) if (b.has(token)) intersection++;
    const union = new Set([...a, ...b]).size;
    return union ? intersection / union : 0;
  }
}

module.exports = { TopicIntelligenceShadowService };
