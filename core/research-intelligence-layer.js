'use strict';

class ResearchIntelligenceLayer {
  constructor(profile, options = {}) {
    this.profile = profile;
    this.config = {
      enabled: true,
      mode: 'augment',
      lookbackDays: 365,
      maxQueries: 5,
      resultsPerQuery: 5,
      upstreamSlots: 10,
      expansionSlots: 5,
      cacheMinutes: 30,
      ...(profile?.researchIntelligence || {}),
      ...(options.config || {})
    };
    this.now = options.now || (() => new Date());
    this.validateConfig();
  }

  validateConfig() {
    if (this.config.mode !== 'augment') throw new Error('Research intelligence mode must remain "augment"');
    const ranges = {
      lookbackDays: [1, 3650],
      maxQueries: [1, 10],
      resultsPerQuery: [1, 10],
      upstreamSlots: [1, 15],
      expansionSlots: [0, 15],
      cacheMinutes: [0, 1440]
    };
    for (const [key, [min, max]] of Object.entries(ranges)) {
      const value = Number(this.config[key]);
      if (!Number.isFinite(value) || value < min || value > max) {
        throw new Error(`researchIntelligence.${key} must be between ${min} and ${max}`);
      }
    }
  }

  buildQueries(upstreamTopics = []) {
    const seeds = [];
    const add = value => {
      const text = String(value || '').trim();
      if (!text || text.length < 6) return;
      const key = text.toLowerCase();
      if (!seeds.some(item => item.toLowerCase() === key)) seeds.push(text);
    };

    for (const pillar of this.profile?.strategy?.contentPillars || []) add(pillar);
    for (const topic of upstreamTopics) {
      const text = typeof topic === 'string' ? topic : topic?.topic;
      if (String(text || '').trim().includes(' ')) add(text);
      if (seeds.length >= this.config.maxQueries * 2) break;
    }

    return seeds.slice(0, this.config.maxQueries);
  }

  async expand({ youtube, upstreamTopics = [] }) {
    if (!this.config.enabled) {
      return { signals: [], diagnostics: this.buildDiagnostics([], 0, 0, 'disabled') };
    }
    if (!youtube?.search?.list || !youtube?.videos?.list) {
      throw new Error('YouTube client does not expose search.list and videos.list');
    }

    const queries = this.buildQueries(upstreamTopics);
    const signalsByVideo = new Map();
    let succeeded = 0;
    let failed = 0;

    for (const query of queries) {
      try {
        const searchResponse = await youtube.search.list({
          part: 'snippet',
          q: query,
          type: 'video',
          order: 'relevance',
          maxResults: this.config.resultsPerQuery,
          regionCode: this.profile?.identity?.region || 'US',
          relevanceLanguage: String(this.profile?.identity?.locale || 'en-US').split('-')[0],
          publishedAfter: this.publishedAfter()
        });
        const items = searchResponse?.data?.items || [];
        const ids = items.map(item => item?.id?.videoId).filter(Boolean);
        if (!ids.length) {
          succeeded++;
          continue;
        }

        const detailsResponse = await youtube.videos.list({
          part: 'snippet,statistics',
          id: ids.join(',')
        });
        const details = new Map((detailsResponse?.data?.items || []).map(video => [video.id, video]));

        for (const item of items) {
          const videoId = item?.id?.videoId;
          if (!videoId) continue;
          const video = details.get(videoId) || {};
          const snippet = video.snippet || item.snippet || {};
          const viewCount = Number(video.statistics?.viewCount || 0);
          const publishedAt = snippet.publishedAt || item.snippet?.publishedAt || null;
          const title = String(snippet.title || '').trim();
          if (!title) continue;

          const score = this.scoreVideo({ viewCount, publishedAt });
          const url = `https://www.youtube.com/watch?v=${videoId}`;
          const existing = signalsByVideo.get(videoId);
          const evidence = {
            url,
            title,
            publisher: snippet.channelTitle || 'YouTube search result',
            publishedAt,
            sourceType: 'video',
            viewCount,
            query,
            source: 'sereia-youtube-search'
          };
          const signal = {
            topic: title,
            score,
            sources: ['sereia-youtube-search'],
            evidence: [evidence],
            researchMeta: {
              query,
              viewCount,
              ageDays: this.ageDays(publishedAt),
              expansion: true
            }
          };
          if (!existing || score > existing.score) signalsByVideo.set(videoId, signal);
        }
        succeeded++;
      } catch (_error) {
        failed++;
      }
    }

    const signals = [...signalsByVideo.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, this.config.expansionSlots) * 3);
    const status = failed === 0 ? 'ok' : succeeded === 0 ? 'degraded' : 'partial';

    return {
      signals,
      diagnostics: this.buildDiagnostics(queries, succeeded, failed, status)
    };
  }

  mergeSignals(upstream = [], expansion = []) {
    const primaryUpstream = upstream.slice(0, this.config.upstreamSlots);
    const chosenExpansion = expansion.slice(0, this.config.expansionSlots);
    const seen = new Set();
    const merged = [];

    const add = item => {
      const key = this.signalKey(item);
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(item);
    };

    primaryUpstream.forEach(add);
    chosenExpansion.forEach(add);
    upstream.slice(this.config.upstreamSlots).forEach(add);
    expansion.slice(this.config.expansionSlots).forEach(add);

    return merged.slice(0, 50);
  }

  scoreVideo({ viewCount, publishedAt }) {
    const views = Math.max(0, Number(viewCount) || 0);
    const age = this.ageDays(publishedAt);
    const base = views / 100000;
    const freshness = age == null ? 1 : age <= 30 ? 1.35 : age <= 90 ? 1.2 : age <= 180 ? 1.08 : 1;
    return Number((base * freshness).toFixed(3));
  }

  ageDays(value) {
    const time = Date.parse(value || '');
    if (!Number.isFinite(time)) return null;
    return Math.max(0, Math.round((this.now().getTime() - time) / 86400000));
  }

  publishedAfter() {
    return new Date(this.now().getTime() - this.config.lookbackDays * 86400000).toISOString();
  }

  signalKey(item) {
    const url = item?.evidence?.find(source => source?.url)?.url;
    if (url) return `url:${url}`;
    const topic = String(item?.topic || '').trim().toLowerCase();
    return topic ? `topic:${topic}` : null;
  }

  buildDiagnostics(queries, succeeded, failed, status) {
    return {
      schemaVersion: 1,
      status,
      mode: 'augment',
      provider: 'youtube-data-api',
      preservesUpstreamResearch: true,
      queries,
      queriesAttempted: Array.isArray(queries) ? queries.length : 0,
      queriesSucceeded: succeeded,
      queriesFailed: failed,
      estimatedQuotaUnits: succeeded * 101 + failed * 100,
      generatedAt: this.now().toISOString()
    };
  }
}

module.exports = { ResearchIntelligenceLayer };
