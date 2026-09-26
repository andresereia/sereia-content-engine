'use strict';

const { ChannelProfileRegistry } = require('./channel-profile-registry');
const { NarrativeSceneBlueprint } = require('./narrative-scene-blueprint');

function isNarrativeBlueprintEnabled(profile) {
  if (String(process.env.SEREIA_NARRATIVE_BLUEPRINT || '').toLowerCase() === 'false') return false;
  return profile?.narrativeBlueprint?.enabled === true;
}

function installNarrativeSceneBlueprintBootstrap(options = {}) {
  const { ScriptWriterAgent } = require('../agents/script-writer-agent');
  const prototype = ScriptWriterAgent.prototype;
  if (prototype.__sereiaNarrativeBlueprintInstalled) return false;

  const originalGenerateScript = prototype.generateScript;
  if (typeof originalGenerateScript !== 'function') {
    throw new Error('AgentTube ScriptWriterAgent.generateScript is unavailable');
  }

  const RegistryClass = options.RegistryClass || ChannelProfileRegistry;
  const BlueprintClass = options.BlueprintClass || NarrativeSceneBlueprint;

  prototype.generateScript = async function sereiaGenerateScriptWithNarrativeBlueprint(strategy) {
    const script = await originalGenerateScript.call(this, strategy);

    try {
      const registry = new RegistryClass({ logger: this.logger || console });
      const profile = await registry.loadActiveProfile();
      if (!isNarrativeBlueprintEnabled(profile)) return script;

      const analyzer = new BlueprintClass(profile);
      const blueprint = analyzer.analyze(script);
      script.metadata = {
        ...(script.metadata || {}),
        sereiaNarrativeBlueprint: blueprint
      };
      this.logger?.info?.(
        `Sereia narrative shadow mapped ${blueprint.diagnostics.blueprintBeatCount} visual beat(s); ` +
        `AgentTube script and production flow remain unchanged.`
      );
    } catch (error) {
      script.metadata = {
        ...(script.metadata || {}),
        sereiaNarrativeBlueprint: {
          schemaVersion: 1,
          mode: 'shadow',
          status: 'unavailable',
          generatedAt: new Date().toISOString(),
          affectsScript: false,
          affectsProduction: false,
          error: error.message
        }
      };
      this.logger?.warn?.(`Sereia narrative blueprint unavailable; upstream script is unchanged: ${error.message}`);
    }

    return script;
  };

  Object.defineProperty(prototype, '__sereiaNarrativeBlueprintInstalled', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  return true;
}

module.exports = {
  installNarrativeSceneBlueprintBootstrap,
  isNarrativeBlueprintEnabled
};
