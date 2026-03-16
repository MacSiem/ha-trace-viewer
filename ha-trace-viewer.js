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
      const result = await this._hass.callWS({
        type: 'automation/trace/list',
        automation_id: automationId.replace('automation.', '')
      });
      this._traces = (result || []).slice(0, this._config.max_traces);
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
      const result = await this._hass.callWS({
        type: 'automation/trace/get',
        automation_id: automationId.replace('automation.', ''),
        run_id: runId
      });
      this._selectedTrace = result;
      this._renderTraceDetail();
    } catch (e) {
      console.error('Failed to load trace detail:', e);
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
    if (!result) return '⏳';
    if (result.includes('error') || result.includes('fail')) return '❌';
    if (result.includes('stop') || result.includes('abort')) return '⏹️';
    return '✅';
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
      
/* === Modern Bento Light Mode === */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:host {
  --bento-bg: #F8FAFC;
  --bento-card: #FFFFFF;
  --bento-primary: #3B82F6;
  --bento-primary-hover: #2563EB;
  --bento-text: #1E293B;
  --bento-text-secondary: #64748B;
  --bento-border: #E2E8F0;
  --bento-success: #10B981;
  --bento-warning: #F59E0B;
  --bento-error: #EF4444;
  --bento-radius: 16px;
  --bento-radius-sm: 10px;
  --bento-radius-xs: 6px;
  --bento-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
  --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.06);
  --bento-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: block;
  color-scheme: light !important;
}
* { box-sizing: border-box; }

.card, .card-container, .reports-card, .export-card {
  background: var(--bento-card); border-radius: var(--bento-radius); box-shadow: var(--bento-shadow);
  padding: 28px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: var(--bento-text); border: 1px solid var(--bento-border); animation: fadeSlideIn 0.4s ease-out;
}
.card-header { font-size: 20px; font-weight: 700; margin-bottom: 20px; color: var(--bento-text); letter-spacing: -0.01em; display: flex; justify-content: space-between; align-items: center; }
.card-header h2 { font-size: 20px; font-weight: 700; color: var(--bento-text); margin: 0; letter-spacing: -0.01em; }
.card-title, .title, .header-title, .pan-title { font-size: 20px; font-weight: 700; color: var(--bento-text); letter-spacing: -0.01em; }
.header, .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.tabs { display: flex; gap: 4px; border-bottom: 2px solid var(--bento-border); margin-bottom: 24px; overflow-x: auto; padding-bottom: 0; }
.tab, .tab-btn, .tab-button { padding: 10px 20px; border: none; background: transparent; color: var(--bento-text-secondary); cursor: pointer; font-size: 14px; font-weight: 500; border-bottom: 2px solid transparent; transition: var(--bento-transition); white-space: nowrap; margin-bottom: -2px; border-radius: 8px 8px 0 0; font-family: 'Inter', sans-serif; }
.tab.active, .tab-btn.active, .tab-button.active { color: var(--bento-primary); border-bottom-color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.tab:hover, .tab-btn:hover, .tab-button:hover { color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.tab-icon { margin-right: 6px; }
.tab-content { display: none; }
.tab-content.active { display: block; animation: fadeSlideIn 0.3s ease-out; }

button, .btn, .btn-s { padding: 9px 16px; border: 1.5px solid var(--bento-border); background: var(--bento-card); color: var(--bento-text); border-radius: var(--bento-radius-sm); cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); }
button:hover, .btn:hover, .btn-s:hover { background: var(--bento-bg); border-color: var(--bento-primary); color: var(--bento-primary); }
button.active, .btn.active, .btn-act { background: var(--bento-primary); color: white; border-color: var(--bento-primary); box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25); }
.btn-primary { padding: 9px 16px; background: var(--bento-primary); color: white; border: 1.5px solid var(--bento-primary); border-radius: var(--bento-radius-sm); cursor: pointer; font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif; transition: var(--bento-transition); box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25); }
.btn-primary:hover { background: var(--bento-primary-hover); border-color: var(--bento-primary-hover); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35); transform: translateY(-1px); }
.btn-secondary { padding: 9px 16px; background: var(--bento-card); color: var(--bento-text); border: 1.5px solid var(--bento-border); border-radius: var(--bento-radius-sm); cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); }
.btn-secondary:hover { border-color: var(--bento-primary); color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.btn-danger { padding: 9px 16px; background: var(--bento-card); color: var(--bento-error); border: 1.5px solid var(--bento-error); border-radius: var(--bento-radius-sm); cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); }
.btn-danger:hover { background: var(--bento-error); color: white; }
.btn-small { padding: 5px 12px; font-size: 12px; border: 1px solid var(--bento-border); background: var(--bento-card); color: var(--bento-text-secondary); border-radius: var(--bento-radius-xs); cursor: pointer; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); }
.btn-small:hover { border-color: var(--bento-primary); color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }

