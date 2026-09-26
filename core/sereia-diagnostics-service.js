'use strict';

class SereiaDiagnosticsService {
  constructor(options = {}) {
    this.db = options.db;
    this.registry = options.registry;
    this.now = options.now || (() => new Date());
    this.maxContentSamples = Math.max(1, Number(options.maxContentSamples) || 8);
  }

  async snapshot() {
    if (!this.db) throw new Error('Database is not initialized');
    if (!this.registry?.loadActiveProfile) throw new Error('Channel profile registry is unavailable');

    const profile = await this.registry.loadActiveProfile();
    const [runs, pipeline] = await Promise.all([
      this.safeCall('listOperatorRuns', [10], []),
      this.safeCall('getPipelineOverview', [20], [])
    ]);

    const normalizedRuns = (runs || []).map(run => ({
      ...run,
      research: this.json(run.research, run.research || {}),
      plan: this.json(run.plan, run.plan || [])
    }));

    const latestTopicRun = normalizedRuns.find(run => run.research?.sereiaTopicIntelligence);
    const latestResearchRun = normalizedRuns.find(run => run.research?.sereiaResearchIntelligence);
    const content = await this.collectContentDiagnostics(pipeline || []);
    const packagingSamples = content.filter(item => item.editorialBrief).length;
    const narrativeSamples = content.filter(item => item.narrativeBlueprint).length;
    const warningCounts = this.countWarnings(content);
    const topic = latestTopicRun?.research?.sereiaTopicIntelligence || null;
    const research = latestResearchRun?.research?.sereiaResearchIntelligence || null;

    const layers = [
      this.layer('research-intelligence', 'Research expansion', profile.researchIntelligence?.enabled, research ? 'observed' : 'waiting_for_run', {
        mode: profile.researchIntelligence?.mode || 'augment',
        evidence: research ? `${research.expansionSignalCount || 0} expansion signals in latest observed run` : 'No autonomous research run observed yet'
      }),
      this.layer('topic-intelligence', 'Topic intelligence', profile.editorial?.topicScoring?.shadowModeEnabled, topic ? 'observed' : 'waiting_for_run', {
        mode: 'shadow',
        evidence: topic ? `${topic.summary?.evaluated || 0} planned topic(s) evaluated` : 'No topic shadow comparison observed yet'
      }),
      this.layer('editorial-packaging', 'Editorial packaging', profile.editorialPackaging?.enabled, packagingSamples ? 'observed' : 'waiting_for_production', {
        mode: profile.editorialPackaging?.mode || 'assist',
        evidence: `${packagingSamples} recent production sample(s) with an editorial brief`
      }),
      this.layer('narrative-blueprint', 'Narrative scene blueprint', profile.narrativeBlueprint?.enabled, narrativeSamples ? 'observed' : 'waiting_for_production', {
        mode: profile.narrativeBlueprint?.mode || 'shadow',
        evidence: `${narrativeSamples} recent production sample(s) with a narrative blueprint`
      })
    ];

    return {
      schemaVersion: 1,
      generatedAt: this.now().toISOString(),
      profile: {
        id: profile.id,
        channelName: profile.identity?.channelName || profile.id,
        locale: profile.identity?.locale || null,
        region: profile.identity?.region || null
      },
      principle: 'upstream-first',
      layers,
      research: research ? this.researchSummary(research) : null,
      topicIntelligence: topic ? this.topicSummary(topic) : null,
      recentContent: content,
      validation: {
        operatorRunsObserved: normalizedRuns.length,
        productionSamplesObserved: content.length,
        packagingSamples,
        narrativeSamples,
        minimumSamplesBeforePromotionReview: 3,
        automaticPromotionAllowed: false,
        status: packagingSamples >= 3 && narrativeSamples >= 3 ? 'review_evidence' : 'collecting_evidence',
        note: 'Shadow/assist layers are not promoted automatically. Review real production quality and performance before increasing authority.'
      },
      warningCounts
    };
  }

