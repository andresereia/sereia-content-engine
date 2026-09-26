'use strict';

const assert = require('assert');
const { ChannelProfileRegistry } = require('../core/channel-profile-registry');
const { EditorialPackagingLayer } = require('../core/editorial-packaging-layer');

async function run() {
  const registry = new ChannelProfileRegistry();
  const profile = await registry.loadProfile('cidade-economica');
  const layer = new EditorialPackagingLayer(profile, { now: () => new Date('2026-09-26T12:00:00Z') });
  const strategy = {
    topic: 'Why subscriptions are so hard to cancel',
    angle: 'The economics of cancellation friction and recurring revenue',
    contentType: 'Explainer',
    targetAudience: 'US adults',
    contentPillar: 'hidden fees and recurring payments',
    planRationale: 'Recurring payments are a familiar pain point with strong evidence.',
    researchSources: [
      { title: 'Subscription cancellation report', url: 'https://example.com/a', publisher: 'A' },
      { title: 'Recurring revenue analysis', url: 'https://example.com/b', publisher: 'B' }
    ]
  };

  const fakeAI = {
    isAvailable() { return true; },
    async generateText() {
      return JSON.stringify({
        promise: 'Show why cancelling can be intentionally harder than subscribing.',
        angle: 'Follow the incentives that turn cancellation friction into recurring revenue.',
        hook: 'Signing up takes seconds. Cancelling can take a maze of clicks. That difference is valuable.',
        titleCandidates: [
          'Why Subscriptions Are So Hard to Cancel',
          'The Business Model Behind Hard-to-Cancel Subscriptions',
          'Why Cancelling Costs Companies Money'
        ],
        thumbnailConcept: {
          coreTension: 'easy signup versus difficult cancellation',
          visualSubject: 'Beto trapped between a one-click signup button and a maze-like cancel screen',
          contrast: 'green easy path versus complicated exit path',
          text: 'TRY TO CANCEL NOW',
          composition: 'split frame with the easy signup on the left and the cancellation maze on the right'
        },
        rationale: 'The packaging turns a familiar annoyance into a business mechanism.'
      });
    }
  };

  const brief = await layer.build({ strategy, aiTextService: fakeAI });
  assert.strictEqual(brief.generationSource, 'ai');
  assert.strictEqual(brief.mode, 'assist');
  assert.strictEqual(brief.preservesUpstreamAgents, true);
  assert.strictEqual(brief.titleCandidates.length, 3);
  assert.strictEqual(brief.thumbnailConcept.text, 'TRY TO CANCEL');
  assert(brief.angle.includes('recurring revenue'));

  const fallback = await layer.build({
    strategy,
    aiTextService: { isAvailable() { return false; } }
  });
  assert.strictEqual(fallback.generationSource, 'fallback');
  assert(fallback.promise.includes('subscriptions'));
  assert(fallback.titleCandidates.length >= 1);

  console.log('✓ editorial-packaging-layer tests passed');
}

run().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
