'use strict';

const assert = require('assert');
const { SereiaDiagnosticsService } = require('../core/sereia-diagnostics-service');

async function run() {
  const profile = {
    id: 'cidade-economica',
    identity: { channelName: 'Cidade Econômica', locale: 'en-US', region: 'US' },
    researchIntelligence: { enabled: true, mode: 'augment' },
    editorial: { topicScoring: { shadowModeEnabled: true } },
    editorialPackaging: { enabled: true, mode: 'assist' },
    narrativeBlueprint: { enabled: true, mode: 'shadow' }
  };

  const db = {
    async listOperatorRuns() {
      return [{
        id: 'run_1',
        research: {
          sereiaResearchIntelligence: {
            status: 'ok', mode: 'augment', provider: 'youtube-data-api',
            upstreamSignalCount: 10, expansionSignalCount: 5, mergedSignalCount: 15,
            upstreamSignalsPreserved: 10, queriesAttempted: 5, queriesSucceeded: 5, queriesFailed: 0
          },
          sereiaTopicIntelligence: {
            mode: 'shadow', affectsPlanSelection: false,
            summary: { evaluated: 2, rankDisagreements: 1 },
            items: [
              { topic: 'Topic A', upstreamRank: 1, sereiaRank: 2, rankDelta: -1, sereiaScore: 78, status: 'candidate', confidence: 'high', evidenceCount: 3, failures: [] },
              { topic: 'Topic B', upstreamRank: 2, sereiaRank: 1, rankDelta: 1, sereiaScore: 84, status: 'candidate', confidence: 'medium', evidenceCount: 2, failures: [] }
            ]
          }
        },
        plan: [{ topic: 'Topic A' }, { topic: 'Topic B' }]
      }];
    },
    async getPipelineOverview() {
      return [
        { id: 'prod_1', title: 'Video one', status: 'ready', review_status: 'needs_review' },
        { id: 'prod_2', title: 'Video two', status: 'ready', review_status: 'needs_review' },
        { id: 'prod_3', title: 'Video three', status: 'ready', review_status: 'needs_review' }
      ];
    },
    async getProductionBundle(id) {
      return {
        id,
        script: {
          title: `Title ${id}`,
          metadata: {
            sereiaEditorialBrief: {
              generationSource: 'ai',
              promise: `Promise ${id}`,
              angle: `Angle ${id}`,
              hook: `Hook ${id}`,
              titleCandidates: ['A', 'B'],
              thumbnailConcept: { coreTension: 'visible vs hidden' }
            },
            sereiaNarrativeBlueprint: {
              mode: 'shadow',
              diagnostics: {
                blueprintBeatCount: 12,
                sourceSectionCount: 4,
                averageBeatSeconds: 9.5,
                weakVisualBeatCount: 2,
                warnings: id === 'prod_1' ? ['generic_greeting_detected'] : []
              }
            }
          }
        }
      };
    }
  };

  const registry = { async loadActiveProfile() { return profile; } };
  const service = new SereiaDiagnosticsService({
    db, registry, now: () => new Date('2026-09-26T12:00:00Z')
  });
  const result = await service.snapshot();

  assert.strictEqual(result.principle, 'upstream-first');
  assert.strictEqual(result.profile.id, 'cidade-economica');
  assert.strictEqual(result.layers.length, 4);
  assert(result.layers.every(layer => layer.status === 'observed'));
  assert.strictEqual(result.research.upstreamSignalCount, 10);
  assert.strictEqual(result.research.expansionSignalCount, 5);
  assert.strictEqual(result.topicIntelligence.summary.rankDisagreements, 1);
  assert.strictEqual(result.topicIntelligence.items[1].sereiaRank, 1);
  assert.strictEqual(result.recentContent.length, 3);
  assert.strictEqual(result.validation.packagingSamples, 3);
  assert.strictEqual(result.validation.narrativeSamples, 3);
  assert.strictEqual(result.validation.status, 'review_evidence');
  assert.strictEqual(result.validation.automaticPromotionAllowed, false);
  assert.strictEqual(result.warningCounts.generic_greeting_detected, 1);

  const emptyService = new SereiaDiagnosticsService({
    db: {
      async listOperatorRuns() { return []; },
      async getPipelineOverview() { return []; }
    },
    registry,
    now: () => new Date('2026-09-26T12:00:00Z')
  });
  const empty = await emptyService.snapshot();
  assert.strictEqual(empty.validation.status, 'collecting_evidence');
  assert(empty.layers.some(layer => layer.status === 'waiting_for_run'));
  assert(empty.layers.some(layer => layer.status === 'waiting_for_production'));

  console.log('✓ sereia-diagnostics-service tests passed');
}

run().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