input[type="text"], input[type="number"], input[type="date"], input[type="time"], input[type="email"], input[type="search"], select, textarea, .search-input, .sinput, .sinput-sm, .alert-search-box, .period-select { padding: 9px 14px; border: 1.5px solid var(--bento-border); border-radius: var(--bento-radius-sm); font-size: 13px; background: var(--bento-card); color: var(--bento-text); font-family: 'Inter', sans-serif; transition: var(--bento-transition); outline: none; }
input[type="text"]:focus, input[type="number"]:focus, input[type="date"]:focus, input[type="time"]:focus, select:focus, textarea:focus, .search-input:focus, .sinput:focus, .sinput-sm:focus, .alert-search-box:focus, .period-select:focus { border-color: var(--bento-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
input::placeholder, .search-input::placeholder, .sinput::placeholder, .sinput-sm::placeholder { color: var(--bento-text-secondary); opacity: 0.7; }
.form-group { margin-bottom: 16px; }
.form-group.full { grid-column: 1 / -1; }
.form-row { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
label, .cg label, .clbl { display: block; font-size: 12px; font-weight: 600; color: var(--bento-text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.03em; }
.add-form { background: var(--bento-bg); border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); padding: 20px; margin-bottom: 20px; }
textarea { min-height: 80px; resize: vertical; }

.stats, .stats-grid, .stats-container, .summary-grid, .network-stats, .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
.stat, .stat-card, .summary-card, .network-stat, .metric-card, .kpi-card { background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 16px; border: 1px solid var(--bento-border); transition: var(--bento-transition); text-align: center; }
.stat:hover, .stat-card:hover, .summary-card:hover, .network-stat:hover, .metric-card:hover { border-color: var(--bento-primary); box-shadow: var(--bento-shadow-md); transform: translateY(-1px); }
.stat-card.online { border-left: 3px solid var(--bento-success); }
.stat-card.offline { border-left: 3px solid var(--bento-error); }
.sv, .stat-value, .summary-value, .network-stat-value, .metric-value { font-size: 24px; font-weight: 700; color: var(--bento-primary); line-height: 1.2; }
.stat.ok .sv { color: var(--bento-success); }
.stat.err .sv { color: var(--bento-error); }
.sl, .stat-label, .summary-label, .network-stat-label, .metric-label { font-size: 12px; color: var(--bento-text-secondary); font-weight: 500; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
.stat-trend { font-size: 12px; font-weight: 600; margin-top: 4px; }
.stat-trend.positive, .trend-up { color: var(--bento-success); }
.stat-trend.negative, .trend-down { color: var(--bento-error); }

.device-table, .entity-table, .table, .alert-table, .data-table, .backup-table, .history-table, .log-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 16px; }
.device-table th, .entity-table th, .table th, .alert-table th, .data-table th, .backup-table th, table th { text-align: left; padding: 12px 16px; border-bottom: 2px solid var(--bento-border); font-weight: 600; color: var(--bento-text-secondary); background: var(--bento-bg); cursor: pointer; user-select: none; white-space: nowrap; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; transition: var(--bento-transition); font-family: 'Inter', sans-serif; }
.device-table th:first-child, .entity-table th:first-child, .table th:first-child, table th:first-child { border-radius: var(--bento-radius-xs) 0 0 0; }
.device-table th:last-child, .entity-table th:last-child, .table th:last-child, table th:last-child { border-radius: 0 var(--bento-radius-xs) 0 0; }
.device-table th:hover, .entity-table th:hover, .table th:hover, table th:hover { background: rgba(59, 130, 246, 0.06); color: var(--bento-primary); }
.device-table th.sorted, .entity-table th.sorted, .table th.sorted, table th.sorted { background: rgba(59, 130, 246, 0.08); color: var(--bento-primary); }
.device-table td, .entity-table td, .table td, .alert-table td, .data-table td, .backup-table td, table td { padding: 12px 16px; border-bottom: 1px solid var(--bento-border); color: var(--bento-text); font-size: 13px; font-family: 'Inter', sans-serif; }
.device-table tr:hover, .entity-table tr:hover, .table tbody tr:hover, .alert-table tr:hover, table tr:hover { background: rgba(59, 130, 246, 0.03); }
.table-container { overflow-x: auto; border-radius: var(--bento-radius-sm); border: 1px solid var(--bento-border); }
.sort-indicator { font-size: 10px; margin-left: 4px; color: var(--bento-primary); }

.status-badge, .severity-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; }
.status-online, .status-home, .status-active, .status-ok, .status-healthy, .status-running, .status-complete, .status-completed, .status-success, .badge-success { background: rgba(16, 185, 129, 0.1); color: #059669; }
.status-offline, .status-error, .status-failed, .status-critical, .severity-critical, .badge-error, .badge-danger { background: rgba(239, 68, 68, 0.1); color: #DC2626; }
.status-away, .status-warning, .severity-warning, .badge-warning { background: rgba(245, 158, 11, 0.1); color: #B45309; }
.status-unavailable, .status-unknown, .status-idle, .status-inactive, .status-stopped, .badge-neutral { background: rgba(100, 116, 139, 0.1); color: var(--bento-text-secondary); }
.status-zone, .severity-info, .badge-info { background: rgba(59, 130, 246, 0.1); color: var(--bento-primary); }

.alert-item { padding: 14px 18px; border-left: 4px solid var(--bento-border); border-radius: 0 var(--bento-radius-sm) var(--bento-radius-sm) 0; margin-bottom: 10px; background: var(--bento-bg); display: flex; justify-content: space-between; align-items: center; transition: var(--bento-transition); }
.alert-item:hover { box-shadow: var(--bento-shadow); }
.alert-critical { border-color: var(--bento-error); background: rgba(239, 68, 68, 0.04); }
.alert-warning { border-color: var(--bento-warning); background: rgba(245, 158, 11, 0.04); }
.alert-info { border-color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.alert-text { flex: 1; }
.alert-type { font-weight: 600; font-size: 13px; margin-bottom: 4px; color: var(--bento-text); }
.alert-time { font-size: 12px; color: var(--bento-text-secondary); }
.alert-actions { display: flex; gap: 8px; }
.alert-dismiss { padding: 6px 12px; font-size: 12px; background: var(--bento-card); color: var(--bento-text-secondary); border: 1px solid var(--bento-border); border-radius: var(--bento-radius-xs); cursor: pointer; font-weight: 500; transition: var(--bento-transition); }
.alert-dismiss:hover { background: var(--bento-error); color: white; border-color: var(--bento-error); }

.section { margin-bottom: 24px; }
.section h3, .section-title, .pan-head { font-size: 16px; font-weight: 600; color: var(--bento-text); margin-bottom: 12px; letter-spacing: -0.01em; }

.battery-grid, .grid, .items-grid, .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.battery-card, .item-card, .chore-card, .entry-card, .backup-card { background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 16px; border: 1px solid var(--bento-border); transition: var(--bento-transition); }
.battery-card:hover, .item-card:hover, .chore-card:hover, .entry-card:hover, .backup-card:hover { box-shadow: var(--bento-shadow-md); border-color: var(--bento-primary); transform: translateY(-1px); }
.chore-card.priority-high { border-left: 3px solid var(--bento-error); }
.chore-card.priority-medium { border-left: 3px solid var(--bento-warning); }
.chore-card.priority-low { border-left: 3px solid var(--bento-success); }
.chore-title, .entry-title, .item-title { font-weight: 600; font-size: 14px; color: var(--bento-text); margin-bottom: 6px; }
.chore-meta, .entry-meta, .item-meta { font-size: 12px; color: var(--bento-text-secondary); }
.chore-assignee { font-size: 12px; color: var(--bento-primary); font-weight: 500; }
.chore-actions, .item-actions, .entry-actions { display: flex; gap: 6px; margin-top: 10px; }

.battery-bar, .progress-bar, .bandwidth-bar-bg { width: 100%; height: 8px; background: var(--bento-border); border-radius: 4px; overflow: hidden; margin-top: 8px; }
.battery-fill, .progress-fill, .bandwidth-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); background: var(--bento-success); }
.battery-fill.battery_critical { background: var(--bento-error) !important; }
.battery-fill.battery_warning { background: var(--bento-warning) !important; }
.battery-label, .bandwidth-label { font-size: 13px; color: var(--bento-text); font-weight: 500; display: flex; justify-content: space-between; align-items: center; }

.pagination, .pag { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 20px; padding: 16px 0; border-top: 1px solid var(--bento-border); }
.pagination-btn, .pag-btn { padding: 8px 14px; border: 1.5px solid var(--bento-border); background: var(--bento-card); color: var(--bento-text); border-radius: var(--bento-radius-xs); cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); }
.pagination-btn:hover:not(:disabled), .pag-btn:hover:not(:disabled) { background: var(--bento-primary); color: white; border-color: var(--bento-primary); }
.pagination-btn:disabled, .pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pagination-info, .pag-info { font-size: 13px; color: var(--bento-text-secondary); font-weight: 500; padding: 0 8px; }
.page-size-selector, .pag-size { padding: 6px 10px; border: 1.5px solid var(--bento-border); border-radius: var(--bento-radius-xs); background: var(--bento-card); color: var(--bento-text); font-size: 13px; cursor: pointer; font-family: 'Inter', sans-serif; }

.col-main { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: var(--bento-text); }
.topbar-r { display: flex; gap: 8px; align-items: center; }
.panels { display: flex; gap: 12px; }
.pan-left, .pan-center, .pan-right { background: var(--bento-card); border-radius: var(--bento-radius-sm); border: 1px solid var(--bento-border); overflow: hidden; }
.cbar { display: flex; gap: 8px; align-items: center; padding: 12px; background: var(--bento-bg); border-bottom: 1px solid var(--bento-border); }
.cg { display: flex; gap: 8px; align-items: center; }
.cg-r { margin-left: auto; }

.dd { position: relative; }
.dd-menu { position: absolute; top: 100%; left: 0; background: var(--bento-card); border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); box-shadow: var(--bento-shadow-md); min-width: 180px; z-index: 100; display: none; overflow: hidden; }
.dd.open .dd-menu { display: block; }
.dd-i { padding: 10px 16px; cursor: pointer; font-size: 13px; color: var(--bento-text); transition: var(--bento-transition); font-family: 'Inter', sans-serif; }
.dd-i:hover { background: rgba(59, 130, 246, 0.06); color: var(--bento-primary); }
.dd-div { border-top: 1px solid var(--bento-border); margin: 4px 0; }

.auto-item, .tr-item, .list-item, .automation-item { padding: 12px 16px; cursor: pointer; border-bottom: 1px solid var(--bento-border); display: flex; align-items: center; gap: 10px; transition: var(--bento-transition); font-family: 'Inter', sans-serif; }
.auto-item:hover, .tr-item:hover, .list-item:hover, .automation-item:hover { background: rgba(59, 130, 246, 0.04); }
.auto-item.sel, .tr-item.sel, .list-item.selected, .automation-item.selected { background: rgba(59, 130, 246, 0.08); border-left: 3px solid var(--bento-primary); }
.auto-item.error-item, .automation-item.error-item { border-left: 3px solid var(--bento-error); }
.auto-name { font-weight: 500; font-size: 13px; color: var(--bento-text); }
.auto-meta { font-size: 12px; color: var(--bento-text-secondary); }
.auto-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--bento-text-secondary); }
.auto-dot.s-running { background: var(--bento-success); }
.auto-dot.s-stopped { background: var(--bento-text-secondary); }
.auto-dot.s-error { background: var(--bento-error); }
.auto-count { font-size: 11px; color: var(--bento-text-secondary); margin-left: auto; }

