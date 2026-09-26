'use strict';

const assert = require('assert');
const { ChannelProfileRegistry } = require('../core/channel-profile-registry');
const { ResearchIntelligenceLayer } = require('../core/research-intelligence-layer');

async function run() {
  const registry = new ChannelProfileRegistry();
  const profile = await registry.loadProfile('cidade-economica');
  const calls = [];
  const now = new Date('2026-09-26T12:00:00Z');

  const youtube = {
    search: {
      async list(params) {
        calls.push(['search', params]);
        const suffix = calls.filter(call => call[0] === 'search').length;
        return {
          data: {
            items: [
              { id: { videoId: `v${suffix}a` }, snippet: { title: `Why ${params.q} costs more than you think`, publishedAt: '2026-09-10T00:00:00Z' } },
              { id: { videoId: `v${suffix}b` }, snippet: { title: `The hidden business of ${params.q}`, publishedAt: '2026-06-10T00:00:00Z' } }
            ]
          }
        };
      }
    },
    videos: {
      async list(params) {
        calls.push(['videos', params]);
        return {
          data: {
            items: String(params.id).split(',').map((id, index) => ({
              id,
              snippet: {
                title: index === 0 ? `Why everyday fees cost more than you think ${id}` : `The hidden business behind recurring payments ${id}`,
                channelTitle: index === 0 ? 'Channel A' : 'Channel B',
                publishedAt: index === 0 ? '2026-09-10T00:00:00Z' : '2026-06-10T00:00:00Z'
              },
              statistics: { viewCount: index === 0 ? '800000' : '350000' }
            }))
          }
        };
      }
    }
  };

  const layer = new ResearchIntelligenceLayer(profile, { now: () => now });
  const upstream = Array.from({ length: 12 }, (_, index) => ({
    topic: `AgentTube upstream signal ${index + 1}`,
    score: 20 - index,
    sources: ['trending'],
    evidence: [{ url: `https://youtube.com/watch?v=u${index + 1}` }]
  }));

  const queries = layer.buildQueries(upstream);
  assert(queries.length > 0 && queries.length <= profile.researchIntelligence.maxQueries);
  assert(queries.some(query => profile.strategy.contentPillars.includes(query)), 'channel pillars must seed expansion queries');

  const expansion = await layer.expand({ youtube, upstreamTopics: upstream });
  assert.strictEqual(expansion.diagnostics.status, 'ok');
  assert.strictEqual(expansion.diagnostics.preservesUpstreamResearch, true);
  assert(expansion.signals.length >= 5, 'expansion should produce additional candidate signals');
  assert(expansion.signals.every(signal => signal.sources.includes('sereia-youtube-search')));

  const firstSearch = calls.find(call => call[0] === 'search')[1];
  assert.strictEqual(firstSearch.regionCode, 'US');
  assert.strictEqual(firstSearch.relevanceLanguage, 'en');
  assert(firstSearch.publishedAfter.startsWith('2025-09-26'));

  const merged = layer.mergeSignals(upstream, expansion.signals);
  assert.deepStrictEqual(merged.slice(0, 10), upstream.slice(0, 10), 'AgentTube top signals must keep priority');
  assert(merged.slice(10, 15).some(signal => signal.sources?.includes('sereia-youtube-search')), 'expanded research must enter the planning window');
  for (const item of upstream) {
    assert(merged.some(signal => signal.topic === item.topic), 'upstream signals must not be discarded when capacity allows');
  }

  console.log('✓ research-intelligence-layer tests passed');
}

run().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
