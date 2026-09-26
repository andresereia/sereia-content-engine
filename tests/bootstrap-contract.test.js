'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function run() {
  const root = path.resolve(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const entry = fs.readFileSync(path.join(root, 'sereia.js'), 'utf8');
  const bootstrap = fs.readFileSync(path.join(root, 'core', 'bootstrap.js'), 'utf8');

  assert.strictEqual(pkg.scripts.start, 'node sereia.js');
  assert(entry.includes('installChannelProfileBootstrap()'));
  assert(entry.includes("require('./index')"));
  assert(bootstrap.includes('Database.prototype') || bootstrap.includes('const prototype = Database.prototype'));
  assert(bootstrap.includes('applyToAgentTube'));
  assert(!entry.includes('autoPublish = true'));

  console.log('✓ bootstrap contract passed');
}

run();
