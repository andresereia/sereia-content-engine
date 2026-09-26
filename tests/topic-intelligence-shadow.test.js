'use strict';

const assert = require('assert');
const path = require('path');
const { ChannelProfileRegistry } = require('../core/channel-profile-registry');
const { TopicIntelligenceShadowService } = require('../core/topic-intelligence-shadow');

async function run() {
  const registry = new ChannelProfileRegistry({ rootDir: path.resolve(__dirname, '..') });
  const profile = await registry.loadProfile('cidade-economica');
  const service = new TopicIntelligenceShadowService(profile);

  const research = {
    signals: [
      {
        topic: 'subscription cancellation fees recurring revenue',
        score: 12,
        sources: ['trending', 'competitor'],
        evidence: [
          { url: 'https://example.com/a', title: 'Why subscriptions are hard to cancel', publisher: 'Channel A', publishedAt: new Date(Date.now() - 10 * 86400000).toISOString(), sourceType: 'video' },
          { url: 'https://example.com/b', title: 'Recurring revenue and cancellation friction', publisher: 'Channel B', publishedAt: new Date(Date.now() - 20 * 86400000).toISOString(), sourceType: 'video' }
        ]
      },
      {
        topic: 'credit card rewards economics',
        score: 8,
        sources: ['competitor'],
        evidence: [
          { url: 'https://example.com/c', title: 'Who pays for credit card rewards', publisher: 'Channel C', publishedAt: new Date(Date.now() - 40 * 86400000).toISOString(), sourceType: 'video' }
        ]
      }
    ],
    sourceCatalog: [
      { url: 'https://example.com/a', publisher: 'Channel A', publishedAt: new Date(Date.now() - 10 * 86400000).toISOString(), sourceType: 'video' },
      { url: 'https://example.com/b', publisher: 'Channel B', publishedAt: new Date(Date.now() - 20 * 86400000).toISOString(), sourceType: 'video' },
      { url: 'https://example.com/c', publisher: 'Channel C', publishedAt: new Date(Date.now() - 40 * 86400000).toISOString(), sourceType: 'video' }
    ],
    recentTopics: ['Why airline tickets change price every minute']
  };

  const plan = [
    {
      topic: 'Why subscriptions are so hard to cancel',
      angle: 'The hidden economics of friction, recurring revenue and who profits when you forget',
      pillar: 'hidden fees and recurring payments',
      format: 'explainer',
      length: 'medium',
      sourceUrls: ['https://example.com/a', 'https://example.com/b']
    },
    {
      topic: 'A vague money idea',
      angle: 'General thoughts about money',
      pillar: '',
      format: 'explainer',
      length: 'medium',
      sourceUrls: []
    }
  ];
  const originalPlan = JSON.parse(JSON.stringify(plan));

  const result = service.evaluate({
    research,
    plan,
    channelStrategy: {
      objective: profile.strategy.objective,
      audience: profile.strategy.audience,
      value_proposition: profile.strategy.valueProposition,
      contentPillars: profile.strategy.contentPillars
    }
  });

  assert.strictEqual(result.mode, 'shadow');
  assert.strictEqual(result.affectsPlanSelection, false);
  assert.strictEqual(result.items.length, 2);
  assert.deepStrictEqual(plan, originalPlan, 'shadow evaluation must not mutate the AgentTube plan');
  assert.strictEqual(result.items[0].upstreamRank, 1);
  assert(result.items[0].evidenceCount >= 2);
  assert(result.items[0].sereiaScore > result.items[1].sereiaScore);
  assert.strictEqual(result.items[1].status, 'reject');
  assert(result.items[1].failures.some(failure => failure.startsWith('market evidence')));
  assert(result.methodNote.includes('selection order'));

  console.log('✓ topic-intelligence-shadow tests passed');
}

run().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
