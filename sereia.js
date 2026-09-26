'use strict';

require('dotenv').config();

const { installChannelProfileBootstrap } = require('./core/bootstrap');
const { installStrategyShadowBootstrap } = require('./core/strategy-shadow-bootstrap');

installChannelProfileBootstrap();
installStrategyShadowBootstrap();

const { YouTubeAutomationAgent } = require('./index');

const agent = new YouTubeAutomationAgent();
agent.start().catch(error => {
  console.error('Sereia Content Engine fatal error:', error);
  process.exitCode = 1;
});
