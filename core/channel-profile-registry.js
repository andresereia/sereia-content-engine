'use strict';

const fs = require('fs').promises;
const path = require('path');

const PROFILE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

class ChannelProfileValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ChannelProfileValidationError';
    this.details = details;
  }
}

class ChannelProfileRegistry {
  constructor(options = {}) {
    this.rootDir = options.rootDir || path.resolve(__dirname, '..');
    this.profilesDir = options.profilesDir || path.join(this.rootDir, 'config', 'channels');
    this.logger = options.logger || console;
  }

  async listProfiles() {
    const entries = await fs.readdir(this.profilesDir, { withFileTypes: true });
    const profiles = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name === 'active-profile.json') continue;
      const id = entry.name.replace(/\.json$/i, '');
      try {
        const profile = await this.loadProfile(id);
        profiles.push({
          id: profile.id,
          channelName: profile.identity.channelName,
          schemaVersion: profile.schemaVersion
        });
      } catch (error) {
        this.logger.warn?.(`Skipping invalid channel profile ${entry.name}: ${error.message}`);
      }
    }

    return profiles.sort((a, b) => a.id.localeCompare(b.id));
  }

  async resolveActiveProfileId() {
    const fromEnv = String(process.env.CHANNEL_PROFILE_ID || '').trim();
    if (fromEnv) return this.validateProfileId(fromEnv);

    const markerPath = path.join(this.profilesDir, 'active-profile.json');
    try {
      const raw = JSON.parse(await fs.readFile(markerPath, 'utf8'));
      return this.validateProfileId(raw.id);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    return 'cidade-economica';
  }

  validateProfileId(id) {
    const normalized = String(id || '').trim().toLowerCase();
    if (!PROFILE_ID_PATTERN.test(normalized)) {
      throw new ChannelProfileValidationError(`Invalid channel profile id: ${id}`);
    }
    return normalized;
  }

  async loadActiveProfile() {
    return this.loadProfile(await this.resolveActiveProfileId());
  }

  async loadProfile(id) {
    const safeId = this.validateProfileId(id);
    const filePath = path.join(this.profilesDir, `${safeId}.json`);
    const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
    this.validate(raw, safeId);
    return Object.freeze(raw);
  }

  validate(profile, expectedId = null) {
    const errors = [];
    const requireText = (value, key) => {
      if (typeof value !== 'string' || !value.trim()) errors.push(`${key} must be a non-empty string`);
    };
    const requireArray = (value, key) => {
      if (!Array.isArray(value) || value.length === 0) errors.push(`${key} must be a non-empty array`);
    };

    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      throw new ChannelProfileValidationError('Channel profile must be a JSON object');
    }

    if (profile.schemaVersion !== 1) errors.push('schemaVersion must be 1');
    requireText(profile.id, 'id');
    if (profile.id && this.validateProfileId(profile.id) !== profile.id) errors.push('id must already be normalized');
    if (expectedId && profile.id !== expectedId) errors.push(`profile id ${profile.id} does not match filename ${expectedId}`);

    const identity = profile.identity || {};
    requireText(identity.channelName, 'identity.channelName');
    requireText(identity.goal, 'identity.goal');
    requireText(identity.targetAudience, 'identity.targetAudience');
    requireText(identity.locale, 'identity.locale');
    requireText(identity.timezone, 'identity.timezone');

    const strategy = profile.strategy || {};
    requireText(strategy.objective, 'strategy.objective');
    requireText(strategy.audience, 'strategy.audience');
    requireText(strategy.valueProposition, 'strategy.valueProposition');
    requireArray(strategy.contentPillars, 'strategy.contentPillars');
    requireText(strategy.defaultFormat, 'strategy.defaultFormat');
    requireText(strategy.defaultLength, 'strategy.defaultLength');

    const editorial = profile.editorial || {};
    requireText(editorial.brandVoice, 'editorial.brandVoice');
    requireArray(editorial.bannedTopics, 'editorial.bannedTopics');

    const scoring = editorial.topicScoring || {};
    const weights = scoring.weights || {};
    const weightValues = Object.values(weights);
    if (!weightValues.length || weightValues.some(value => typeof value !== 'number' || value < 0)) {
      errors.push('editorial.topicScoring.weights must contain non-negative numeric weights');
    } else {
      const total = weightValues.reduce((sum, value) => sum + value, 0);
      if (Math.abs(total - 100) > 0.001) errors.push(`editorial.topicScoring.weights must total 100; got ${total}`);
    }

    const visual = profile.visual || {};
    requireText(visual.stylePrompt, 'visual.stylePrompt');
    if (typeof visual.assetReuseTarget !== 'number' || visual.assetReuseTarget < 0 || visual.assetReuseTarget > 1) {
      errors.push('visual.assetReuseTarget must be between 0 and 1');
    }

    if (errors.length) {
      throw new ChannelProfileValidationError(`Invalid channel profile ${profile.id || '(unknown)'}`, errors);
    }
    return true;
  }

  toAgentTubeProfile(profile) {
    return {
      channelName: profile.identity.channelName,
      goal: profile.identity.goal,
      targetAudience: profile.identity.targetAudience,
      brandVoice: profile.editorial.brandVoice,
      defaultStyle: profile.strategy.defaultFormat,
      callToAction: profile.editorial.callToAction || '',
      bannedTopics: profile.editorial.bannedTopics,
      visualStyle: profile.visual.stylePrompt,
      timezone: profile.identity.timezone
    };
  }

  toAgentTubeStrategy(profile) {
    const strategy = profile.strategy;
    return {
      objective: strategy.objective,
      audience: strategy.audience,
      valueProposition: strategy.valueProposition,
      contentPillars: strategy.contentPillars,
      cadencePerWeek: strategy.cadencePerWeek ?? 1,
      videosPerRun: strategy.videosPerRun ?? 1,
      defaultFormat: strategy.defaultFormat,
      defaultLength: strategy.defaultLength,
      successMetric: strategy.successMetric || 'CTR, retention, watch time and views',
      primaryKpi: strategy.primaryKpi || 'views',
      targetValue: strategy.targetValue ?? null,
      targetWindowDays: strategy.targetWindowDays ?? 28,
      monthlyBudget: strategy.monthlyBudget ?? null,
      outcomeCurrency: strategy.outcomeCurrency || 'USD',
      constraints: strategy.constraints || '',
      status: 'draft'
    };
  }

  async applyToAgentTube(db, profile) {
    if (!db || typeof db.saveChannelProfile !== 'function' || typeof db.saveChannelStrategy !== 'function') {
      throw new Error('AgentTube database adapter is missing channel profile/strategy methods');
    }

    await db.saveChannelProfile(this.toAgentTubeProfile(profile));
    await db.saveChannelStrategy(this.toAgentTubeStrategy(profile));

    if (typeof db.setSetting === 'function') {
      const safeSettings = {
        active_channel_profile_id: profile.id,
        approval_required: 'true',
        automation_paused: 'true',
        auto_publish_enabled: 'false',
        daily_content_enabled: 'false',
        channel_timezone: profile.identity.timezone
      };
      for (const [key, value] of Object.entries(safeSettings)) {
        await db.setSetting(key, value, `Managed by channel profile ${profile.id}`);
      }
    }

    return {
      id: profile.id,
      channelName: profile.identity.channelName,
      safety: {
        approvalRequired: true,
        automationPaused: true,
        autoPublishEnabled: false
      }
    };
  }
}

module.exports = {
  ChannelProfileRegistry,
  ChannelProfileValidationError
};
