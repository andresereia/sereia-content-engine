'use strict';

require('dotenv').config();

const { installChannelProfileBootstrap } = require('./core/bootstrap');
const { installResearchIntelligenceBootstrap } = require('./core/research-intelligence-bootstrap');
const { installStrategyShadowBootstrap } = require('./core/strategy-shadow-bootstrap');
const { installEditorialPackagingBootstrap } = require('./core/editorial-packaging-bootstrap');
const { installNarrativeSceneBlueprintBootstrap } = require('./core/narrative-scene-blueprint-bootstrap');
const { installSereiaDiagnosticsAPI } = require('./core/sereia-diagnostics-api');

installChannelProfileBootstrap();
installResearchIntelligenceBootstrap();
installStrategyShadowBootstrap();
installEditorialPackagingBootstrap();
installNarrativeSceneBlueprintBootstrap();

const { YouTubeAutomationAgent } = require('./index');

const agent = new YouTubeAutomationAgent();
installSereiaDiagnosticsAPI(agent);
agent.start().catch(error => {
  console.error('Sereia Content Engine fatal error:', error);
  process.exitCode = 1;
});