.tgroup { border: 1px solid var(--bento-border); border-radius: var(--bento-radius-xs); margin-bottom: 8px; overflow: hidden; }
.tgroup-h { padding: 10px 14px; background: var(--bento-bg); display: flex; align-items: center; gap: 8px; cursor: pointer; transition: var(--bento-transition); font-family: 'Inter', sans-serif; }
.tgroup-h:hover { background: rgba(59, 130, 246, 0.06); }
.tg-tog { transition: transform 0.2s; font-size: 12px; color: var(--bento-text-secondary); }
.tgroup.collapsed .tg-tog { transform: rotate(-90deg); }
.tgroup.collapsed .tgroup-items { display: none; }
.tg-name { font-weight: 600; font-size: 13px; color: var(--bento-text); }
.tg-cnt { font-size: 11px; color: var(--bento-text-secondary); margin-left: auto; background: var(--bento-border); padding: 2px 8px; border-radius: 10px; }

.device-detail, .detail-panel, .details { background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 16px; border: 1px solid var(--bento-border); }
.detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--bento-border); font-size: 13px; }
.detail-row:last-child { border-bottom: none; }
.detail-label { color: var(--bento-text-secondary); font-weight: 500; }
.detail-value { color: var(--bento-text); font-weight: 600; }

.board { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 8px; }
.column { min-width: 260px; background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 12px; border: 1px solid var(--bento-border); }
.column-header { font-weight: 600; font-size: 14px; color: var(--bento-text); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
.column-count { background: var(--bento-border); color: var(--bento-text-secondary); font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }

.schedule, .calendar { margin-top: 16px; }
.week-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-top: 16px; }
.week-header { padding: 8px; text-align: center; font-size: 12px; font-weight: 600; color: var(--bento-text-secondary); text-transform: uppercase; letter-spacing: 0.03em; border-radius: var(--bento-radius-xs); }
.week-cell { padding: 8px; text-align: center; font-size: 12px; background: var(--bento-bg); border: 1px solid var(--bento-border); cursor: pointer; transition: var(--bento-transition); border-radius: var(--bento-radius-xs); }
.week-cell:hover { border-color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.chore-item { padding: 8px 12px; border-bottom: 1px solid var(--bento-border); font-size: 13px; }

.leaderboard { background: var(--bento-bg); border-radius: var(--bento-radius-sm); border: 1px solid var(--bento-border); overflow: hidden; }
.leaderboard-row { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--bento-border); gap: 12px; font-size: 13px; transition: var(--bento-transition); }
.leaderboard-row:last-child { border-bottom: none; }
.leaderboard-row:hover { background: rgba(59, 130, 246, 0.04); }
.rank { font-weight: 700; color: var(--bento-primary); font-size: 14px; min-width: 28px; }
.name { font-weight: 500; color: var(--bento-text); flex: 1; }
.streak { color: var(--bento-warning); font-weight: 600; }
.completion { color: var(--bento-success); font-weight: 600; }

