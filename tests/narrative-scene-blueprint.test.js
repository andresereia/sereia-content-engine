'use strict';

const assert = require('assert');
const { ChannelProfileRegistry } = require('../core/channel-profile-registry');
const { NarrativeSceneBlueprint } = require('../core/narrative-scene-blueprint');

async function run() {
  const registry = new ChannelProfileRegistry();
  const profile = await registry.loadProfile('cidade-economica');
  const analyzer = new NarrativeSceneBlueprint(profile, {
    now: () => new Date('2026-09-26T12:00:00Z')
  });

  const script = {
    title: 'Why Subscriptions Are So Hard to Cancel',
    hook: {
      text: 'Signing up takes seconds. Cancelling can take a maze of clicks. That difference is valuable.'
    },
    introduction: {
      greeting: 'Hey everyone, welcome back to the channel!',
      topicIntro: 'Today we are looking at why subscription businesses can make the exit feel harder than the entrance.',
      valueProposition: 'You will see how cancellation friction can protect recurring revenue and change who pays.',
      credibility: "I've spent months researching this topic."
    },
    mainContent: {
      sections: [
        {
          title: 'The easy entrance',
          content: [
            'A subscription company wants the signup path to feel almost invisible, so the price, payment screen, free trial, and card approval are arranged to remove hesitation.',
            'Once the recurring payment is active, the company benefits each time a customer forgets, delays, or decides that cancelling is not worth the effort.'
          ],
          duration: 90
        },
        {
          title: 'The expensive exit',
          content: [
            'Cancellation adds friction through extra menus, confirmation screens, retention offers, waiting periods, or customer-service steps, and every extra step can reduce the number of people who finish the process.',
            'For the customer, that friction can turn a small monthly fee into a larger hidden cost. For the company, the same delay can preserve revenue for another billing cycle.'
          ],
          duration: 100
        }
      ]
    },
    conclusion: {
      recap: [
        'The signup path is optimized to remove friction.',
        'The cancellation path can create friction because recurring revenue has value.'
      ],
      finalThought: 'The next time an exit feels harder than an entrance, look for the incentive hiding underneath it.'
    },
    callToAction: {
      subscribe: 'Subscribe for more hidden economics in everyday life.',
      like: 'Like the video if this changed how you see subscriptions.',
      comment: 'Tell us which cancellation process surprised you most.'
    },
    metadata: {
      sereiaEditorialBrief: {
        promise: 'Show why cancelling can be intentionally harder than subscribing by revealing the incentives behind recurring revenue.'
      }
    }
  };

  const blueprint = analyzer.analyze(script);
  assert.strictEqual(blueprint.mode, 'shadow');
  assert.strictEqual(blueprint.affectsScript, false);
  assert.strictEqual(blueprint.affectsProduction, false);
  assert.strictEqual(blueprint.upstreamScenePipelinePreserved, true);
  assert.strictEqual(blueprint.diagnostics.genericGreetingDetected, true);
  assert.strictEqual(blueprint.diagnostics.credibilityRiskDetected, true);
  assert(blueprint.diagnostics.blueprintBeatCount > blueprint.diagnostics.sourceSectionCount);
  assert(blueprint.diagnostics.warnings.includes('generic_greeting_detected'));
  assert(blueprint.diagnostics.warnings.includes('unverified_first_person_credibility_detected'));
  assert.strictEqual(blueprint.beats[0].source, 'hook');
  assert(blueprint.beats.every(beat => beat.assetStrategy === 'library-first'));
  assert(blueprint.beats.every(beat => beat.recurringCharacter === 'Beto'));
  assert(blueprint.beats.some(beat => beat.visualIntent !== 'generic explanatory visual'));

  const sourceSectionCount = script.mainContent.sections.length;
  const sectionBeats = blueprint.beats.filter(beat => beat.source === 'section');
  assert(sectionBeats.length > sourceSectionCount, 'long sections should split into finer visual beats');

  console.log('✓ narrative-scene-blueprint tests passed');
}

run().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
