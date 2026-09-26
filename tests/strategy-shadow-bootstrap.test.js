'use strict';

const assert = require('assert');
const { ContentStrategyAgent } = require('../agents/content-strategy-agent');

async function run() {
  const upstreamPlan = [{
    topic: 'Why subscriptions are so hard to cancel',
    angle: 'The hidden economics of recurring revenue and cancellation friction',
    pillar: 'hidden fees and recurring payments',
    format: 'explainer',
    length: 'medium',
    sourceUrls: ['https://example.com/a', 'https://example.com/b']
  }];
  const upstreamResearch = {
    signals: [{
      topic: 'subscription cancellation friction recurring revenue',
      score: 10,
      sources: ['trending'],
      evidence: [
        { url: 'https://example.com/a', publisher: 'A', publishedAt: new Date().toISOString(), sourceType: 'video' },
        { url: 'https://example.com/b', publisher: 'B', publishedAt: new Date().toISOString(), sourceType: 'video' }
      ]
    }],
    sourceCatalog: [
      { url: 'https://example.com/a', publisher: 'A', publishedAt: new Date().toISOString(), sourceType: 'video' },
      { url: 'https://example.com/b', publisher: 'B', publishedAt: new Date().toISOString(), sourceType: 'video' }
    ],
    recentTopics: []
  };

  ContentStrategyAgent.prototype.researchAndPlanChannel = async function fakeUpstream() {
    return {
      research: JSON.parse(JSON.stringify(upstreamResearch)),
      plan: JSON.parse(JSON.stringify(upstreamPlan))
    };
  };

  const { installStrategyShadowBootstrap } = require('../core/strategy-shadow-bootstrap');
  assert.strictEqual(installStrategyShadowBootstrap(), true);
  assert.strictEqual(installStrategyShadowBootstrap(), false, 'bootstrap must be idempotent');

  const agent = Object.create(ContentStrategyAgent.prototype);
  agent.logger = { info() {}, warn() {} };
  const strategy = {
    objective: 'Explain hidden economic mechanisms',
    audience: 'US adults interested in economics',
    value_proposition: 'Make invisible economic mechanisms visible',
    contentPillars: ['hidden fees and recurring payments']
  };

  const result = await agent.researchAndPlanChannel(strategy);
  assert.deepStrictEqual(result.plan, upstreamPlan, 'shadow bootstrap must not reorder or modify upstream plan');
  assert(result.research.sereiaTopicIntelligence);
  assert.strictEqual(result.research.sereiaTopicIntelligence.mode, 'shadow');
  assert.strictEqual(result.research.sereiaTopicIntelligence.affectsPlanSelection, false);

  process.env.SEREIA_TOPIC_SHADOW_MODE = 'false';
  const disabled = await agent.researchAndPlanChannel(strategy);
  assert.deepStrictEqual(disabled.plan, upstreamPlan);
  assert.strictEqual(disabled.research.sereiaTopicIntelligence, undefined, 'env flag must disable shadow evaluation cleanly');
  delete process.env.SEREIA_TOPIC_SHADOW_MODE;

  console.log('✓ strategy-shadow-bootstrap tests passed');
}

run().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
