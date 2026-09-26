/* Sereia Content Engine diagnostics view. Loaded additively after AgentTube dashboard scripts. */
/* global api */
(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const label = value => String(value || 'unknown').replaceAll('_', ' ');

  function installStyles() {
    if ($('#sereia-intelligence-styles')) return;
    const style = document.createElement('style');
    style.id = 'sereia-intelligence-styles';
    style.textContent = `
      .sereia-layer-list{display:grid;gap:12px}.sereia-layer{display:grid;grid-template-columns:minmax(160px,1fr) auto;gap:8px 16px;padding:16px;border:1px solid var(--border,rgba(255,255,255,.09));border-radius:14px;background:rgba(255,255,255,.025)}
      .sereia-layer strong{display:block}.sereia-layer p{grid-column:1/-1;margin:0;color:var(--muted,#8f98a8);font-size:.88rem;line-height:1.5}.sereia-status{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;align-self:start;padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.06)}
      .sereia-status.observed{color:#7ee2ae;background:rgba(50,190,120,.10)}.sereia-status.collecting_evidence,.sereia-status.waiting_for_run,.sereia-status.waiting_for_production{color:#e7c86f;background:rgba(220,170,50,.10)}.sereia-status.disabled{color:#8992a1}
      .sereia-table{width:100%;border-collapse:collapse;font-size:.86rem}.sereia-table th,.sereia-table td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--border,rgba(255,255,255,.08));vertical-align:top}.sereia-table th{color:var(--muted,#8f98a8);font-weight:600}.sereia-delta.positive{color:#7ee2ae}.sereia-delta.negative{color:#ff8894}
      .sereia-content-list{display:grid;gap:12px}.sereia-content-card{padding:16px;border:1px solid var(--border,rgba(255,255,255,.09));border-radius:14px;background:rgba(255,255,255,.025)}.sereia-content-card h3{margin:0 0 6px;font-size:.98rem}.sereia-content-card p{margin:7px 0;color:var(--muted,#8f98a8);font-size:.86rem;line-height:1.5}.sereia-chip-row{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.sereia-chip{font-size:.7rem;padding:4px 7px;border-radius:999px;background:rgba(255,255,255,.06);color:var(--muted,#a9b1bf)}
      .sereia-note{padding:14px 16px;border:1px solid rgba(126,226,174,.18);background:rgba(126,226,174,.045);border-radius:14px;color:var(--muted,#a8b1bf);font-size:.86rem;line-height:1.55}.sereia-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}.sereia-loading{padding:34px;text-align:center;color:var(--muted,#8f98a8)}@media(max-width:900px){.sereia-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function installView() {
    if ($('#intelligence-view')) return;
    const nav = $('nav[aria-label="Main navigation"]');
    const settings = nav?.querySelector('[data-view="settings"]');
    if (!nav || !settings) return;

    const button = document.createElement('button');
    button.className = 'nav-item';
    button.dataset.view = 'intelligence';
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 17.5h16M6 14l3-3 3 2 5-6 2 2"/><circle cx="6" cy="14" r="1"/><circle cx="9" cy="11" r="1"/><circle cx="12" cy="13" r="1"/><circle cx="17" cy="7" r="1"/></svg> Sereia Intelligence';
    nav.insertBefore(button, settings);

    const section = document.createElement('section');
    section.id = 'intelligence-view';
    section.className = 'view';
    section.innerHTML = `
      <div class="section-intro"><div><h2>Sereia Intelligence</h2><p>Evidence for the layers we added on top of AgentTube — without hiding what is still unproven.</p></div><span id="sereia-validation-status" class="status">Loading</span></div>
      <div class="stats-grid">
        <article class="stat"><span>Active profile</span><strong id="sereia-profile">—</strong><small>versioned channel configuration</small></article>
        <article class="stat"><span>Operator runs</span><strong id="sereia-runs">—</strong><small>research evidence observed</small></article>
        <article class="stat"><span>Production samples</span><strong id="sereia-samples">—</strong><small>recent content inspected</small></article>
        <article class="stat"><span>Rank disagreements</span><strong id="sereia-disagreements">—</strong><small>AgentTube order vs. Sereia shadow rank</small></article>
      </div>
      <div class="sereia-grid">
        <article class="panel"><div class="panel-heading"><div><p class="eyebrow">LAYER STATUS</p><h2>What is proven so far</h2></div></div><div id="sereia-layers" class="sereia-layer-list"></div></article>
        <article class="panel"><div class="panel-heading"><div><p class="eyebrow">RESEARCH</p><h2>Latest signal expansion</h2></div></div><div id="sereia-research"></div></article>
      </div>
      <article class="panel"><div class="panel-heading"><div><p class="eyebrow">TOPIC SHADOW</p><h2>Where rankings differ</h2></div></div><div id="sereia-topic-table"></div></article>
      <div class="sereia-grid">
        <article class="panel"><div class="panel-heading"><div><p class="eyebrow">RECENT PRODUCTIONS</p><h2>Packaging & narrative evidence</h2></div></div><div id="sereia-content" class="sereia-content-list"></div></article>
        <article class="panel"><div class="panel-heading"><div><p class="eyebrow">PROMOTION GATE</p><h2>Do not automate what is not proven</h2></div></div><div id="sereia-validation"></div></article>
      </div>`;
    const settingsView = $('#settings-view');
    settingsView?.parentNode?.insertBefore(section, settingsView);

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      activate(button, section);
      loadDiagnostics();
    });

    nav.addEventListener('click', event => {
      const other = event.target.closest('.nav-item');
      if (other && other !== button) section.classList.remove('active');
    });
  }

  function activate(button, section) {
    $$('.nav-item').forEach(item => item.classList.toggle('active', item === button));
    $$('.view').forEach(view => view.classList.toggle('active', view === section));
    const eyebrow = $('#view-eyebrow');
    const title = $('#view-title');
    if (eyebrow) eyebrow.textContent = 'SEREIA INTELLIGENCE';
    if (title) title.textContent = 'Measure before you automate.';
    document.title = 'Sereia Intelligence · Automation Studio';
  }

  async function loadDiagnostics() {
    const layers = $('#sereia-layers');
    if (layers) layers.innerHTML = '<div class="sereia-loading">Loading Sereia evidence…</div>';
    try {
      const data = await api('/api/sereia/diagnostics');
      render(data);
    } catch (error) {
      if (layers) layers.innerHTML = `<div class="empty">${esc(error.message || 'Diagnostics unavailable')}</div>`;
      const status = $('#sereia-validation-status');
      if (status) { status.textContent = 'Unavailable'; status.className = 'status failed'; }
    }
  }

  function render(data) {
    $('#sereia-profile').textContent = data.profile?.channelName || data.profile?.id || '—';
    $('#sereia-runs').textContent = data.validation?.operatorRunsObserved ?? 0;
    $('#sereia-samples').textContent = data.validation?.productionSamplesObserved ?? 0;
    $('#sereia-disagreements').textContent = data.topicIntelligence?.summary?.rankDisagreements ?? 0;

    const validationStatus = data.validation?.status || 'collecting_evidence';
    const status = $('#sereia-validation-status');
    status.textContent = label(validationStatus);
    status.className = `status ${esc(validationStatus)}`;

    $('#sereia-layers').innerHTML = (data.layers || []).map(layerData => `
      <div class="sereia-layer">
        <div><strong>${esc(layerData.label)}</strong><small>${esc(label(layerData.mode))} · ${layerData.enabled ? 'enabled' : 'disabled'}</small></div>
        <span class="sereia-status ${esc(layerData.status)}">${esc(label(layerData.status))}</span>
        <p>${esc(layerData.evidence || 'No evidence recorded yet.')}</p>
      </div>`).join('') || '<div class="empty">No Sereia layers are configured.</div>';

    renderResearch(data.research);
    renderTopic(data.topicIntelligence);
    renderContent(data.recentContent || []);
    renderValidation(data.validation || {}, data.warningCounts || {});
  }

  function renderResearch(research) {
    const el = $('#sereia-research');
    if (!research) {
      el.innerHTML = '<div class="empty">Run the autonomous operator to collect research evidence.</div>';
      return;
    }
    el.innerHTML = `
      <div class="stats-grid compact">
        <article class="stat"><span>Upstream</span><strong>${esc(research.upstreamSignalCount)}</strong><small>AgentTube signals</small></article>
        <article class="stat"><span>Added</span><strong>${esc(research.expansionSignalCount)}</strong><small>complementary search signals</small></article>
        <article class="stat"><span>Merged</span><strong>${esc(research.mergedSignalCount)}</strong><small>candidate pool</small></article>
      </div>
      <p class="sereia-note">AgentTube remains the primary research foundation. Latest expansion: ${esc(research.queriesSucceeded)} successful queries, ${esc(research.queriesFailed)} failed. Upstream signals preserved: ${esc(research.upstreamSignalsPreserved)}.</p>`;
  }

  function renderTopic(topic) {
    const el = $('#sereia-topic-table');
    if (!topic?.items?.length) {
      el.innerHTML = '<div class="empty">No side-by-side topic ranking has been observed yet.</div>';
      return;
    }
    el.innerHTML = `<div class="table-scroll"><table class="sereia-table"><thead><tr><th>Topic</th><th>AgentTube</th><th>Sereia</th><th>Δ</th><th>Score</th><th>Evidence</th><th>Status</th></tr></thead><tbody>${topic.items.map(item => {
      const delta = Number(item.rankDelta || 0);
      return `<tr><td><strong>${esc(item.topic)}</strong>${item.failures?.length ? `<br><small>${esc(item.failures.join(' · '))}</small>` : ''}</td><td>#${esc(item.upstreamRank || '—')}</td><td>#${esc(item.sereiaRank || '—')}</td><td class="sereia-delta ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : ''}">${delta > 0 ? '+' : ''}${esc(delta)}</td><td>${esc(item.sereiaScore ?? '—')}</td><td>${esc(item.evidenceCount || 0)} · ${esc(label(item.confidence))}</td><td>${esc(label(item.status))}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function renderContent(items) {
    const el = $('#sereia-content');
    if (!items.length) {
      el.innerHTML = '<div class="empty">Generate content to start collecting packaging and narrative samples.</div>';
      return;
    }
    el.innerHTML = items.map(item => {
      const brief = item.editorialBrief;
      const blueprint = item.narrativeBlueprint;
      const warnings = blueprint?.warnings || [];
      return `<article class="sereia-content-card">
        <h3>${esc(item.title)}</h3>
        <small>${esc(label(item.reviewStatus || item.status || 'unknown'))}</small>
        ${brief ? `<p><strong>Promise:</strong> ${esc(brief.promise || '—')}</p><p><strong>Angle:</strong> ${esc(brief.angle || '—')}</p>` : '<p>No Sereia packaging brief stored for this production.</p>'}
        <div class="sereia-chip-row">
          ${brief ? `<span class="sereia-chip">packaging: ${esc(brief.generationSource || 'available')}</span>` : ''}
          ${blueprint ? `<span class="sereia-chip">${esc(blueprint.beatCount)} visual beats</span><span class="sereia-chip">${esc(blueprint.weakVisualBeatCount)} generic beats</span>` : ''}
          ${warnings.map(warning => `<span class="sereia-chip">${esc(label(warning))}</span>`).join('')}
        </div>
      </article>`;
    }).join('');
  }

  function renderValidation(validation, warnings) {
    const el = $('#sereia-validation');
    const min = validation.minimumSamplesBeforePromotionReview || 3;
    const warningRows = Object.entries(warnings);
    el.innerHTML = `
      <p class="sereia-note"><strong>${esc(label(validation.status || 'collecting_evidence'))}</strong><br>${esc(validation.note || '')}</p>
      <div class="sereia-layer-list">
        <div class="sereia-layer"><div><strong>Packaging samples</strong><small>Target before review: ${esc(min)}</small></div><span class="sereia-status ${validation.packagingSamples >= min ? 'observed' : 'collecting_evidence'}">${esc(validation.packagingSamples || 0)} / ${esc(min)}</span><p>Sample count only opens a review. It never promotes the layer automatically.</p></div>
        <div class="sereia-layer"><div><strong>Narrative samples</strong><small>Target before review: ${esc(min)}</small></div><span class="sereia-status ${validation.narrativeSamples >= min ? 'observed' : 'collecting_evidence'}">${esc(validation.narrativeSamples || 0)} / ${esc(min)}</span><p>We still need qualitative production review and later performance evidence.</p></div>
      </div>
      ${warningRows.length ? `<p style="margin-top:16px"><strong>Recurring narrative warnings</strong></p><div class="sereia-chip-row">${warningRows.map(([name, count]) => `<span class="sereia-chip">${esc(label(name))}: ${esc(count)}</span>`).join('')}</div>` : ''}`;
  }

  installStyles();
  installView();
})();
