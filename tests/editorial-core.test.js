'use strict';

const assert = require('assert');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { ChannelProfileRegistry } = require('../core/channel-profile-registry');
const { TopicIntelligenceEngine } = require('../core/topic-intelligence-engine');

async function run() {
  const sourceRoot = path.resolve(__dirname, '..');
  const registry = new ChannelProfileRegistry({ rootDir: sourceRoot });
  const profile = await registry.loadProfile('cidade-economica');

  assert.strictEqual(profile.id, 'cidade-economica');
  assert.strictEqual(profile.visual.assetReuseTarget, 0.65);

  const dbCalls = [];
  const fakeDb = {
    async saveChannelProfile(value) { dbCalls.push(['profile', value]); return value; },
    async saveChannelStrategy(value) { dbCalls.push(['strategy', value]); return value; },
    async setSetting(key, value) { dbCalls.push(['setting', key, value]); }
  };
  const bridgeResult = await registry.applyToAgentTube(fakeDb, profile);
  assert.strictEqual(bridgeResult.safety.autoPublishEnabled, false);
  assert(dbCalls.some(call => call[0] === 'setting' && call[1] === 'automation_paused' && call[2] === 'true'));
  assert(dbCalls.some(call => call[0] === 'setting' && call[1] === 'approval_required' && call[2] === 'true'));
  assert(dbCalls.some(call => call[0] === 'setting' && call[1] === 'auto_publish_enabled' && call[2] === 'false'));
  assert(dbCalls.some(call => call[0] === 'setting' && call[1] === 'daily_content_enabled' && call[2] === 'false'));
  assert.strictEqual(profile.production.narration.speedStatus, 'testing-not-standard');

  const engine = new TopicIntelligenceEngine(profile);
  const strong = engine.score({
    topic: 'Why subscriptions are so hard to cancel',
    angle: 'The economics of friction and recurring revenue',
    metrics: {
      demandEvidence: 88,
      curiosityContradiction: 91,
      packagingPotential: 86,
      relevance: 85,
      differentiation: 78,
      recency: 65,
      evergreenPotential: 92,
      visualPotential: 80,
      saturation: 35
    },
    evidence: [{ url: 'https://example.com/a' }, { url: 'https://example.com/b' }]
  });
  assert.strictEqual(strong.status, 'candidate');
  assert(strong.score >= 70);

  const noMarketProof = engine.score({
    topic: 'A clever-sounding idea with no proof',
    metrics: {
      demandEvidence: 30,
      curiosityContradiction: 95,
      packagingPotential: 90,
      relevance: 90,
      differentiation: 90,
      recency: 90,
      evergreenPotential: 90,
      visualPotential: 90,
      saturation: 10
    },
    evidence: []
  });
  assert.strictEqual(noMarketProof.status, 'reject');
  assert(noMarketProof.failures.some(item => item.startsWith('market evidence')));

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sereia-profile-test-'));
  await fs.mkdir(path.join(tmp, 'config', 'channels'), { recursive: true });
  const invalid = JSON.parse(JSON.stringify(profile));
  invalid.editorial.topicScoring.weights.demandEvidence = 23;
  await fs.writeFile(path.join(tmp, 'config', 'channels', 'bad.json'), JSON.stringify(invalid));
  const badRegistry = new ChannelProfileRegistry({ rootDir: tmp });
  await assert.rejects(
    () => badRegistry.loadProfile('bad'),
    error => Array.isArray(error.details) && error.details.some(detail => detail.includes('weights must total 100'))
  );

  console.log('✓ editorial-core tests passed');
}

run().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
