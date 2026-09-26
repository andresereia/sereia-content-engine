'use strict';

const path = require('path');
const { Database } = require('../database/db');
const { ChannelProfileRegistry } = require('./channel-profile-registry');

const BRIDGE_SYMBOL = Symbol.for('sereia.content-engine.channel-profile-bridge');

function installChannelProfileBootstrap(options = {}) {
  const prototype = Database.prototype;
  if (prototype[BRIDGE_SYMBOL]) return prototype[BRIDGE_SYMBOL];

  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  const originalInitialize = prototype.initialize;
  if (typeof originalInitialize !== 'function') {
    throw new Error('AgentTube Database.initialize() was not found; profile bridge cannot be installed safely');
  }

  prototype.initialize = async function sereiaInitialize(...args) {
    const result = await originalInitialize.apply(this, args);
    const registry = new ChannelProfileRegistry({
      rootDir,
      logger: this.logger || console
    });
    const profile = await registry.loadActiveProfile();
    const applied = await registry.applyToAgentTube(this, profile);

    this.sereiaChannelProfiles = registry;
    this.sereiaActiveChannelProfile = profile;
    this.logger?.info?.(`Sereia profile active: ${applied.id} — ${applied.channelName}`);
    return result;
  };

  const state = Object.freeze({ originalInitialize, rootDir });
  Object.defineProperty(prototype, BRIDGE_SYMBOL, {
    value: state,
    configurable: false,
    enumerable: false,
    writable: false
  });
  return state;
}

module.exports = { installChannelProfileBootstrap };
