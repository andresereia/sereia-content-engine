'use strict';

const clamp100 = value => Math.max(0, Math.min(100, Number(value) || 0));

class TopicIntelligenceEngine {
  constructor(profile) {
    if (!profile?.editorial?.topicScoring) throw new Error('Profile is missing editorial.topicScoring');
    this.profile = profile;
    this.rules = profile.editorial.topicScoring;
  }

  score(candidate) {
    if (!candidate || typeof candidate !== 'object') throw new Error('Candidate must be an object');
    const metrics = candidate.metrics || {};
    const weights = this.rules.weights;
    const reasons = [];
    const failures = [];

    const normalized = {};
    for (const key of Object.keys(weights)) normalized[key] = clamp100(metrics[key]);

    let weighted = 0;
    for (const [key, weight] of Object.entries(weights)) {
      weighted += normalized[key] * (weight / 100);
    }

    const saturation = clamp100(metrics.saturation);
    const maxPenalty = Number(this.rules.saturationPenaltyMax ?? 20);
    const saturationPenalty = (saturation / 100) * maxPenalty;
    const finalScore = Math.max(0, Math.min(100, weighted - saturationPenalty));

    const evidence = Array.isArray(candidate.evidence) ? candidate.evidence : [];
    const distinctEvidence = new Set(evidence.map(item => item?.url || item?.id || JSON.stringify(item))).size;
    const gates = this.rules.gates || {};

    if (distinctEvidence < Number(gates.minimumEvidenceSources ?? 2)) {
      failures.push(`market evidence: ${distinctEvidence}/${gates.minimumEvidenceSources ?? 2} sources`);
    }
    if (normalized.demandEvidence < Number(gates.minimumDemandEvidence ?? 60)) {
      failures.push(`demand evidence: ${normalized.demandEvidence}/${gates.minimumDemandEvidence ?? 60}`);
    }
    if (normalized.packagingPotential < Number(gates.minimumPackagingPotential ?? 60)) {
      failures.push(`packaging potential: ${normalized.packagingPotential}/${gates.minimumPackagingPotential ?? 60}`);
    }

    const blockedTerms = (this.profile.editorial.bannedTopics || []).map(item => String(item).toLowerCase());
    const searchable = `${candidate.topic || ''} ${candidate.angle || ''}`.toLowerCase();
    const blocked = blockedTerms.filter(term => term && searchable.includes(term));
    if (blocked.length) failures.push(`blocked editorial terms: ${blocked.join(', ')}`);

    if (normalized.curiosityContradiction >= 75) reasons.push('strong curiosity/contradiction');
    if (normalized.demandEvidence >= 75) reasons.push('strong market-demand evidence');
    if (normalized.packagingPotential >= 75) reasons.push('strong title/thumbnail packaging potential');
    if (normalized.differentiation >= 70) reasons.push('meaningful differentiation');
    if (saturation >= 75) reasons.push('high saturation penalty');

    const passScore = Number(gates.minimumOverallScore ?? 70);
    let status = 'candidate';
    if (failures.length) status = 'reject';
    else if (finalScore < passScore) status = 'hold';

    return {
      topic: String(candidate.topic || '').trim(),
      angle: String(candidate.angle || '').trim(),
      score: Number(finalScore.toFixed(1)),
      rawWeightedScore: Number(weighted.toFixed(1)),
      saturationPenalty: Number(saturationPenalty.toFixed(1)),
      status,
      metrics: normalized,
      evidenceCount: distinctEvidence,
      reasons,
      failures
    };
  }

  rank(candidates) {
    return (candidates || [])
      .map(candidate => this.score(candidate))
      .sort((a, b) => {
        const rank = { candidate: 0, hold: 1, reject: 2 };
        return rank[a.status] - rank[b.status] || b.score - a.score;
      });
  }
}

module.exports = { TopicIntelligenceEngine };
