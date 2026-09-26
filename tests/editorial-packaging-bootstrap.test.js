'use strict';

const assert = require('assert');
const { ScriptWriterAgent } = require('../agents/script-writer-agent');
const { ThumbnailDesignerAgent } = require('../agents/thumbnail-designer-agent');
const { SEOOptimizerAgent } = require('../agents/seo-optimizer-agent');

async function run() {
  const calls = { script: null, seo: null };

  ScriptWriterAgent.prototype.generateScript = async function fakeScript(strategy) {
    calls.script = strategy;
    return {
      title: 'Upstream Script Title',
      hook: { text: 'Upstream hook' },
      metadata: { strategy }
    };
  };
  ThumbnailDesignerAgent.prototype.generateConcept = async function fakeConcept() {
    return {
      style: 'informative',
      primaryText: 'UPSTREAM',
      colors: { primary: 'purple', secondary: 'yellow', accent: 'white' }
    };
  };
  ThumbnailDesignerAgent.prototype.createPrompt = async function fakePrompt() {
    return 'UPSTREAM PROMPT';
  };
  SEOOptimizerAgent.prototype.optimize = async function fakeOptimize(_script, strategy) {
    calls.seo = strategy;
    return { title: 'Upstream SEO Title' };
  };

  class FakeRegistry {
    async loadActiveProfile() {
      return {
        id: 'cidade-economica',
        editorialPackaging: { enabled: true, applyRefinedAngleToUpstream: true }
      };
    }
  }

  class FakeLayer {
    async build() {
      return {
        mode: 'assist',
        promise: 'Explain the hidden mechanism.',
        angle: 'Refined angle from Sereia',
        hook: 'Opening tension from Sereia',
        titleCandidates: ['Title A', 'Title B'],
        thumbnailConcept: {
          coreTension: 'visible versus hidden',
          visualSubject: 'Beto and a hidden fee',
          contrast: 'simple price versus hidden cost',
          text: 'HIDDEN COST',
          composition: 'one subject and one contrast'
        }
      };
    }
  }

  const { installEditorialPackagingBootstrap } = require('../core/editorial-packaging-bootstrap');
  assert.strictEqual(installEditorialPackagingBootstrap({ RegistryClass: FakeRegistry, LayerClass: FakeLayer }), true);
  assert.strictEqual(installEditorialPackagingBootstrap({ RegistryClass: FakeRegistry, LayerClass: FakeLayer }), false);

  const scriptAgent = Object.create(ScriptWriterAgent.prototype);
  scriptAgent.logger = { info() {}, warn() {} };
  scriptAgent.aiTextService = {};
  const originalStrategy = {
    topic: 'Hidden fees',
    angle: 'Original angle',
    planRationale: 'Original rationale'
  };
  const script = await scriptAgent.generateScript(originalStrategy);
  assert.strictEqual(calls.script.angle, 'Refined angle from Sereia');
  assert(calls.script.planRationale.includes('Original rationale'));
  assert(calls.script.planRationale.includes('Central promise'));
  assert.strictEqual(script.title, 'Upstream Script Title', 'upstream script output must remain authoritative');
  assert(script.metadata.sereiaEditorialBrief, 'brief must be attached to script metadata');

  const thumbnailAgent = Object.create(ThumbnailDesignerAgent.prototype);
  const concept = await thumbnailAgent.generateConcept(script);
  assert.strictEqual(concept.style, 'informative', 'upstream concept style must be preserved');
  assert.strictEqual(concept.primaryText, 'UPSTREAM', 'upstream concept text must be preserved');
  assert.strictEqual(concept.sereiaEditorialConcept.text, 'HIDDEN COST');
  const prompt = await thumbnailAgent.createPrompt(concept);
  assert(prompt.startsWith('UPSTREAM PROMPT'));
  assert(prompt.includes('Core tension: visible versus hidden'));

  const seoAgent = Object.create(SEOOptimizerAgent.prototype);
  await seoAgent.optimize(script, originalStrategy);
  assert.strictEqual(calls.seo.angle, 'Refined angle from Sereia');
  assert.strictEqual(originalStrategy.angle, 'Original angle', 'original strategy object must not be mutated');

  process.env.SEREIA_EDITORIAL_PACKAGING = 'false';
  const disabledScript = await scriptAgent.generateScript(originalStrategy);
  assert.strictEqual(disabledScript.title, 'Upstream Script Title');
  assert.strictEqual(calls.script.angle, 'Original angle', 'disabled mode must use upstream strategy unchanged');
  delete process.env.SEREIA_EDITORIAL_PACKAGING;

  console.log('✓ editorial-packaging-bootstrap tests passed');
}

run().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
