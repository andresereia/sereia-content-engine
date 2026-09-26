'use strict';

const path = require('path');
const { ChannelProfileRegistry } = require('../core/channel-profile-registry');

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const registry = new ChannelProfileRegistry({ rootDir });
  const profiles = await registry.listProfiles();
  if (!profiles.length) throw new Error('No valid channel profiles found');

  for (const profile of profiles) {
    console.log(`✓ ${profile.id} — ${profile.channelName} (schema v${profile.schemaVersion})`);
  }
  const active = await registry.loadActiveProfile();
  console.log(`\nActive profile: ${active.id} — ${active.identity.channelName}`);
}

main().catch(error => {
  console.error(`Profile validation failed: ${error.message}`);
  if (error.details?.length) error.details.forEach(detail => console.error(`  - ${detail}`));
  process.exitCode = 1;
});