  async collectContentDiagnostics(pipeline) {
    if (typeof this.db.getProductionBundle !== 'function') return [];
    const rows = [];
    for (const item of pipeline.slice(0, this.maxContentSamples)) {
      try {
        const id = item.id || item.production_id || item.productionId;
        if (!id) continue;
        const bundle = await this.db.getProductionBundle(id);
        if (!bundle) continue;
        const script = this.json(bundle.script, bundle.script || {}) || {};
        const metadata = this.json(script.metadata, script.metadata || {}) || {};
        const editorialBrief = metadata.sereiaEditorialBrief || metadata.strategy?.sereiaEditorialBrief || null;
        const narrativeBlueprint = metadata.sereiaNarrativeBlueprint || null;
        rows.push({
          productionId: id,
          title: script.title || item.title || 'Untitled',
          status: item.status || bundle.status || null,
          reviewStatus: item.review_status || bundle.review_status || null,
          createdAt: item.created_at || bundle.created_at || null,
          editorialBrief: editorialBrief ? {
            generationSource: editorialBrief.generationSource || null,
            promise: editorialBrief.promise || null,
            angle: editorialBrief.angle || null,
            hook: editorialBrief.hook || null,
            titleCandidates: Array.isArray(editorialBrief.titleCandidates) ? editorialBrief.titleCandidates : [],
            thumbnailConcept: editorialBrief.thumbnailConcept || null
          } : null,
          narrativeBlueprint: narrativeBlueprint ? {
            mode: narrativeBlueprint.mode || null,
            status: narrativeBlueprint.status || 'available',
            beatCount: narrativeBlueprint.diagnostics?.blueprintBeatCount || 0,
            sourceSectionCount: narrativeBlueprint.diagnostics?.sourceSectionCount || 0,
            averageBeatSeconds: narrativeBlueprint.diagnostics?.averageBeatSeconds || 0,
            weakVisualBeatCount: narrativeBlueprint.diagnostics?.weakVisualBeatCount || 0,
            warnings: Array.isArray(narrativeBlueprint.diagnostics?.warnings) ? narrativeBlueprint.diagnostics.warnings : []
          } : null
        });
      } catch (_error) {
        // Observability must never interfere with the operator dashboard.
      }
    }
    return rows;
  }

  researchSummary(value) {
    return {
      status: value.status || 'unknown',
      mode: value.mode || 'augment',
      provider: value.provider || null,
      upstreamSignalCount: value.upstreamSignalCount || 0,
      expansionSignalCount: value.expansionSignalCount || 0,
      mergedSignalCount: value.mergedSignalCount || 0,
      upstreamSignalsPreserved: value.upstreamSignalsPreserved || 0,
      queriesAttempted: value.queriesAttempted || 0,
      queriesSucceeded: value.queriesSucceeded || 0,
      queriesFailed: value.queriesFailed || 0,
      generatedAt: value.generatedAt || null
    };
  }

  topicSummary(value) {
    const items = Array.isArray(value.items) ? value.items : [];
    return {
      mode: value.mode || 'shadow',
      generatedAt: value.generatedAt || null,
      affectsPlanSelection: value.affectsPlanSelection === true,
      summary: value.summary || {},
      items: items.slice(0, 10).map(item => ({
        topic: item.topic,
        upstreamRank: item.upstreamRank,
        sereiaRank: item.sereiaRank,
        rankDelta: item.rankDelta,
        sereiaScore: item.sereiaScore,
        status: item.status,
        confidence: item.confidence,
        evidenceCount: item.evidenceCount,
        failures: Array.isArray(item.failures) ? item.failures : []
      }))
    };
  }

  countWarnings(content) {
    const counts = {};
    for (const item of content) {
      for (const warning of item.narrativeBlueprint?.warnings || []) {
        counts[warning] = (counts[warning] || 0) + 1;
      }
    }
    return counts;
  }

  layer(id, label, enabled, status, extra = {}) {
    return {
      id,
      label,
      enabled: enabled === true,
      status: enabled === true ? status : 'disabled',
      ...extra
    };
  }

  async safeCall(method, args, fallback) {
    if (typeof this.db?.[method] !== 'function') return fallback;
    try {
      return await this.db[method](...args);
    } catch (_error) {
      return fallback;
    }
  }

  json(value, fallback) {
    if (value === null || value === undefined) return fallback;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch (_error) {
      return fallback;
    }
  }
}

module.exports = { SereiaDiagnosticsService };
