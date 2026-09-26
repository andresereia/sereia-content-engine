'use strict';

const assert = require('assert');
const { ScriptWriterAgent } = require('../agents/script-writer-agent');

async function run() {
  let upstreamCalls = 0;
  ScriptWriterAgent.prototype.generateScript = async function fakeUpstream(strategy) {
    upstreamCalls++;
    return {
      title: 'Upstream Script Title',
      hook: { text: 'Upstream hook remains authoritative.' },
      introduction: null,
      mainContent: { sections: [] },
      conclusion: null,
      callToAction: null,
      metadata: { strategy: { ...strategy }, upstream: true }
    };
  };

  class FakeRegistry {
    async loadActiveProfile() {
      return {
        id: 'cidade-economica',
        narrativeBlueprint: { enabled: true, mode: 'shadow' }
      };
    }
  }

  class FakeBlueprint {
    analyze(script) {
      assert.strictEqual(script.title, 'Upstream Script Title');
      return {
        schemaVersion: 1,
        mode: 'shadow',
        affectsScript: false,
        affectsProduction: false,
        diagnostics: { blueprintBeatCount: 7 },
        beats: [{ id: 'beat_1', source: 'hook' }]
      };
    }
  }

  const { installNarrativeSceneBlueprintBootstrap } = require('../core/narrative-scene-blueprint-bootstrap');
  assert.strictEqual(
    installNarrativeSceneBlueprintBootstrap({ RegistryClass: FakeRegistry, BlueprintClass: FakeBlueprint }),
    true
  );
  assert.strictEqual(
    installNarrativeSceneBlueprintBootstrap({ RegistryClass: FakeRegistry, BlueprintClass: FakeBlueprint }),
    false,
    'bootstrap must be idempotent'
  );

  const agent = Object.create(ScriptWriterAgent.prototype);
  agent.logger = { info() {}, warn() {} };
  const strategy = { topic: 'Hidden fees', angle: 'Original angle' };

  const script = await agent.generateScript(strategy);
  assert.strictEqual(upstreamCalls, 1, 'upstream script writer must run exactly once');
  assert.strictEqual(script.title, 'Upstream Script Title');
  assert.strictEqual(script.hook.text, 'Upstream hook remains authoritative.');
  assert.strictEqual(script.metadata.upstream, true);
  assert(script.metadata.sereiaNarrativeBlueprint);
  assert.strictEqual(script.metadata.sereiaNarrativeBlueprint.mode, 'shadow');
  assert.strictEqual(script.metadata.sereiaNarrativeBlueprint.affectsProduction, false);

  process.env.SEREIA_NARRATIVE_BLUEPRINT = 'false';
  const disabled = await agent.generateScript(strategy);
  assert.strictEqual(upstreamCalls, 2, 'disabled mode still calls upstream exactly once per request');
  assert.strictEqual(disabled.title, 'Upstream Script Title');
  assert.strictEqual(disabled.metadata.sereiaNarrativeBlueprint, undefined);
  delete process.env.SEREIA_NARRATIVE_BLUEPRINT;

  console.log('✓ narrative-scene-blueprint-bootstrap tests passed');
}

run().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
