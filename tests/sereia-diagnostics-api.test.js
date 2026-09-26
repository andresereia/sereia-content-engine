'use strict';

const assert = require('assert');
const path = require('path');
const { installSereiaDiagnosticsAPI } = require('../core/sereia-diagnostics-api');

async function run() {
  const routes = new Map();
  const app = {
    get(route, handler) { routes.set(route, handler); }
  };
  const agent = {
    app,
    db: { ready: true },
    logger: { warn() {}, info() {} }
  };

  class FakeRegistry {
    constructor() {}
  }
  class FakeService {
    constructor(options) {
      assert.strictEqual(options.db, agent.db);
    }
    async snapshot() {
      return { schemaVersion: 1, profile: { id: 'cidade-economica' }, layers: [] };
    }
  }

  const rootDir = path.resolve(__dirname, '..');
  assert.strictEqual(installSereiaDiagnosticsAPI(agent, { rootDir, RegistryClass: FakeRegistry, ServiceClass: FakeService }), true);
  assert.strictEqual(installSereiaDiagnosticsAPI(agent, { rootDir, RegistryClass: FakeRegistry, ServiceClass: FakeService }), false);
  assert(routes.has('/'));
  assert(routes.has('/api/sereia/diagnostics'));

  let html = '';
  await routes.get('/')({}, {
    type(value) { assert.strictEqual(value, 'html'); return this; },
    send(value) { html = value; return this; }
  }, error => { throw error; });
  assert(html.includes('<script src="/sereia-intelligence.js" defer></script>'));
  assert.strictEqual((html.match(/sereia-intelligence\.js/g) || []).length, 1);

  let json = null;
  await routes.get('/api/sereia/diagnostics')({}, {
    status(code) { this.statusCode = code; return this; },
    json(value) { json = value; return this; }
  });
  assert.strictEqual(json.profile.id, 'cidade-economica');

  const initializingRoutes = new Map();
  const initializingAgent = {
    app: { get(route, handler) { initializingRoutes.set(route, handler); } },
    db: null,
    logger: {}
  };
  installSereiaDiagnosticsAPI(initializingAgent, { rootDir, RegistryClass: FakeRegistry, ServiceClass: FakeService });
  let statusCode = null;
  let initializing = null;
  await initializingRoutes.get('/api/sereia/diagnostics')({}, {
    status(code) { statusCode = code; return this; },
    json(value) { initializing = value; return this; }
  });
  assert.strictEqual(statusCode, 503);
  assert.strictEqual(initializing.status, 'initializing');

  console.log('✓ sereia-diagnostics-api tests passed');
}

run().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
