'use strict';

const { ChannelProfileRegistry } = require('./channel-profile-registry');
const { TopicIntelligenceShadowService } = require('./topic-intelligence-shadow');

function isShadowModeEnabled(profile) {
  if (String(process.env.SEREIA_TOPIC_SHADOW_MODE || '').toLowerCase() === 'false') return false;
  return profile?.editorial?.topicScoring?.shadowModeEnabled !== false;
}

function installStrategyShadowBootstrap(options = {}) {
  const { ContentStrategyAgent } = require('../agents/content-strategy-agent');
  const prototype = ContentStrategyAgent.prototype;
  if (prototype.__sereiaTopicShadowInstalled) return false;

  const original = prototype.researchAndPlanChannel;
  if (typeof original !== 'function') {
    throw new Error('AgentTube ContentStrategyAgent.researchAndPlanChannel is unavailable');
  }

  const RegistryClass = options.RegistryClass || ChannelProfileRegistry;
  const ServiceClass = options.ServiceClass || TopicIntelligenceShadowService;

  prototype.researchAndPlanChannel = async function sereiaResearchAndPlanChannel(channelStrategy) {
    const result = await original.call(this, channelStrategy);
    const research = result?.research || {};
    const plan = Array.isArray(result?.plan) ? result.plan : [];

    try {
      const registry = new RegistryClass({ logger: this.logger || console });
      const profile = await registry.loadActiveProfile();
      if (!isShadowModeEnabled(profile)) {
        return result;
      }

      const service = new ServiceClass(profile);
      const comparison = service.evaluate({ research, plan, channelStrategy });
      result.research = {
        ...research,
        sereiaTopicIntelligence: comparison
      };
      this.logger?.info?.(
        `Sereia topic shadow evaluated ${comparison.summary.evaluated} planned topic(s); ` +
        `${comparison.summary.candidates} candidate(s), ${comparison.summary.rejects} reject(s). Plan order unchanged.`
      );
    } catch (error) {
      result.research = {
        ...research,
        sereiaTopicIntelligence: {
          schemaVersion: 1,
          mode: 'shadow',
          status: 'unavailable',
          generatedAt: new Date().toISOString(),
          affectsPlanSelection: false,
          error: error.message
        }
      };
      this.logger?.warn?.(`Sereia topic shadow unavailable; AgentTube plan remains unchanged: ${error.message}`);
    }

    return result;
  };

  Object.defineProperty(prototype, '__sereiaTopicShadowInstalled', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  return true;
}

module.exports = {
  installStrategyShadowBootstrap,
  isShadowModeEnabled
};
