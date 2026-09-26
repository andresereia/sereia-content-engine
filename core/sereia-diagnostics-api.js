'use strict';

const fs = require('fs').promises;
const path = require('path');
const { ChannelProfileRegistry } = require('./channel-profile-registry');
const { SereiaDiagnosticsService } = require('./sereia-diagnostics-service');

function installSereiaDiagnosticsAPI(agent, options = {}) {
  if (!agent?.app?.get) throw new Error('YouTube Automation Agent Express app is unavailable');
  if (agent.__sereiaDiagnosticsInstalled) return false;

  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  const RegistryClass = options.RegistryClass || ChannelProfileRegistry;
  const ServiceClass = options.ServiceClass || SereiaDiagnosticsService;

  // Register before AgentTube setupAPI() so the normal root can be enhanced without editing upstream index.html.
  agent.app.get('/', async (_req, res, next) => {
    try {
      const file = path.join(rootDir, 'dashboard', 'index.html');
      const html = await fs.readFile(file, 'utf8');
      const scriptTag = '<script src="/sereia-intelligence.js" defer></script>';
      const enhanced = html.includes(scriptTag)
        ? html
        : html.replace('</body>', `  ${scriptTag}\n</body>`);
      res.type('html').send(enhanced);
    } catch (error) {
      next(error);
    }
  });

  agent.app.get('/api/sereia/diagnostics', async (_req, res) => {
    try {
      if (!agent.db) {
        return res.status(503).json({
          schemaVersion: 1,
          status: 'initializing',
          error: 'Database is not initialized yet'
        });
      }
      const registry = new RegistryClass({ rootDir, logger: agent.logger || console });
      const service = new ServiceClass({ db: agent.db, registry });
      const result = await service.snapshot();
      return res.json(result);
    } catch (error) {
      return res.status(500).json({
        schemaVersion: 1,
        status: 'unavailable',
        error: error.message
      });
    }
  });

  Object.defineProperty(agent, '__sereiaDiagnosticsInstalled', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  return true;
}

module.exports = { installSereiaDiagnosticsAPI };
