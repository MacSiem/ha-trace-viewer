/**
 * Home Assistant Trace Viewer Card
 * Visualize automation and script execution traces
 */

class HATraceViewer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = {};
    this._traces = [];
    this._selectedTrace = null;
    this._loading = false;
    this._automations = [];
    this._archivedTraces = {};
    this._archiveLoaded = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.shadowRoot.querySelector('.trace-card')) {
      this._render();
      this._loadAutomations();
    }
  }

  setConfig(config) {
    this._config = {
      title: config.title || 'Trace Viewer',
      max_traces: config.max_traces || 20,
      show_timestamps: config.show_timestamps !== false,
      auto_refresh: config.auto_refresh || 30,
      default_view: config.default_view || 'timeline',
      ...config
    };
  }

  getCardSize() { return 6; }

  static getStubConfig() {
    return { title: 'Trace Viewer', max_traces: 20 };
  }

  async _loadAutomations() {
    if (!this._hass) return;
    try {
      const automations = Object.keys(this._hass.states)
        .filter(id => id.startsWith('automation.'))
        .map(id => ({
          entity_id: id,
          name: this._hass.states[id].attributes.friendly_name || id,
          state: this._hass.states[id].state,
          last_triggered: this._hass.states[id].attributes.last_triggered
        }))
        .sort((a, b) => {
          if (!a.last_triggered) return 1;
          if (!b.last_triggered) return -1;
          return new Date(b.last_triggered) - new Date(a.last_triggered);
        });
      this._automations = automations;
      this._updateAutomationList();
    } catch (e) {
      console.error('Failed to load automations:', e);
    }
  }

  async _loadTraces(automationId) {
    if (!this._hass) return;
    this._loading = true;
    this._updateLoadingState();
    try {
      const stateObj = this._hass.states[automationId];
      const itemId = stateObj && stateObj.attributes ? stateObj.attributes.id : automationId.replace('automation.', '');
      const result = await this._hass.callWS({
        type: 'trace/list',
        domain: 'automation',
        item_id: String(itemId)
      });
      const liveTraces = (result || []).slice(0, this._config.max_traces);
      // Merge with archived traces
      await this._loadArchivedTraces();
      const autoKey = 'automation.' + String(itemId);
      const archived = this._archivedTraces[autoKey] || [];
      const liveIds = new Set(liveTraces.map(t => t.run_id));
      const extraArchived = archived.filter(a => !liveIds.has(a.run_id)).map(a => ({...a, _archived: true}));
      this._traces = [...liveTraces, ...extraArchived].slice(0, Math.max(this._config.max_traces || 50, 100));
      this._selectedTrace = null;
      this._updateTraceList();
    } catch (e) {
      console.error('Failed to load traces:', e);
      this._traces = [];
      this._updateTraceList();
    }
    this._loading = false;
    this._updateLoadingState();
  }

  async _loadTraceDetail(automationId, runId) {
    if (!this._hass) return;
    try {
      const stateObj = this._hass.states[automationId];
      const itemId = stateObj && stateObj.attributes ? stateObj.attributes.id : automationId.replace('automation.', '');
      const result = await this._hass.callWS({
        type: 'trace/get',
        domain: 'automation',
        item_id: String(itemId),
        run_id: runId
      });
      this._selectedTrace = result;
      this._renderTraceDetail();
    } catch (e) {
      console.error('Failed to load trace detail:', e);
      const main = this.shadowRoot.getElementById('mainContent');
      if (main) main.innerHTML = '<div class="empty-state"><div class="empty-icon">??</div><div>Failed to load trace detail</div><div style="font-size:12px;margin-top:4px;color:var(--text2)">' + (e.message || 'Unknown error') + '</div></div>';
    }
  }

  _formatTimestamp(ts) {
    if (!ts) return 'Never';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  _formatDuration(ms) {
    if (!ms && ms !== 0) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  }

  _getStateColor(state) {
    const colors = {
      'on': '#4caf50',
      'off': '#9e9e9e',
      'stopped': '#f44336',
      'running': '#2196f3',
      'error': '#f44336'
    };
    return colors[state] || '#9e9e9e';
  }

  _getResultIcon(result) {
    if (!result) return 'âŹł';
    if (result.includes('error') || result.includes('fail')) return 'âťŚ';
    if (result.includes('stop') || result.includes('abort')) return 'âŹąď¸Ź';
    return 'âś…';
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --primary: var(--ha-card-header-color, #1976d2);
          --bg: var(--ha-card-background, var(--card-background-color, #fff));
          --text: var(--primary-text-color, #333);
          --text2: var(--secondary-text-color, #666);
          --border: var(--divider-color, #e0e0e0);
          --hover: var(--table-row-alternative-background-color, #f5f5f5);
          --success: #4caf50;
          --error: #f44336;
          --warning: #ff9800;
        }
        .trace-card {
          background: var(--bg);
          border-radius: 12px;
          padding: 16px;
          font-family: var(--ha-card-header-font-family, inherit);
          color: var(--text);
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .card-header h2 { margin: 0; font-size: 18px; font-weight: 500; }
        .header-actions { display: flex; gap: 6px; }
        .btn-icon {
          background: none; border: 1px solid var(--border); border-radius: 6px;
          padding: 4px 8px; cursor: pointer; font-size: 14px; color: var(--text);
        }
        .btn-icon:hover { background: var(--hover); }
        .layout { display: flex; gap: 12px; min-height: 300px; }
        .sidebar {
          width: 220px; flex-shrink: 0;
          border-right: 1px solid var(--border); padding-right: 12px;
          overflow-y: auto; max-height: 400px;
        }
        .main-content { flex: 1; overflow: hidden; }
        .automation-item {
          padding: 8px; border-radius: 6px; cursor: pointer;
          margin-bottom: 4px; font-size: 13px; transition: background 0.15s;
        }
        .automation-item:hover { background: var(--hover); }
        .automation-item.active { background: var(--hover); border-left: 3px solid var(--primary); }
        .automation-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .automation-meta { font-size: 11px; color: var(--text2); margin-top: 2px; }
        .state-dot {
          display: inline-block; width: 8px; height: 8px;
          border-radius: 50%; margin-right: 4px; vertical-align: middle;
        }
        .trace-list { margin-bottom: 12px; }
        .trace-item {
          display: flex; align-items: center; gap: 8px;
          padding: 8px; border-radius: 6px; cursor: pointer;
          border: 1px solid var(--border); margin-bottom: 6px;
          font-size: 13px; transition: all 0.15s;
        }
        .trace-item:hover { border-color: var(--primary); background: var(--hover); }
        .trace-item.active { border-color: var(--primary); background: var(--hover); }
        .trace-icon { font-size: 16px; flex-shrink: 0; }
        .trace-info { flex: 1; min-width: 0; }
        .trace-time { font-weight: 500; }
        .trace-result { font-size: 11px; color: var(--text2); }
        .trace-duration {
          font-size: 12px; color: var(--text2); font-family: monospace;
          flex-shrink: 0;
        }
        .detail-panel { padding: 8px 0; }
        .detail-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border);
        }
        .detail-title { font-size: 15px; font-weight: 500; }
        .timeline { position: relative; padding-left: 24px; }
        .timeline::before {
          content: ''; position: absolute; left: 10px; top: 0; bottom: 0;
          width: 2px; background: var(--border);
        }
        .timeline-item {
          position: relative; margin-bottom: 12px; padding: 8px 12px;
          background: var(--hover); border-radius: 6px; font-size: 13px;
        }
        .timeline-item::before {
          content: ''; position: absolute; left: -18px; top: 12px;
          width: 10px; height: 10px; border-radius: 50%;
          background: var(--primary); border: 2px solid var(--bg);
        }
        .timeline-item.error::before { background: var(--error); }
        .timeline-item.success::before { background: var(--success); }
        .step-path { font-family: monospace; font-size: 11px; color: var(--text2); }
        .step-result { margin-top: 4px; font-size: 12px; }
        .step-changed { color: var(--success); font-weight: 500; }
        .empty-state {
          text-align: center; padding: 40px 20px;
          color: var(--text2); font-size: 14px;
        }
        .empty-icon { font-size: 32px; margin-bottom: 8px; }
        .loading { text-align: center; padding: 20px; color: var(--text2); }
        .loading-spinner {
          display: inline-block; width: 20px; height: 20px;
          border: 2px solid var(--border); border-top-color: var(--primary);
          border-radius: 50%; animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .search-box {
          width: 100%; padding: 6px 10px; border: 1px solid var(--border);
          border-radius: 6px; background: var(--bg); color: var(--text);
          font-size: 13px; margin-bottom: 8px; outline: none;
          box-sizing: border-box;
        }
        .search-box:focus { border-color: var(--primary); }
        .export-btn {
          padding: 6px 12px; background: var(--primary); color: #fff;
          border: none; border-radius: 6px; cursor: pointer;
          font-size: 12px; font-weight: 500;
        }
        .export-btn:hover { opacity: 0.85; }
        .json-view {
          background: var(--hover); border-radius: 6px; padding: 12px;
          font-family: monospace; font-size: 12px; white-space: pre-wrap;
          word-break: break-all; max-height: 300px; overflow-y: auto;
          border: 1px solid var(--border);
        }
        .view-tabs { display: flex; gap: 4px; margin-bottom: 12px; }
        .view-tab {
          padding: 4px 12px; border: 1px solid var(--border); border-radius: 4px;
          background: var(--bg); color: var(--text2); cursor: pointer;
          font-size: 12px;
        }
        .view-tab.active { background: var(--primary); color: #fff; border-color: var(--primary); }
      </style>
      <ha-card>
        <div class="trace-card">
          <div class="card-header">
            <h2>${this._config.title}</h2>
            <div class="header-actions">
              <button class="btn-icon" id="archiveBtn" title="Archive traces to JSON" style="font-size:12px;padding:4px 10px;">&#128190; Archive</button>
              <button class="btn-icon" id="refreshBtn" title="Refresh">đź”„</button>
            </div>
          </div>
          <div class="layout">
            <div class="sidebar">
              <input type="text" class="search-box" id="searchBox" placeholder="Search automations..." />
              <div id="automationList"></div>
            </div>
            <div class="main-content" id="mainContent">
              <div class="empty-state">
                <div class="empty-icon">đź”Ť</div>
                <div>Select an automation to view its traces</div>
              </div>
            </div>
          </div>
        </div>
      </ha-card>
    `;
    this._attachEvents();
  }

  _attachEvents() {
    this.shadowRoot.getElementById('archiveBtn').addEventListener('click', () => {
      this._archiveTraces();
    });

    this.shadowRoot.getElementById('refreshBtn').addEventListener('click', () => {
      this._loadAutomations();
      if (this._selectedAutomation) {
        this._loadTraces(this._selectedAutomation);
      }
    });

    this.shadowRoot.getElementById('searchBox').addEventListener('input', (e) => {
      this._filterSearch = e.target.value.toLowerCase();
      this._updateAutomationList();
    });
  }


  async _archiveTraces() {
    if (!this._hass) return;
    const btn = this.shadowRoot.getElementById('archiveBtn');
    if (btn) btn.textContent = '... Archiving';
    try {
      await this._hass.callService('shell_command', 'save_trace_archive');
      if (btn) btn.innerHTML = '&#9989; Archived!';
      setTimeout(() => { if (btn) btn.innerHTML = '&#128190; Archive'; }, 2000);
      // Reload archive
      this._archiveLoaded = false;
      await this._loadArchivedTraces();
    } catch (e) {
      console.error('Failed to archive traces:', e);
      if (btn) btn.innerHTML = '&#10060; Error';
      setTimeout(() => { if (btn) btn.innerHTML = '&#128190; Archive'; }, 2000);
    }
  }

  async _loadArchivedTraces() {
    if (this._archiveLoaded) return;
    try {
      const resp = await fetch('/local/trace_archive.json?t=' + Date.now());
      if (resp.ok) {
        const data = await resp.json();
        this._archivedTraces = data.traces || {};
        this._archiveLoaded = true;
        console.log('[TraceViewer] Loaded archive:', data.total_runs, 'runs');
      }
    } catch (e) {
      console.log('[TraceViewer] No archive file yet');
    }
  }
  _filterSearch = '';
  _selectedAutomation = null;
  _currentView = 'timeline';

  _updateAutomationList() {
    const container = this.shadowRoot.getElementById('automationList');
    if (!container) return;
    let automations = this._automations;
    if (this._filterSearch) {
      automations = automations.filter(a =>
        a.name.toLowerCase().includes(this._filterSearch) ||
        a.entity_id.toLowerCase().includes(this._filterSearch)
      );
    }
    container.innerHTML = automations.map(a => `
      <div class="automation-item ${this._selectedAutomation === a.entity_id ? 'active' : ''}"
           data-id="${a.entity_id}">
        <div class="automation-name">
          <span class="state-dot" style="background:${this._getStateColor(a.state)}"></span>
          ${a.name}
        </div>
        <div class="automation-meta">${this._formatTimestamp(a.last_triggered)}</div>
      </div>
    `).join('');

    container.querySelectorAll('.automation-item').forEach(el => {
      el.addEventListener('click', () => {
        this._selectedAutomation = el.dataset.id;
        this._loadTraces(el.dataset.id);
        this._updateAutomationList();
      });
    });
  }

  _updateLoadingState() {
    const main = this.shadowRoot.getElementById('mainContent');
    if (this._loading) {
      main.innerHTML = '<div class="loading"><div class="loading-spinner"></div><div style="margin-top:8px">Loading traces...</div></div>';
    }
  }

  _updateTraceList() {
    const main = this.shadowRoot.getElementById('mainContent');
    if (this._traces.length === 0) {
      main.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">đź“‹</div>
          <div>No traces found for this automation</div>
          <div style="font-size:12px;margin-top:4px;color:var(--text2)">
            Traces are generated when an automation runs
          </div>
        </div>`;
      return;
    }

    main.innerHTML = `
      <div class="trace-list" id="traceList">
        ${this._traces.map((t, i) => {
          const tStart = (t.timestamp && typeof t.timestamp === 'object') ? t.timestamp.start : t.timestamp;
          const tFinish = (t.timestamp && typeof t.timestamp === 'object') ? t.timestamp.finish : t.last_step_timestamp;
          const duration = tStart && tFinish ? new Date(tFinish) - new Date(tStart) : null;
          const result = t.state || 'completed';
          return `
            <div class="trace-item" data-idx="${i}">
              <span class="trace-icon">${this._getResultIcon(result)}</span>
              <div class="trace-info">
                <div class="trace-time">${this._formatTimestamp((t.timestamp && typeof t.timestamp === 'object') ? t.timestamp.start : t.timestamp)}</div>
                <div class="trace-result">${result} Â· Run ${t.run_id || i + 1}</div>
              </div>
              <span class="trace-duration">${this._formatDuration(duration)}</span>
            </div>`;
        }).join('')}
      </div>
    `;

    main.querySelectorAll('.trace-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        const trace = this._traces[idx];
        if (trace && this._selectedAutomation) {
          this._loadTraceDetail(this._selectedAutomation, trace.run_id);
          main.querySelectorAll('.trace-item').forEach(e => e.classList.remove('active'));
          el.classList.add('active');
        }
      });
    });
  }

  _renderTraceDetail() {
    const main = this.shadowRoot.getElementById('mainContent');
    if (!this._selectedTrace) return;
    const trace = this._selectedTrace;
    const steps = trace.trace || {};
    const stepEntries = Object.entries(steps);

    main.innerHTML = `
      <div class="detail-panel">
        <div class="detail-header">
          <span class="detail-title">Trace Detail</span>
          <div style="display:flex;gap:6px;align-items:center">
            <div class="view-tabs">
              <button class="view-tab ${this._currentView === 'timeline' ? 'active' : ''}" data-view="timeline">Timeline</button>
              <button class="view-tab ${this._currentView === 'json' ? 'active' : ''}" data-view="json">JSON</button>
            </div>
            <button class="export-btn" id="exportTraceBtn">Export</button>
            <button class="btn-icon" id="backBtn" title="Back to list">â†</button>
          </div>
        </div>
        <div id="detailContent"></div>
      </div>
    `;

    main.querySelector('#backBtn').addEventListener('click', () => {
      this._selectedTrace = null;
      this._updateTraceList();
    });

    main.querySelector('#exportTraceBtn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trace-${trace.run_id || 'export'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    main.querySelectorAll('.view-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._currentView = tab.dataset.view;
        main.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._renderDetailContent(trace, stepEntries);
      });
    });

    this._renderDetailContent(trace, stepEntries);
  }

  _renderDetailContent(trace, stepEntries) {
    const container = this.shadowRoot.getElementById('detailContent');
    if (this._currentView === 'json') {
      container.innerHTML = `<div class="json-view">${this._syntaxHighlight(JSON.stringify(trace, null, 2))}</div>`;
      return;
    }

    if (stepEntries.length === 0) {
      container.innerHTML = '<div class="empty-state"><div>No step data available</div></div>';
      return;
    }

    container.innerHTML = `
      <div class="timeline">
        ${stepEntries.map(([path, steps]) => {
          return steps.map(step => {
            const isError = step.error;
            const changed = step.changed_variables;
            const result = step.result;
            return `
              <div class="timeline-item ${isError ? 'error' : 'success'}">
                <div class="step-path">${path}</div>
                ${result ? `<div class="step-result">${typeof result === 'object' ? JSON.stringify(result) : result}</div>` : ''}
                ${changed ? `<div class="step-changed">Changed: ${Object.keys(changed).join(', ')}</div>` : ''}
                ${isError ? `<div style="color:var(--error);font-size:12px;margin-top:4px">${step.error}</div>` : ''}
                ${this._config.show_timestamps && step.timestamp ? `<div style="font-size:11px;color:var(--text2);margin-top:2px">${this._formatTimestamp(step.timestamp)}</div>` : ''}
              </div>`;
          }).join('');
        }).join('')}
      </div>
    `;
  }

  _syntaxHighlight(json) {
    return json
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (match) => {
        if (/:$/.test(match)) return `<span style="color:#881391">${match}</span>`;
        return `<span style="color:#1a6;">${match}</span>`;
      })
      .replace(/\b(true|false)\b/g, '<span style="color:#219">$1</span>')
      .replace(/\b(null)\b/g, '<span style="color:#888">$1</span>')
      .replace(/\b(\d+)\b/g, '<span style="color:#164">$1</span>');
  }
}

customElements.define('ha-trace-viewer', HATraceViewer);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'ha-trace-viewer',
  name: 'Trace Viewer',
  description: 'View and export automation execution traces',
  preview: true
});

console.info(
  '%c  HA-TRACE-VIEWER  %c v1.0.0 ',
  'background: #ff9800; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;',
  'background: #fff3e0; color: #ff9800; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;'
);