.baby-selector { display: flex; gap: 8px; margin-bottom: 16px; }
.quick-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
.quick-btn, .action-btn { padding: 10px 16px; border: 1.5px solid var(--bento-border); background: var(--bento-card); border-radius: var(--bento-radius-sm); cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); display: flex; align-items: center; gap: 6px; color: var(--bento-text); }
.quick-btn:hover, .action-btn:hover { border-color: var(--bento-primary); color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.quick-btn.active, .action-btn.active { background: var(--bento-primary); color: white; border-color: var(--bento-primary); }
.timeline { position: relative; padding-left: 24px; }
.timeline-item { padding: 12px 0; border-bottom: 1px solid var(--bento-border); position: relative; }
.timeline-time { font-size: 12px; color: var(--bento-text-secondary); font-weight: 500; }
.timeline-content { font-size: 13px; color: var(--bento-text); margin-top: 4px; }

canvas, .canvas-container canvas { width: 100%; height: 200px; border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); margin-bottom: 16px; }
.canvas-container { position: relative; margin-bottom: 16px; }
.chart-container { background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 16px; border: 1px solid var(--bento-border); margin-bottom: 16px; }

.empty, .empty-state { text-align: center; padding: 48px 24px; color: var(--bento-text-secondary); font-size: 14px; font-family: 'Inter', sans-serif; }
.empty-ico, .empty-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.5; }
.spinner { width: 32px; height: 32px; border: 3px solid var(--bento-border); border-top: 3px solid var(--bento-primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 24px auto; }

.search-box, .search-bar, .controls, .ctrls, .filter-bar { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
.control-group { display: flex; gap: 8px; align-items: center; }

.domain-group-header { margin-top: 20px; padding: 10px 16px; background: var(--bento-bg); border-radius: var(--bento-radius-xs); font-weight: 600; font-size: 14px; color: var(--bento-text); border: 1px solid var(--bento-border); }
.domain-group-header:first-child { margin-top: 0; }
.domain-group-count { font-weight: 500; color: var(--bento-text-secondary); font-size: 12px; margin-left: 8px; }

.automation-list, .list, .item-list { border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); overflow: hidden; }
.automation-name, .entity-name { font-weight: 500; font-size: 13px; color: var(--bento-text); }
.automation-id, .entity-id { font-size: 11px; color: var(--bento-text-secondary); }
.error-badge, .count-badge { background: var(--bento-error); color: white; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px; margin-left: 6px; }
.tab .error-badge { background: var(--bento-error); color: white; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px; margin-left: 6px; }

.health-score, .score { font-size: 48px; font-weight: 700; color: var(--bento-primary); text-align: center; margin: 16px 0; }
.emoji { font-size: 20px; line-height: 1; }
.device-icon { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: rgba(59, 130, 246, 0.08); border-radius: var(--bento-radius-xs); font-size: 16px; }

.recommendation-card, .tip-card, .suggestion-card { background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 16px; border: 1px solid var(--bento-border); margin-bottom: 12px; transition: var(--bento-transition); }
.recommendation-card:hover, .tip-card:hover, .suggestion-card:hover { border-color: var(--bento-primary); box-shadow: var(--bento-shadow-md); }

.export-options, .options-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }
.export-option, .option-card { background: var(--bento-bg); border: 1.5px solid var(--bento-border); border-radius: var(--bento-radius-sm); padding: 16px; cursor: pointer; transition: var(--bento-transition); text-align: center; }
.export-option:hover, .option-card:hover { border-color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.export-option.selected, .option-card.selected { border-color: var(--bento-primary); background: rgba(59, 130, 246, 0.08); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

.storage-bar, .usage-bar { width: 100%; height: 24px; background: var(--bento-border); border-radius: var(--bento-radius-xs); overflow: hidden; margin-bottom: 12px; }
.storage-fill, .usage-fill { height: 100%; border-radius: var(--bento-radius-xs); transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); background: var(--bento-primary); }

.check-item, .security-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--bento-border); transition: var(--bento-transition); }
.check-item:hover, .security-item:hover { background: rgba(59, 130, 246, 0.03); }
.check-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 16px; }
.check-icon.pass { background: rgba(16, 185, 129, 0.1); }
.check-icon.fail { background: rgba(239, 68, 68, 0.1); }
.check-icon.warn { background: rgba(245, 158, 11, 0.1); }
.check-text, .security-text { flex: 1; }
.check-title { font-weight: 600; font-size: 13px; color: var(--bento-text); }
.check-desc { font-size: 12px; color: var(--bento-text-secondary); margin-top: 2px; }

