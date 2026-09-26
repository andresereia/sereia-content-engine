'use strict';

const { ChannelProfileRegistry } = require('./channel-profile-registry');
const { EditorialPackagingLayer } = require('./editorial-packaging-layer');

function isEditorialPackagingEnabled(profile) {
  if (String(process.env.SEREIA_EDITORIAL_PACKAGING || '').toLowerCase() === 'false') return false;
  return profile?.editorialPackaging?.enabled === true;
}

function buildGuidance(brief) {
  const titles = (brief?.titleCandidates || []).join(' | ');
  const thumb = brief?.thumbnailConcept || {};
  return [
    `Central promise: ${brief?.promise || ''}`,
    `Preferred opening: ${brief?.hook || ''}`,
    titles ? `Title directions: ${titles}` : null,
    `Thumbnail tension: ${thumb.coreTension || ''}; subject: ${thumb.visualSubject || ''}; contrast: ${thumb.contrast || ''}; text: ${thumb.text || '(none)'}`
  ].filter(Boolean).join('\n');
}

function installEditorialPackagingBootstrap(options = {}) {
  const { ScriptWriterAgent } = require('../agents/script-writer-agent');
  const { ThumbnailDesignerAgent } = require('../agents/thumbnail-designer-agent');
  const { SEOOptimizerAgent } = require('../agents/seo-optimizer-agent');
  const RegistryClass = options.RegistryClass || ChannelProfileRegistry;
  const LayerClass = options.LayerClass || EditorialPackagingLayer;

  if (ScriptWriterAgent.prototype.__sereiaEditorialPackagingInstalled) return false;

  const originalGenerateScript = ScriptWriterAgent.prototype.generateScript;
  const originalGenerateConcept = ThumbnailDesignerAgent.prototype.generateConcept;
  const originalCreatePrompt = ThumbnailDesignerAgent.prototype.createPrompt;
  const originalOptimize = SEOOptimizerAgent.prototype.optimize;

  if (![originalGenerateScript, originalGenerateConcept, originalCreatePrompt, originalOptimize].every(fn => typeof fn === 'function')) {
    throw new Error('AgentTube editorial hooks are unavailable');
  }

  ScriptWriterAgent.prototype.generateScript = async function sereiaGenerateScript(strategy) {
    try {
      const registry = new RegistryClass({ logger: this.logger || console });
      const profile = await registry.loadActiveProfile();
      if (!isEditorialPackagingEnabled(profile)) return originalGenerateScript.call(this, strategy);

      const layer = new LayerClass(profile);
      const brief = await layer.build({ strategy, aiTextService: this.aiTextService });
      const applyAngle = profile.editorialPackaging?.applyRefinedAngleToUpstream !== false;
      const existingRationale = String(strategy?.planRationale || '').trim();
      const guidance = buildGuidance(brief);
      const enrichedStrategy = {
        ...strategy,
        angle: applyAngle && brief.angle ? brief.angle : strategy.angle,
        planRationale: [existingRationale, `Sereia editorial assist:\n${guidance}`].filter(Boolean).join('\n\n'),
        sereiaEditorialBrief: brief
      };

      const script = await originalGenerateScript.call(this, enrichedStrategy);
      script.metadata = {
        ...(script.metadata || {}),
        sereiaEditorialBrief: brief
      };
      this.logger?.info?.('Sereia editorial packaging briefing supplied to the upstream Script Writer; upstream script generation preserved.');
      return script;
    } catch (error) {
      this.logger?.warn?.(`Sereia editorial packaging unavailable; using AgentTube script flow unchanged: ${error.message}`);
      return originalGenerateScript.call(this, strategy);
    }
  };

  ThumbnailDesignerAgent.prototype.generateConcept = async function sereiaGenerateConcept(script) {
    const concept = await originalGenerateConcept.call(this, script);
    const brief = script?.metadata?.sereiaEditorialBrief || script?.metadata?.strategy?.sereiaEditorialBrief;
    if (!brief?.thumbnailConcept) return concept;
    return {
      ...concept,
      sereiaEditorialConcept: brief.thumbnailConcept,
      sereiaTitleCandidates: brief.titleCandidates || []
    };
  };

  ThumbnailDesignerAgent.prototype.createPrompt = async function sereiaCreatePrompt(concept) {
    const upstreamPrompt = await originalCreatePrompt.call(this, concept);
    const editorial = concept?.sereiaEditorialConcept;
    if (!editorial) return upstreamPrompt;
    return `${upstreamPrompt}\n\nEditorial direction from Sereia Content Engine (additive; preserve the upstream style system):\n` +
      `Core tension: ${editorial.coreTension || ''}\n` +
      `Main visual subject: ${editorial.visualSubject || ''}\n` +
      `Visual contrast: ${editorial.contrast || ''}\n` +
      `Optional thumbnail text: ${editorial.text || '(none)'}\n` +
      `Composition guidance: ${editorial.composition || ''}\n` +
      `Do not duplicate the full video title in the thumbnail and do not add unsupported claims.`;
  };

  SEOOptimizerAgent.prototype.optimize = async function sereiaOptimize(script, strategy) {
    const brief = script?.metadata?.sereiaEditorialBrief || script?.metadata?.strategy?.sereiaEditorialBrief;
    if (!brief) return originalOptimize.call(this, script, strategy);
    const enrichedStrategy = {
      ...strategy,
      angle: brief.angle || strategy.angle,
      sereiaEditorialBrief: brief
    };
    return originalOptimize.call(this, script, enrichedStrategy);
  };

  Object.defineProperty(ScriptWriterAgent.prototype, '__sereiaEditorialPackagingInstalled', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  return true;
}

module.exports = {
  installEditorialPackagingBootstrap,
  isEditorialPackagingEnabled,
  buildGuidance
};
