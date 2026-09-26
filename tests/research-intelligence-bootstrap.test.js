'use strict';

const assert = require('assert');
const { ContentStrategyAgent } = require('../agents/content-strategy-agent');

async function run() {
  const upstreamSignals = Array.from({ length: 12 }, (_, index) => ({
    topic: `AgentTube signal ${index + 1}`,
    score: 20 - index,
    sources: ['trending'],
    evidence: [{ url: `https://example.com/u${index + 1}` }]
  }));

  ContentStrategyAgent.prototype.analyzeTrends = async function fakeAnalyzeTrends() {
    this.trendingTopics = JSON.parse(JSON.stringify(upstreamSignals));
    return true;
  };
  ContentStrategyAgent.prototype.researchAndPlanChannel = async function fakeResearchAndPlanChannel() {
    await this.analyzeTrends();
    return {
      research: {
        sources: ['YouTube most-popular videos'],
        signals: this.trendingTopics.slice(0, 15),
        sourceCatalog: []
      },
      plan: [{ topic: this.trendingTopics[0].topic }]
    };
  };

  class FakeRegistry {
    async loadActiveProfile() {
      return { researchIntelligence: { enabled: true } };
    }
  }

  class FakeLayer {
    constructor() {
      this.config = { upstreamSlots: 10 };
    }
    async expand() {
      return {
        signals: [{
          topic: 'Sereia expansion signal',
          score: 99,
          sources: ['sereia-youtube-search'],
          evidence: [{ url: 'https://example.com/sereia' }]
        }],
        diagnostics: {
          schemaVersion: 1,
          status: 'ok',
          mode: 'augment',
          preservesUpstreamResearch: true
        }
      };
    }
    mergeSignals(upstream, expansion) {
      return [...upstream.slice(0, 10), ...expansion, ...upstream.slice(10)];
    }
  }

  const { installResearchIntelligenceBootstrap } = require('../core/research-intelligence-bootstrap');
  assert.strictEqual(installResearchIntelligenceBootstrap({ RegistryClass: FakeRegistry, LayerClass: FakeLayer }), true);
  assert.strictEqual(installResearchIntelligenceBootstrap({ RegistryClass: FakeRegistry, LayerClass: FakeLayer }), false, 'bootstrap must be idempotent');

  const agent = Object.create(ContentStrategyAgent.prototype);
  agent.logger = { info() {}, warn() {} };
  agent.credentials = { getYouTubeClient() { return { search: { list() {} }, videos: { list() {} } }; } };

  const result = await agent.researchAndPlanChannel({});
  assert.strictEqual(result.plan[0].topic, 'AgentTube signal 1', 'AgentTube plan priority must remain intact');
  assert.deepStrictEqual(result.research.signals.slice(0, 10).map(item => item.topic), upstreamSignals.slice(0, 10).map(item => item.topic));
  assert.strictEqual(result.research.signals[10].topic, 'Sereia expansion signal');
  assert(result.research.sereiaResearchIntelligence);
  assert.strictEqual(result.research.sereiaResearchIntelligence.preservesUpstreamResearch, true);
  assert(result.research.sources.includes('Sereia YouTube search expansion (additive to AgentTube research)'));

  process.env.SEREIA_RESEARCH_INTELLIGENCE = 'false';
  const disabled = await agent.researchAndPlanChannel({});
  assert.strictEqual(disabled.research.sereiaResearchIntelligence, undefined, 'env flag must disable expansion cleanly');
  assert.deepStrictEqual(disabled.research.signals.map(item => item.topic), upstreamSignals.slice(0, 15).map(item => item.topic));
  delete process.env.SEREIA_RESEARCH_INTELLIGENCE;

  console.log('✓ research-intelligence-bootstrap tests passed');
}

run().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
