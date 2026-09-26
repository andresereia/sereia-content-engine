'use strict';

const { ChannelProfileRegistry } = require('./channel-profile-registry');
const { ResearchIntelligenceLayer } = require('./research-intelligence-layer');

function isResearchIntelligenceEnabled(profile) {
  if (String(process.env.SEREIA_RESEARCH_INTELLIGENCE || '').toLowerCase() === 'false') return false;
  return profile?.researchIntelligence?.enabled === true;
}

function installResearchIntelligenceBootstrap(options = {}) {
  const { ContentStrategyAgent } = require('../agents/content-strategy-agent');
  const prototype = ContentStrategyAgent.prototype;
  if (prototype.__sereiaResearchIntelligenceInstalled) return false;

  const originalAnalyzeTrends = prototype.analyzeTrends;
  const originalResearchAndPlan = prototype.researchAndPlanChannel;
  if (typeof originalAnalyzeTrends !== 'function' || typeof originalResearchAndPlan !== 'function') {
    throw new Error('AgentTube ContentStrategyAgent research hooks are unavailable');
  }

  const RegistryClass = options.RegistryClass || ChannelProfileRegistry;
  const LayerClass = options.LayerClass || ResearchIntelligenceLayer;

  prototype.analyzeTrends = async function sereiaAnalyzeTrends() {
    const upstreamResult = await originalAnalyzeTrends.call(this);
    this.__sereiaResearchIntelligence = null;

    try {
      const registry = new RegistryClass({ logger: this.logger || console });
      const profile = await registry.loadActiveProfile();
      if (!isResearchIntelligenceEnabled(profile)) return upstreamResult;

      const youtube = this.credentials?.getYouTubeClient?.();
      if (!youtube) throw new Error('YouTube client unavailable for additive research expansion');

      const layer = new LayerClass(profile);
      const upstreamTopics = Array.isArray(this.trendingTopics) ? this.trendingTopics : [];
      const cacheMinutes = Math.max(0, Number(profile.researchIntelligence?.cacheMinutes ?? 30));
      const cacheAgeMs = this.__sereiaResearchCache?.createdAt
        ? Date.now() - this.__sereiaResearchCache.createdAt
        : Number.POSITIVE_INFINITY;
      const cacheValid = cacheMinutes > 0 && cacheAgeMs <= cacheMinutes * 60000;

      let expansion;
      if (cacheValid) {
        expansion = {
          signals: this.__sereiaResearchCache.signals,
          diagnostics: {
            ...this.__sereiaResearchCache.diagnostics,
            status: 'cached',
            cacheAgeSeconds: Math.round(cacheAgeMs / 1000),
            generatedAt: new Date().toISOString()
          }
        };
      } else {
        expansion = await layer.expand({ youtube, upstreamTopics });
        this.__sereiaResearchCache = {
          createdAt: Date.now(),
          signals: expansion.signals,
          diagnostics: expansion.diagnostics
        };
      }

      this.trendingTopics = layer.mergeSignals(upstreamTopics, expansion.signals);
      this.__sereiaResearchIntelligence = {
        ...expansion.diagnostics,
        upstreamSignalCount: upstreamTopics.length,
        expansionSignalCount: expansion.signals.length,
        mergedSignalCount: this.trendingTopics.length,
        upstreamSignalsPreserved: Math.min(upstreamTopics.length, Number(layer.config.upstreamSlots) || 10)
      };

      this.logger?.info?.(
        `Sereia research intelligence ${cacheValid ? 'reused' : 'added'} ${expansion.signals.length} ` +
        `YouTube search signal(s) on top of ${upstreamTopics.length} AgentTube signal(s); upstream research preserved.`
      );
    } catch (error) {
      this.__sereiaResearchIntelligence = {
        schemaVersion: 1,
        status: 'unavailable',
        mode: 'augment',
        preservesUpstreamResearch: true,
        generatedAt: new Date().toISOString(),
        error: error.message
      };
      this.logger?.warn?.(`Sereia research expansion unavailable; using AgentTube research only: ${error.message}`);
    }

    return upstreamResult;
  };

  prototype.researchAndPlanChannel = async function sereiaResearchAndPlanChannelWithResearchLayer(channelStrategy) {
    const result = await originalResearchAndPlan.call(this, channelStrategy);
    if (!result || typeof result !== 'object') return result;
    const research = result.research && typeof result.research === 'object' ? result.research : {};
    if (this.__sereiaResearchIntelligence) {
      result.research = {
        ...research,
        sereiaResearchIntelligence: this.__sereiaResearchIntelligence
      };
      if (['ok', 'cached'].includes(this.__sereiaResearchIntelligence.status)) {
        const sources = new Set(result.research.sources || []);
        sources.add('Sereia YouTube search expansion (additive to AgentTube research)');
        result.research.sources = [...sources];
      }
    }
    return result;
  };

  Object.defineProperty(prototype, '__sereiaResearchIntelligenceInstalled', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  return true;
}

module.exports = {
  installResearchIntelligenceBootstrap,
  isResearchIntelligenceEnabled
};