.waveform { background: var(--bento-bg); border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); padding: 16px; margin-bottom: 16px; }
.analysis-result, .result-card { background: var(--bento-bg); border: 1px solid var(--bento-border); border-radius: var(--bento-radius-sm); padding: 20px; text-align: center; margin-bottom: 16px; }
.confidence-bar { height: 8px; background: var(--bento-border); border-radius: 4px; overflow: hidden; margin-top: 8px; }
.confidence-fill { height: 100%; border-radius: 4px; background: var(--bento-primary); transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); }

.sentence-item, .intent-item { padding: 12px 16px; border-bottom: 1px solid var(--bento-border); display: flex; justify-content: space-between; align-items: center; transition: var(--bento-transition); }
.sentence-item:hover, .intent-item:hover { background: rgba(59, 130, 246, 0.03); }
.sentence-text { font-size: 13px; color: var(--bento-text); font-family: 'Inter', sans-serif; }
.intent-badge { display: inline-flex; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background: rgba(59, 130, 246, 0.1); color: var(--bento-primary); }

.backup-item, .backup-entry { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--bento-border); transition: var(--bento-transition); }
.backup-item:hover, .backup-entry:hover { background: rgba(59, 130, 246, 0.03); }
.backup-name { font-weight: 500; font-size: 14px; color: var(--bento-text); }
.backup-date, .backup-size { font-size: 12px; color: var(--bento-text-secondary); }

