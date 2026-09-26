'use strict';

require('dotenv').config();

const { installChannelProfileBootstrap } = require('./core/bootstrap');

installChannelProfileBootstrap();

const { YouTubeAutomationAgent } = require('./index');

const agent = new YouTubeAutomationAgent();
agent.start().catch(error => {
  console.error('Sereia Content Engine fatal error:', error);
  process.exitCode = 1;
});