.report-section { background: var(--bento-bg); border-radius: var(--bento-radius-sm); padding: 20px; border: 1px solid var(--bento-border); margin-bottom: 16px; }
.insight-card { padding: 14px; border-left: 3px solid var(--bento-primary); background: rgba(59, 130, 246, 0.04); border-radius: 0 var(--bento-radius-xs) var(--bento-radius-xs) 0; margin-bottom: 10px; }

@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--bento-text-secondary); }

@media (max-width: 768px) {
  .card, .card-container, .reports-card, .export-card { padding: 16px; }
  .stats, .stats-grid, .summary-grid { grid-template-columns: repeat(2, 1fr); }
  .panels { flex-direction: column; }
  .board { flex-direction: column; }
  .column { min-width: unset; }
}

</style>
      <ha-card>
        <div class="trace-card">
          <div class="card-header">
            <h2>${this._config.title}</h2>
            <div class="header-actions">
              <button class="btn-icon" id="refreshBtn" title="Refresh">🔄</button>
            </div>
          </div>
          <div class="layout">
            <div class="sidebar">
              <input type="text" class="search-box" id="searchBox" placeholder="Search automations..." />
              <div id="automationList"></div>
            </div>
            <div class="main-content" id="mainContent">
              <div class="empty-state">
                <div class="empty-icon">🔍</div>
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
          <div class="empty-icon">📋</div>
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
          const duration = t.timestamp && t.last_step_timestamp
            ? new Date(t.last_step_timestamp) - new Date(t.timestamp) : null;
          const result = t.state || 'completed';
          return `
            <div class="trace-item" data-idx="${i}">
              <span class="trace-icon">${this._getResultIcon(result)}</span>
              <div class="trace-info">
                <div class="trace-time">${this._formatTimestamp(t.timestamp)}</div>
                <div class="trace-result">${result} · Run ${t.run_id || i + 1}</div>
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
            <button class="btn-icon" id="backBtn" title="Back to list">←</button>
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
