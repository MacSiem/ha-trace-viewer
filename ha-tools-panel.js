/**
 * HA Tools Panel v2.2 — Auto-loading addons with progress notification
 * Author: MacSiem
 * Features: Auto-loads addon scripts, polls for customElements registration,
 *           shows loading progress bar, dynamically updates sidebar
 */

// ── Build version & auto-update detection ──
// Zmień BUILD_VERSION przy każdej aktualizacji kodu.
// Panel automatycznie wykryje nową wersję i pokaże toast z przyciskiem "Odśwież".
const HA_TOOLS_BUILD = '2.3.0';
const HA_TOOLS_BUILD_TS = '20260316-0020';

(function _checkVersion() {
  const KEY = 'ha-tools-build';
  const prev = localStorage.getItem(KEY);
  if (prev && prev !== HA_TOOLS_BUILD) {
    // Nowa wersja — pokaż toast po załadowaniu panelu
    window.__haToolsUpdateAvailable = { from: prev, to: HA_TOOLS_BUILD };
  }
  localStorage.setItem(KEY, HA_TOOLS_BUILD);
})();

class HAToolsPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._rendered = false;
    this._activeView = 'home';
    this._activeToolId = null;
    this._cardInstance = null;
    this._settings = this._loadSettings();
    this._loadedCount = 0;
    this._loading = true;
    this._pollTimer = null;
    this._scriptLoadPromises = [];
  }

  connectedCallback() {
    // When loaded via dynamic loader, HA may set properties (hass, panel, etc.)
    // as plain object props BEFORE the custom element class is defined.
    // After upgrade, the setters never fired — re-apply them now.
    for (const prop of ['hass', 'panel', 'narrow', 'route']) {
      if (this.hasOwnProperty(prop)) {
        const val = this[prop];
        delete this[prop];
        this[prop] = val;
      }
    }
  }

  // Map tool tags to their script paths under /local/community/
  static get TOOL_SCRIPTS() {
    return {
      'ha-trace-viewer': '/local/community/ha-trace-viewer/ha-trace-viewer.js',
      'ha-device-health': '/local/community/ha-device-health/ha-device-health.js',
      'ha-automation-analyzer': '/local/community/ha-automation-analyzer/ha-automation-analyzer.js',
      'ha-backup-manager': '/local/community/ha-backup-manager/ha-backup-manager.js',
      'ha-network-map': '/local/community/ha-network-map/ha-network-map.js',
      'ha-smart-reports': '/local/community/ha-smart-reports/ha-smart-reports.js',
      'ha-energy-optimizer': '/local/community/ha-energy-optimizer/ha-energy-optimizer.js',
      'ha-sentence-manager': '/local/community/ha-sentence-manager/ha-sentence-manager.js',
      'ha-chore-tracker': '/local/community/ha-chore-tracker/ha-chore-tracker.js',
      'ha-baby-tracker': '/local/community/ha-baby-tracker/ha-baby-tracker.js',
      'ha-cry-analyzer': '/local/community/ha-cry-analyzer/ha-cry-analyzer.js',
      'ha-data-exporter': '/local/community/ha-data-exporter/ha-data-exporter.js',
      'ha-storage-monitor': '/local/community/ha-storage-monitor/ha-storage-monitor.js',
      'ha-security-check': '/local/community/ha-security-check/ha-security-check.js',
    };
  }

  _loadAddonScripts() {
    const cacheBuster = `?v=${Date.now()}`;
    const scripts = HAToolsPanel.TOOL_SCRIPTS;
    for (const [tag, src] of Object.entries(scripts)) {
      if (customElements.get(tag)) continue; // already registered
      // Check if script tag already exists
      if (document.querySelector(`script[src^="${src}"]`)) continue;
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = src + cacheBuster;
      script.async = true;
      script.onerror = () => console.warn(`[HA Tools] Failed to load: ${src}`);
      document.head.appendChild(script);
    }
  }

  _startPolling() {
    let attempts = 0;
    const maxAttempts = 60; // 30 seconds max
    const poll = () => {
      const { available } = this._getToolStatus();
      const newCount = available.length;
      if (newCount !== this._loadedCount) {
        this._loadedCount = newCount;
        this._updateLoadingStatus();
        this._updateSidebar();
        if (this._activeView === 'home') this._showHome();
      }
      attempts++;
      if (newCount >= HAToolsPanel.TOOLS.length || attempts >= maxAttempts) {
        this._loading = false;
        this._updateLoadingStatus();
        this._updateSidebar();
        if (this._activeView === 'home') this._showHome();
        if (this._pollTimer) clearInterval(this._pollTimer);
        this._pollTimer = null;
        console.log(`[HA Tools] Loading complete: ${newCount}/${HAToolsPanel.TOOLS.length} tools available`);
        this._showUpdateToastIfNeeded();
        return;
      }
    };
    this._pollTimer = setInterval(poll, 500);
    // Run once immediately
    poll();
  }

  _showUpdateToastIfNeeded() {
    const upd = window.__haToolsUpdateAvailable;
    if (!upd) return;
    delete window.__haToolsUpdateAvailable;
    const toast = document.createElement('div');
    toast.innerHTML = `
      <div style="position:fixed;bottom:24px;right:24px;z-index:99999;
        background:#FFFFFF;color:#1E293B;padding:16px 20px;border-radius:12px;
        box-shadow:0 4px 20px rgba(0,0,0,0.1);font-size:14px;
        display:flex;align-items:center;gap:12px;max-width:420px;
        animation:slideUp .3s ease-out;border-left:3px solid #3B82F6;">
        <div style="flex:1">
          <div style="font-weight:600;margin-bottom:4px">\u{1F504} HA Tools zaktualizowane</div>
          <div style="opacity:0.8;font-size:12px;color:#64748B">v${upd.from} \u2192 v${upd.to} — odśwież przeglądarkę, aby załadować nową wersję.</div>
        </div>
        <button onclick="location.reload(true)" style="
          background:#3B82F6;color:#fff;border:none;padding:8px 16px;
          border-radius:8px;font-weight:600;cursor:pointer;white-space:nowrap;
          font-size:13px;">Odśwież</button>
        <button onclick="this.closest('div').parentElement.remove()" style="
          background:none;border:none;color:#64748B;cursor:pointer;
          font-size:18px;padding:4px;opacity:0.7">\u2715</button>
      </div>`;
    // Append to the main document body (outside shadow DOM for visibility)
    document.body.appendChild(toast);
  }

  _updateLoadingStatus() {
    const bar = this.shadowRoot?.querySelector('.loading-bar');
    if (!bar) return;
    const total = HAToolsPanel.TOOLS.length;
    if (this._loading) {
      bar.style.display = 'flex';
      bar.innerHTML = `
        <div style="flex:1;display:flex;align-items:center;gap:12px">
          <span style="font-size:13px;color:#64748B">Ładowanie narzędzi... ${this._loadedCount}/${total}</span>
          <div class="loading-progress">
            <div class="loading-progress-fill" style="width:${(this._loadedCount / total) * 100}%"></div>
          </div>
        </div>
      `;
    } else {
      if (this._loadedCount >= total) {
        bar.innerHTML = `<span style="color:#22C55E;font-weight:600;font-size:13px">✅ Wszystkie narzędzia załadowane (${this._loadedCount}/${total})</span>`;
        setTimeout(() => { bar.style.display = 'none'; }, 3000);
      } else {
        bar.innerHTML = `<span style="color:#F59E0B;font-weight:600;font-size:13px">⚠️ Załadowano ${this._loadedCount}/${total} narzędzi</span>`;
        setTimeout(() => { bar.style.display = 'none'; }, 5000);
      }
    }
  }

  _updateSidebar() {
    const { available, unavailable } = this._getToolStatus();
    // Update badge
    const badge = this.shadowRoot?.querySelector('.nav-badge');
    if (badge) badge.textContent = `${available.length}/${HAToolsPanel.TOOLS.length}`;
    // Update tools count in section header
    const toolsSection = this.shadowRoot?.querySelector('.nav-section-tools');
    if (toolsSection) toolsSection.textContent = `Narzędzia (${available.length})`;
    // Update unavailable section header
    const unavailSection = this.shadowRoot?.querySelector('.nav-section-unavailable');
    if (unavailSection) {
      if (unavailable.length > 0) {
        unavailSection.textContent = `Niedostępne (${unavailable.length})`;
        unavailSection.style.display = '';
      } else {
        unavailSection.style.display = 'none';
      }
    }
    // Rebuild tool nav items
    const toolsContainer = this.shadowRoot?.querySelector('.nav-tools-list');
    const unavailContainer = this.shadowRoot?.querySelector('.nav-unavail-list');
    if (toolsContainer) {
      toolsContainer.innerHTML = available.map(t => `
        <div class="nav-item${this._activeToolId === t.id ? ' active' : ''}" data-tool="${t.id}" data-tag="${t.tag}">
          <span class="nav-icon">${t.icon}</span>
          <span>${t.name}</span>
        </div>
      `).join('');
      toolsContainer.querySelectorAll('.nav-item[data-tool]').forEach(item => {
        item.addEventListener('click', () => {
          this._setActiveNav(item);
          this._loadTool(item.dataset.tool, item.dataset.tag);
        });
      });
    }
    if (unavailContainer) {
      if (unavailable.length > 0) {
        unavailContainer.innerHTML = unavailable.map(t => `
          <div class="nav-item unavailable" title="Nie zainstalowane">
            <span class="nav-icon">${t.icon}</span>
            <span>${t.name}</span>
          </div>
        `).join('');
        unavailContainer.style.display = '';
      } else {
        unavailContainer.innerHTML = '';
        unavailContainer.style.display = 'none';
      }
    }
  }

  static get TOOLS() {
    return [
      { id: 'trace-viewer', name: 'Trace Viewer', icon: '\u{1F9EC}', tag: 'ha-trace-viewer', desc: 'Przeglądaj i analizuj ślady automatyzacji', repo: 'MacSiem/ha-trace-viewer', category: 'debug' },
      { id: 'device-health', name: 'Device Health', icon: '\u{1F3E5}', tag: 'ha-device-health', desc: 'Monitoruj stan urządzeń, baterii i sieci', repo: 'MacSiem/ha-device-health', category: 'monitor' },
      { id: 'automation-analyzer', name: 'Automation Analyzer', icon: '\u{1F4CA}', tag: 'ha-automation-analyzer', desc: 'Analizuj wydajność i problemy automatyzacji', repo: 'MacSiem/ha-automation-analyzer', category: 'debug' },
      { id: 'backup-manager', name: 'Backup Manager', icon: '\u{1F4BE}', tag: 'ha-backup-manager', desc: 'Zarządzaj kopiami zapasowymi', repo: 'MacSiem/ha-backup-manager', category: 'system' },
      { id: 'network-map', name: 'Network Map', icon: '\u{1F310}', tag: 'ha-network-map', desc: 'Wizualizuj mapę sieci urządzeń', repo: 'MacSiem/ha-network-map', category: 'monitor' },
      { id: 'smart-reports', name: 'Smart Reports', icon: '\u{1F4C8}', tag: 'ha-smart-reports', desc: 'Generuj inteligentne raporty', repo: 'MacSiem/ha-smart-reports', category: 'reports' },
      { id: 'energy-optimizer', name: 'Energy Optimizer', icon: '\u26A1', tag: 'ha-energy-optimizer', desc: 'Optymalizuj zużycie energii', repo: 'MacSiem/ha-energy-optimizer', category: 'monitor' },
      { id: 'sentence-manager', name: 'Sentence Manager', icon: '\u{1F5E3}\uFE0F', tag: 'ha-sentence-manager', desc: 'Zarządzaj zdaniami głosowymi', repo: 'MacSiem/ha-sentence-manager', category: 'system' },
      { id: 'chore-tracker', name: 'Chore Tracker', icon: '\u{1F3E0}', tag: 'ha-chore-tracker', desc: 'Śledzenie obowiązków domowych', repo: 'MacSiem/ha-chore-tracker', category: 'life' },
      { id: 'baby-tracker', name: 'Baby Tracker', icon: '\u{1F37C}', tag: 'ha-baby-tracker', desc: 'Śledzenie aktywności dziecka', repo: 'MacSiem/ha-baby-tracker', category: 'life' },
      { id: 'cry-analyzer', name: 'Cry Analyzer', icon: '\u{1F476}', tag: 'ha-cry-analyzer', desc: 'Analiza płaczu dziecka AI', repo: 'MacSiem/ha-cry-analyzer', category: 'life' },
      { id: 'data-exporter', name: 'Data Exporter', icon: '\u{1F4E4}', tag: 'ha-data-exporter', desc: 'Eksportuj dane z Home Assistant', repo: 'MacSiem/ha-data-exporter', category: 'system' },
      { id: 'storage-monitor', name: 'Storage Monitor', icon: '\u{1F4BD}', tag: 'ha-storage-monitor', desc: 'Wizualizacja użycia dysku w stylu WinDirStat', repo: 'MacSiem/ha-storage-monitor', category: 'system' },
      { id: 'security-check', name: 'Security Check', icon: '\u{1F6E1}\uFE0F', tag: 'ha-security-check', desc: 'Audyt bezpieczeństwa Home Assistant', repo: 'MacSiem/ha-security-check', category: 'system' },
    ];
  }

  static get CATEGORIES() {
    return {
      monitor: { name: 'Monitoring', icon: '\u{1F4CB}' },
      debug: { name: 'Debugowanie', icon: '\u{1F527}' },
      system: { name: 'System', icon: '\u2699\uFE0F' },
      reports: { name: 'Raporty', icon: '\u{1F4C4}' },
      life: { name: 'Życie', icon: '\u{1F3E1}' },
    };
  }

  static get CSS() {
    return `

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

@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes shimmer { to { background-position: -200% 0; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }

.panel {
  display: flex;
  height: 100vh;
  background: var(--bento-bg);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: var(--bento-text);
}

/* SIDEBAR */
.sidebar {
  width: 260px;
  background: var(--bento-card);
  border-right: 1px solid var(--bento-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 20px;
  font-size: 18px;
  font-weight: 700;
  color: var(--bento-text);
  border-bottom: 1px solid var(--bento-border);
  letter-spacing: -0.01em;
}

.sidebar-header .version {
  font-size: 11px;
  color: var(--bento-text-secondary);
  font-weight: 500;
  margin-left: 8px;
}

.sidebar-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.sidebar-scroll::-webkit-scrollbar { width: 4px; }
.sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
.sidebar-scroll::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: 2px; }

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--bento-border);
  font-size: 11px;
  color: var(--bento-text-secondary);
}

/* NAV */
.nav-section {
  padding: 8px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--bento-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  margin: 2px 8px;
  border-radius: var(--bento-radius-sm);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--bento-text-secondary);
  transition: var(--bento-transition);
  font-family: 'Inter', sans-serif;
}

.nav-item:hover {
  background: rgba(59, 130, 246, 0.06);
  color: var(--bento-text);
}

.nav-item.active {
  background: rgba(59, 130, 246, 0.1);
  color: var(--bento-primary);
  font-weight: 600;
}

.nav-item.unavailable {
  opacity: 0.4;
  cursor: not-allowed;
}

.nav-item .nav-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.nav-item .nav-badge {
  margin-left: auto;
  background: var(--bento-error);
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
}

/* MAIN AREA */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bento-bg);
}

.toolbar {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  background: var(--bento-card);
  border-bottom: 1px solid var(--bento-border);
  gap: 12px;
}

.toolbar-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--bento-text);
  letter-spacing: -0.01em;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.content::-webkit-scrollbar { width: 6px; }
.content::-webkit-scrollbar-track { background: transparent; }
.content::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: 3px; }

/* BUTTONS */
.btn {
  padding: 9px 16px; border: 1.5px solid var(--bento-border); background: var(--bento-card);
  color: var(--bento-text); border-radius: var(--bento-radius-sm); cursor: pointer;
  font-size: 13px; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition);
}
.btn:hover { background: var(--bento-bg); border-color: var(--bento-primary); color: var(--bento-primary); }
.btn-primary { padding: 9px 16px; background: var(--bento-primary); color: white; border: 1.5px solid var(--bento-primary); border-radius: var(--bento-radius-sm); cursor: pointer; font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif; transition: var(--bento-transition); box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25); }
.btn-primary:hover { background: var(--bento-primary-hover); transform: translateY(-1px); }
.btn-secondary { padding: 9px 16px; background: var(--bento-card); color: var(--bento-text); border: 1.5px solid var(--bento-border); border-radius: var(--bento-radius-sm); cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--bento-transition); }
.btn-secondary:hover { border-color: var(--bento-primary); color: var(--bento-primary); }
.btn-sm { padding: 6px 12px; font-size: 12px; border-radius: var(--bento-radius-xs); }
.btn-icon { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--bento-border); background: var(--bento-card); border-radius: var(--bento-radius-sm); cursor: pointer; transition: var(--bento-transition); font-size: 16px; padding: 0; }
.btn-icon:hover { border-color: var(--bento-primary); color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }

.empty { text-align: center; padding: 48px 24px; color: var(--bento-text-secondary); font-size: 14px; }
.empty .big { font-size: 48px; margin-bottom: 12px; opacity: 0.5; }

/* HOME VIEW */
.home-view { animation: fadeSlideIn 0.4s ease-out; }
.home-section { margin-bottom: 32px; }
.home-section-title { font-size: 16px; font-weight: 600; color: var(--bento-text); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.home-section-title .count { background: var(--bento-border); color: var(--bento-text-secondary); font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }

.tools-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.tool-card { background: var(--bento-card); border: 1px solid var(--bento-border); border-radius: var(--bento-radius); padding: 20px; cursor: pointer; transition: var(--bento-transition); animation: fadeSlideIn 0.4s ease-out; }
.tool-card:hover { border-color: var(--bento-primary); box-shadow: var(--bento-shadow-md); transform: translateY(-2px); }
.tool-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.tool-card-icon { font-size: 24px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: rgba(59, 130, 246, 0.08); border-radius: var(--bento-radius-sm); }
.tool-card-name { font-size: 14px; font-weight: 600; color: var(--bento-text); }
.tool-card-desc { font-size: 12px; color: var(--bento-text-secondary); line-height: 1.5; }

/* TOOL STATUS */
.tool-status { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
.tool-status.loaded { background: rgba(16, 185, 129, 0.1); color: #059669; }
.tool-status.error { background: rgba(239, 68, 68, 0.1); color: #DC2626; }
.tool-status.loading { background: rgba(59, 130, 246, 0.1); color: var(--bento-primary); }

/* SETTINGS */
.settings-view { animation: fadeSlideIn 0.4s ease-out; }
.settings-section { background: var(--bento-card); border: 1px solid var(--bento-border); border-radius: var(--bento-radius); padding: 24px; margin-bottom: 20px; }
.settings-section-title { font-size: 16px; font-weight: 600; color: var(--bento-text); margin-bottom: 16px; }
.settings-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--bento-border); }
.settings-item:last-child { border-bottom: none; }
.settings-label { font-size: 13px; font-weight: 500; color: var(--bento-text); }
.settings-desc { font-size: 12px; color: var(--bento-text-secondary); margin-top: 2px; }
.settings-value { font-size: 13px; color: var(--bento-text-secondary); }

/* TOGGLE */
.toggle { width: 44px; height: 24px; background: var(--bento-border); border-radius: 12px; cursor: pointer; position: relative; transition: var(--bento-transition); border: none; padding: 0; }
.toggle.on { background: var(--bento-primary); }
.toggle::after { content: ''; position: absolute; width: 20px; height: 20px; background: white; border-radius: 50%; top: 2px; left: 2px; transition: var(--bento-transition); box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
.toggle.on::after { left: 22px; }

/* LOADING */
.loading-view { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; }
.spinner { width: 32px; height: 32px; border: 3px solid var(--bento-border); border-top: 3px solid var(--bento-primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
.loading-text { margin-top: 16px; color: var(--bento-text-secondary); font-size: 14px; }

.skeleton { background: linear-gradient(90deg, var(--bento-border) 25%, rgba(226,232,240,0.5) 50%, var(--bento-border) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--bento-radius-xs); }

/* TOAST */
.toast { position: fixed; bottom: 24px; right: 24px; background: var(--bento-text); color: white; padding: 14px 20px; border-radius: var(--bento-radius-sm); font-size: 13px; font-weight: 500; box-shadow: var(--bento-shadow-md); z-index: 1000; animation: slideUp 0.3s ease-out; font-family: 'Inter', sans-serif; }
.toast.error { background: var(--bento-error); }
.toast.success { background: var(--bento-success); }

/* RESPONSIVE */
@media (max-width: 768px) {
  .panel { flex-direction: column; }
  .sidebar { width: 100%; height: auto; border-right: none; border-bottom: 1px solid var(--bento-border); }
  .sidebar-scroll { display: flex; overflow-x: auto; overflow-y: hidden; padding: 4px 8px; }
  .nav-item { white-space: nowrap; margin: 0 2px; }
  .tools-grid { grid-template-columns: 1fr; }
  .content { padding: 16px; }
}

/* Donate Section - Bento Style */
.donate-section {
  margin-top: 32px;
  background: linear-gradient(135deg, #fff5f5 0%, #fff0f6 50%, #f8f0ff 100%);
  border: 1px solid #fecdd3;
  border-radius: 16px;
  padding: 28px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}
.donate-section h3 {
  font-size: 17px;
  font-weight: 600;
  color: #881337;
  margin: 0 0 6px 0;
}
.donate-section p {
  font-size: 13.5px;
  color: #9f1239;
  margin: 0;
  opacity: 0.85;
  line-height: 1.5;
}
.donate-buttons {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}
.donate-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.donate-btn.coffee {
  background: #FFDD00;
  color: #000;
  border: 1px solid #e6c700;
}
.donate-btn.coffee:hover {
  background: #ffe534;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255,221,0,0.4);
}
.donate-btn.paypal {
  background: #0070ba;
  color: #fff;
  border: 1px solid #005ea6;
}
.donate-btn.paypal:hover {
  background: #0086e0;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,112,186,0.4);
}


`;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) {
      this._rendered = true;
      this._render();
    }
    if (this._cardInstance) {
      if (this._cardInstance.tagName.toLowerCase() === 'ha-cry-analyzer') {
        this._cardInstance.hassObj = hass;
      } else {
        this._cardInstance.hass = hass;
      }
    }
  }

  set panel(panel) { this._config = panel?.config || {}; }
  set narrow(narrow) { this._narrow = narrow; }
  set route(route) { this._route = route; }

  _loadSettings() {
    try {
      const stored = localStorage.getItem('ha-tools-settings');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  }

  _saveSettings() {
    try { localStorage.setItem('ha-tools-settings', JSON.stringify(this._settings)); } catch {}
  }

  _getSetting(key, defaultVal) {
    return this._settings[key] !== undefined ? this._settings[key] : defaultVal;
  }

  _setSetting(key, value) {
    this._settings[key] = value;
    this._saveSettings();
  }

  _getToolStatus() {
    const tools = HAToolsPanel.TOOLS;
    const available = tools.filter(t => customElements.get(t.tag));
    const unavailable = tools.filter(t => !customElements.get(t.tag));
    return { tools, available, unavailable };
  }

  _render() {
    const { available, unavailable } = this._getToolStatus();
    this._loadedCount = available.length;

    this.shadowRoot.innerHTML = `
      <style>
/* ===== BENTO LIGHT MODE DESIGN SYSTEM ===== */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:host {
  --bento-primary: #3B82F6;
  --bento-primary-hover: #2563EB;
  --bento-primary-light: rgba(59, 130, 246, 0.08);
  --bento-success: #10B981;
  --bento-success-light: rgba(16, 185, 129, 0.08);
  --bento-error: #EF4444;
  --bento-error-light: rgba(239, 68, 68, 0.08);
  --bento-warning: #F59E0B;
  --bento-warning-light: rgba(245, 158, 11, 0.08);
  --bento-bg: #F8FAFC;
  --bento-card: #FFFFFF;
  --bento-border: #E2E8F0;
  --bento-text: #1E293B;
  --bento-text-secondary: #64748B;
  --bento-text-muted: #94A3B8;
  --bento-radius-xs: 6px;
  --bento-radius-sm: 10px;
  --bento-radius-md: 16px;
  --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
  --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04);
  --bento-shadow-lg: 0 8px 25px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.04);
  --bento-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Card */
.card, .ha-card, ha-card, .main-card, .exporter-card, .security-card, .reports-card, .storage-card, .chore-card, .cry-card, .backup-card, .network-card, .sentence-card, .energy-card, .panel-card {
  background: var(--bento-card) !important;
  border: 1px solid var(--bento-border) !important;
  border-radius: var(--bento-radius-md) !important;
  box-shadow: var(--bento-shadow-sm) !important;
  font-family: 'Inter', sans-serif !important;
  color: var(--bento-text) !important;
  overflow: hidden;
}

/* Headers */
.card-header, .header, .card-title, h1, h2, h3 {
  color: var(--bento-text) !important;
  font-family: 'Inter', sans-serif !important;
}
.card-header, .header {
  border-bottom: 1px solid var(--bento-border) !important;
  padding-bottom: 12px !important;
  margin-bottom: 16px !important;
}

/* Tabs */
.tabs, .tab-bar, .tab-nav, .tab-header {
  display: flex;
  gap: 4px;
  border-bottom: 2px solid var(--bento-border);
  padding: 0 4px;
  margin-bottom: 20px;
  overflow-x: auto;
}
.tab, .tab-btn, .tab-button {
  padding: 10px 18px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  color: var(--bento-text-secondary);
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: var(--bento-transition);
  white-space: nowrap;
  border-radius: 0;
}
.tab:hover, .tab-btn:hover, .tab-button:hover {
  color: var(--bento-primary);
  background: var(--bento-primary-light);
}
.tab.active, .tab-btn.active, .tab-button.active {
  color: var(--bento-primary);
  border-bottom-color: var(--bento-primary);
  background: rgba(59, 130, 246, 0.04);
  font-weight: 600;
}

/* Tab content */
.tab-content { display: none; }
.tab-content.active { display: block; animation: bentoFadeIn 0.3s ease-out; }
@keyframes bentoFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

/* Buttons */
button, .btn, .action-btn {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--bento-radius-xs);
  transition: var(--bento-transition);
  cursor: pointer;
}
button.active, .btn.active, .btn-primary, .action-btn.active {
  background: var(--bento-primary) !important;
  color: white !important;
  border-color: var(--bento-primary) !important;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
}

/* Status badges */
.badge, .status-badge, .tag, .chip {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.badge-success, .status-ok, .status-good { background: var(--bento-success-light); color: var(--bento-success); }
.badge-error, .status-error, .status-critical { background: var(--bento-error-light); color: var(--bento-error); }
.badge-warning, .status-warning { background: var(--bento-warning-light); color: var(--bento-warning); }
.badge-info, .status-info { background: var(--bento-primary-light); color: var(--bento-primary); }

/* Tables */
table { width: 100%; border-collapse: separate; border-spacing: 0; font-family: 'Inter', sans-serif; }
th { background: var(--bento-bg); color: var(--bento-text-secondary); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 14px; text-align: left; border-bottom: 2px solid var(--bento-border); }
td { padding: 12px 14px; border-bottom: 1px solid var(--bento-border); color: var(--bento-text); font-size: 13px; }
tr:hover td { background: var(--bento-primary-light); }
tr:last-child td { border-bottom: none; }

/* Inputs & selects */
input, select, textarea {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  padding: 8px 12px;
  border: 1.5px solid var(--bento-border);
  border-radius: var(--bento-radius-xs);
  background: var(--bento-card);
  color: var(--bento-text);
  transition: var(--bento-transition);
  outline: none;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--bento-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Stat cards */
.stat-card, .stat, .metric-card, .stat-box, .overview-stat, .kpi-card {
  background: var(--bento-card);
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-sm);
  padding: 16px;
  transition: var(--bento-transition);
}
.stat-card:hover, .stat:hover, .metric-card:hover { box-shadow: var(--bento-shadow-md); transform: translateY(-1px); }
.stat-value, .metric-value, .stat-number { font-size: 28px; font-weight: 700; color: var(--bento-text); font-family: 'Inter', sans-serif; }
.stat-label, .metric-label, .stat-title { font-size: 12px; font-weight: 500; color: var(--bento-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }

/* Canvas override (prevent Bento CSS from distorting charts) */
canvas {
  max-width: 100% !important;
  height: auto !important;
  width: auto !important;
  border: none !important;
}

/* Pagination */
.pagination, .pag {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  padding: 16px 0;
  border-top: 1px solid var(--bento-border);
}
.pagination-btn, .pag-btn {
  padding: 8px 14px;
  border: 1.5px solid var(--bento-border);
  background: var(--bento-card);
  color: var(--bento-text);
  border-radius: var(--bento-radius-xs);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  transition: var(--bento-transition);
}
.pagination-btn:hover:not(:disabled), .pag-btn:hover:not(:disabled) { background: var(--bento-primary); color: white; border-color: var(--bento-primary); }
.pagination-btn:disabled, .pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pagination-info, .pag-info { font-size: 13px; color: var(--bento-text-secondary); font-weight: 500; padding: 0 8px; }
.page-size-select { padding: 6px 10px; border: 1.5px solid var(--bento-border); border-radius: var(--bento-radius-xs); font-size: 12px; font-family: 'Inter', sans-serif; }

/* Empty state */
.empty-state, .no-data, .no-results {
  text-align: center;
  padding: 48px 24px;
  color: var(--bento-text-secondary);
  font-size: 14px;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--bento-text-muted); }

/* ===== END BENTO LIGHT MODE ===== */
${HAToolsPanel.CSS}</style>
      <div class="panel">
        <div class="sidebar">
          <div class="sidebar-header">
            <span>\u{1F6E0}\uFE0F</span> HA Tools
            <span class="version">v2.3</span>
          </div>
          <div class="sidebar-scroll">
            <div class="nav-item active" data-view="home">
              <span class="nav-icon">\u{1F3E0}</span>
              <span>Home</span>
              <span class="nav-badge">${available.length}/${HAToolsPanel.TOOLS.length}</span>
            </div>

            <div class="nav-section nav-section-tools">Narzędzia (${available.length})</div>
            <div class="nav-tools-list">
              ${available.map(t => `
                <div class="nav-item" data-tool="${t.id}" data-tag="${t.tag}">
                  <span class="nav-icon">${t.icon}</span>
                  <span>${t.name}</span>
                </div>
              `).join('')}
            </div>

            <div class="nav-section nav-section-unavailable" ${unavailable.length === 0 ? 'style="display:none"' : ''}>Niedostępne (${unavailable.length})</div>
            <div class="nav-unavail-list" ${unavailable.length === 0 ? 'style="display:none"' : ''}>
              ${unavailable.map(t => `
                <div class="nav-item unavailable" title="Nie zainstalowane">
                  <span class="nav-icon">${t.icon}</span>
                  <span>${t.name}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="sidebar-footer">
            <div class="nav-item" data-view="settings">
              <span class="nav-icon">\u2699\uFE0F</span>
              <span>Ustawienia</span>
            </div>
          </div>
        </div>
        <div class="main">
          <div class="loading-bar" style="display:none"></div>
          <div class="toolbar">
            <div class="toolbar-title" id="title">\u{1F3E0} Home</div>
            <button class="btn-icon" id="refreshBtn" style="display:none">\u{1F504} Odśwież</button>
          </div>
          <div class="content" id="content"></div>
        </div>
      </div>
    `;

    this._bindNavigation();
    this._showHome();

    // Auto-load addon scripts and start polling for registration
    if (available.length < HAToolsPanel.TOOLS.length) {
      this._loading = true;
      this._updateLoadingStatus();
      this._loadAddonScripts();
      this._startPolling();
    } else {
      this._loading = false;
    }
  }

  _bindNavigation() {
    // Home and Settings navigation
    this.shadowRoot.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        this._setActiveNav(item);
        if (view === 'home') this._showHome();
        else if (view === 'settings') this._showSettings();
      });
    });

    // Tool navigation
    this.shadowRoot.querySelectorAll('.nav-item[data-tool]').forEach(item => {
      item.addEventListener('click', () => {
        this._setActiveNav(item);
        this._loadTool(item.dataset.tool, item.dataset.tag);
      });
    });

    // Refresh button
    this.shadowRoot.getElementById('refreshBtn').addEventListener('click', () => {
      if (this._activeView === 'tool' && this._activeToolId) {
        const item = this.shadowRoot.querySelector(`.nav-item[data-tool="${this._activeToolId}"]`);
        if (item) this._loadTool(this._activeToolId, item.dataset.tag);
      }
    });
  }

  _setActiveNav(activeItem) {
    this.shadowRoot.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    activeItem.classList.add('active');
  }

  _showHome() {
    this._activeView = 'home';
    this._activeToolId = null;
    this._cardInstance = null;
    const title = this.shadowRoot.getElementById('title');
    title.textContent = '\u{1F3E0} Home';
    this.shadowRoot.getElementById('refreshBtn').style.display = 'none';

    const { available, unavailable } = this._getToolStatus();
    const cats = HAToolsPanel.CATEGORIES;
    const content = this.shadowRoot.getElementById('content');

    content.innerHTML = `
      <div class="home-view">
        <div class="home-section">
          <div class="home-section-title">
            \u2705 Zainstalowane narzędzia <span class="count">(${available.length} z ${HAToolsPanel.TOOLS.length})</span>
          </div>
          ${available.length > 0 ? `
            <div class="tools-grid">
              ${available.map((t, i) => `
                <div class="tool-card" data-tool="${t.id}" data-tag="${t.tag}" style="animation-delay: ${i * 50}ms">
                  <div class="tool-card-header">
                    <div class="tool-card-icon">${t.icon}</div>
                    <div style="flex: 1">
                      <div class="tool-card-name">${t.name}</div>
                    </div>
                  </div>
                  <div class="tool-card-desc">${t.desc}</div>
                  <div class="tool-card-footer">
                    <span class="tool-card-category">${cats[t.category]?.name || t.category}</span>
                    <span class="tool-card-status">\u2705 Aktywne</span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<div style="color:#64748B;font-size:13px;">Brak zainstalowanych narzędzi.</div>'}
        </div>

        ${unavailable.length > 0 ? `
          <div class="home-section">
            <div class="home-section-title">
              \u{1F4E6} Dostępne do instalacji <span class="count">(${unavailable.length})</span>
            </div>
            <div class="uninstalled-list">
              ${unavailable.map(t => `
                <div class="uninstalled-item">
                  <div class="ui-icon">${t.icon}</div>
                  <div class="ui-name">${t.name}</div>
                  <div class="ui-desc">${t.desc}</div>
                  <a class="btn btn-secondary btn-sm" href="https://github.com/${t.repo}" target="_blank" rel="noopener">
                    GitHub
                  </a>
                  <a class="btn btn-primary btn-sm hacs-install" data-repo="${t.repo}">
                    \u{1F4E5} Zainstaluj (HACS)
                  </a>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="home-section">
          <div class="donate-section">
            <div class="donate-text">
              <h3>\u2764\uFE0F Wesprzyj rozwój HA Tools</h3>
              <p>Jeśli HA Tools ułatwia Ci życie z Home Assistant, rozważ wsparcie projektu. Każda kawa motywuje do dalszego rozwoju!</p>
            </div>
            <div class="donate-buttons">
              <a class="donate-btn coffee" href="https://buymeacoffee.com/macsiem" target="_blank" rel="noopener">
                \u2615 Buy Me a Coffee
              </a>
              <a class="donate-btn paypal" href="https://www.paypal.com/donate/?hosted_button_id=Y967H4PLRBN8W" target="_blank" rel="noopener">
                \u{1F4B3} PayPal
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind card clicks
    content.querySelectorAll('.tool-card[data-tool]').forEach(card => {
      card.addEventListener('click', () => {
        const toolId = card.dataset.tool;
        const tag = card.dataset.tag;
        const navItem = this.shadowRoot.querySelector(`.nav-item[data-tool="${toolId}"]`);
        if (navItem) {
          this._setActiveNav(navItem);
          this._loadTool(toolId, tag);
        }
      });
    });

    // HACS install buttons
    content.querySelectorAll('.hacs-install').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const repo = btn.dataset.repo;
        // Open HACS custom repo dialog via HA
        const hacsUrl = `/hacs/repository/${repo.replace('/', '%2F')}`;
        window.open(hacsUrl, '_blank');
      });
    });
  }

  _showSettings() {
    this._activeView = 'settings';
    this._activeToolId = null;
    this._cardInstance = null;
    const title = this.shadowRoot.getElementById('title');
    title.textContent = '\u2699\uFE0F Ustawienia';
    this.shadowRoot.getElementById('refreshBtn').style.display = 'none';

    const { available } = this._getToolStatus();
    const content = this.shadowRoot.getElementById('content');
    const lang = this._getSetting('language', 'pl');
    const animations = this._getSetting('animations', true);
    const compactMode = this._getSetting('compactMode', false);
    const defaultTool = this._getSetting('defaultTool', 'home');

    content.innerHTML = `
      <div class="settings-view">

        <!-- General Settings -->
        <div class="settings-group">
          <div class="settings-group-header" data-group="general">
            \u2699\uFE0F Ustawienia ogólne
            <span class="chevron">\u25BC</span>
          </div>
          <div class="settings-group-body" data-body="general">
            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-label">Język</div>
                <div class="setting-desc">Język interfejsu panelu</div>
              </div>
              <div class="setting-control">
                <select class="setting-select" data-setting="language">
                  <option value="pl" ${lang === 'pl' ? 'selected' : ''}>Polski</option>
                  <option value="en" ${lang === 'en' ? 'selected' : ''}>English</option>
                </select>
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-label">Domyślny widok</div>
                <div class="setting-desc">Co pokazać po otwarciu HA Tools</div>
              </div>
              <div class="setting-control">
                <select class="setting-select" data-setting="defaultTool">
                  <option value="home" ${defaultTool === 'home' ? 'selected' : ''}>Home</option>
                  ${available.map(t => `<option value="${t.id}" ${defaultTool === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-label">Animacje</div>
                <div class="setting-desc">Włącz animacje przejść</div>
              </div>
              <div class="setting-control">
                <label class="setting-toggle">
                  <input type="checkbox" data-setting="animations" ${animations ? 'checked' : ''}>
                  <span class="slider"></span>
                </label>
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-label">Tryb kompaktowy</div>
                <div class="setting-desc">Mniejsze odstępy, mniej miejsca na ekranie</div>
              </div>
              <div class="setting-control">
                <label class="setting-toggle">
                  <input type="checkbox" data-setting="compactMode" ${compactMode ? 'checked' : ''}>
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Trace Viewer — Backend Settings -->
        <div class="settings-group">
          <div class="settings-group-header" data-group="trace-backend">
            \u{1F9EC} Trace Viewer — Przechowywanie
            <span class="chevron">\u25BC</span>
          </div>
          <div class="settings-group-body" data-body="trace-backend">
            <div class="trace-current-info">
              \u{1F4CA} Obecne ustawienie HA: <span class="val">stored_traces = 5</span> (domyślne per automatyzacja)
            </div>

            <div class="setting-subsection">Ilość traces</div>
            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-label">Przechowuj N ostatnich traces</div>
                <div class="setting-desc">Ile trace'ów HA ma przechowywać na automatyzację (domyślnie 5). Zmiana dotyczy WSZYSTKICH automatyzacji.</div>
              </div>
              <div class="setting-control">
                <select class="setting-select" id="storedTracesCount">
                  <option value="5" ${this._getSetting('trace.storedCount', 20) == 5 ? 'selected' : ''}>5 (domyślne)</option>
                  <option value="10" ${this._getSetting('trace.storedCount', 20) == 10 ? 'selected' : ''}>10</option>
                  <option value="20" ${this._getSetting('trace.storedCount', 20) == 20 ? 'selected' : ''}>20</option>
                  <option value="50" ${this._getSetting('trace.storedCount', 20) == 50 ? 'selected' : ''}>50</option>
                  <option value="100" ${this._getSetting('trace.storedCount', 20) == 100 ? 'selected' : ''}>100</option>
                </select>
              </div>
            </div>

            <div class="setting-subsection">Filtr czasowy (frontend)</div>
            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-label">Maksymalny wiek traces</div>
                <div class="setting-desc">Ukryj traces starsze niż wybrany okres (filtrowanie po stronie frontendu, nie usuwa danych z HA)</div>
              </div>
              <div class="setting-control">
                <select class="setting-select" data-setting="trace.maxAge" id="traceMaxAge">
                  <option value="0" ${this._getSetting('trace.maxAge', '0') == '0' ? 'selected' : ''}>Bez limitu</option>
                  <option value="3600" ${this._getSetting('trace.maxAge', '0') == '3600' ? 'selected' : ''}>1 godzina</option>
                  <option value="21600" ${this._getSetting('trace.maxAge', '0') == '21600' ? 'selected' : ''}>6 godzin</option>
                  <option value="43200" ${this._getSetting('trace.maxAge', '0') == '43200' ? 'selected' : ''}>12 godzin</option>
                  <option value="86400" ${this._getSetting('trace.maxAge', '0') == '86400' ? 'selected' : ''}>24 godziny</option>
                  <option value="604800" ${this._getSetting('trace.maxAge', '0') == '604800' ? 'selected' : ''}>7 dni</option>
                  <option value="2592000" ${this._getSetting('trace.maxAge', '0') == '2592000' ? 'selected' : ''}>30 dni</option>
                </select>
              </div>
            </div>

            <div class="setting-action-row">
              <button class="btn-apply" id="applyTracesBtn">\u{1F4BE} Zastosuj stored_traces do wszystkich automatyzacji</button>
            </div>
            <div style="padding: 0 var(--spacing-lg) var(--spacing-md);">
              <div class="status-msg" id="traceStatus"></div>
            </div>
          </div>
        </div>

        <!-- Per-addon settings -->
        ${available.map(t => {
          const prefix = t.id;
          const refreshInterval = this._getSetting(`${prefix}.refreshInterval`, 30);
          const showNotifications = this._getSetting(`${prefix}.showNotifications`, true);
          const dashboardCard = this._getSetting(`${prefix}.dashboardCard`, true);
          const pageSize = this._getSetting(`${prefix}.pageSize`, 15);
          const isTraceViewer = prefix === 'trace-viewer';
          return `
            <div class="settings-group">
              <div class="settings-group-header" data-group="${prefix}">
                ${t.icon} ${t.name}
                <span class="chevron">\u25BC</span>
              </div>
              <div class="settings-group-body" data-body="${prefix}">
                <div class="setting-subsection">Wyświetlanie</div>
                <div class="setting-row">
                  <div class="setting-info">
                    <div class="setting-label">Pokazuj w dashboardzie</div>
                    <div class="setting-desc">Widoczność karty na stronie głównej</div>
                  </div>
                  <div class="setting-control">
                    <label class="setting-toggle">
                      <input type="checkbox" data-setting="${prefix}.dashboardCard" ${dashboardCard ? 'checked' : ''}>
                      <span class="slider"></span>
                    </label>
                  </div>
                </div>

                <div class="setting-subsection">Działanie</div>
                ${isTraceViewer ? `
                <div class="setting-row">
                  <div class="setting-info">
                    <div class="setting-label">Wpisów na stronę</div>
                    <div class="setting-desc">Ile traces/automatyzacji wyświetlać na jednej stronie</div>
                  </div>
                  <div class="setting-control">
                    <select class="setting-select" data-setting="${prefix}.pageSize">
                      <option value="10" ${pageSize == 10 ? 'selected' : ''}>10</option>
                      <option value="15" ${pageSize == 15 ? 'selected' : ''}>15</option>
                      <option value="25" ${pageSize == 25 ? 'selected' : ''}>25</option>
                      <option value="30" ${pageSize == 30 ? 'selected' : ''}>30</option>
                      <option value="50" ${pageSize == 50 ? 'selected' : ''}>50</option>
                      <option value="100" ${pageSize == 100 ? 'selected' : ''}>100</option>
                    </select>
                  </div>
                </div>
                ` : ''}
                <div class="setting-row">
                  <div class="setting-info">
                    <div class="setting-label">Interwał odświeżania (sek)</div>
                    <div class="setting-desc">Jak często odświeżać dane</div>
                  </div>
                  <div class="setting-control">
                    <select class="setting-select" data-setting="${prefix}.refreshInterval">
                      <option value="10" ${refreshInterval == 10 ? 'selected' : ''}>10s</option>
                      <option value="30" ${refreshInterval == 30 ? 'selected' : ''}>30s</option>
                      <option value="60" ${refreshInterval == 60 ? 'selected' : ''}>60s</option>
                      <option value="300" ${refreshInterval == 300 ? 'selected' : ''}>5min</option>
                    </select>
                  </div>
                </div>
                <div class="setting-row">
                  <div class="setting-info">
                    <div class="setting-label">Powiadomienia</div>
                    <div class="setting-desc">Pokaż powiadomienia z tego narzędzia</div>
                  </div>
                  <div class="setting-control">
                    <label class="setting-toggle">
                      <input type="checkbox" data-setting="${prefix}.showNotifications" ${showNotifications ? 'checked' : ''}>
                      <span class="slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')}

      </div>
    `;

    // Bind settings controls
    content.querySelectorAll('.setting-select').forEach(select => {
      select.addEventListener('change', () => {
        this._setSetting(select.dataset.setting, select.value);
      });
    });

    content.querySelectorAll('.setting-toggle input').forEach(toggle => {
      toggle.addEventListener('change', () => {
        this._setSetting(toggle.dataset.setting, toggle.checked);
      });
    });

    // Collapsible groups
    content.querySelectorAll('.settings-group-header').forEach(header => {
      header.addEventListener('click', () => {
        const group = header.dataset.group;
        const body = content.querySelector(`.settings-group-body[data-body="${group}"]`);
        if (body) {
          body.classList.toggle('hidden');
          header.classList.toggle('collapsed');
        }
      });
    });

    // Trace storage — Apply button
    const applyBtn = content.querySelector('#applyTracesBtn');
    const traceStatus = content.querySelector('#traceStatus');
    const storedTracesSelect = content.querySelector('#storedTracesCount');
    if (applyBtn && storedTracesSelect) {
      applyBtn.addEventListener('click', async () => {
        const count = parseInt(storedTracesSelect.value);
        this._setSetting('trace.storedCount', count);
        applyBtn.disabled = true;
        applyBtn.textContent = '\u23F3 Stosowanie...';
        await this._applyStoredTraces(count, traceStatus);
        applyBtn.disabled = false;
        applyBtn.textContent = '\u{1F4BE} Zastosuj stored_traces do wszystkich automatyzacji';
      });
    }

    // Load current stored_traces value from first automation
    if (this._hass) {
      const infoEl = content.querySelector('.trace-current-info');
      this._loadCurrentStoredTraces(infoEl, storedTracesSelect);
    }
  }

  async _loadCurrentStoredTraces(infoEl, selectEl) {
    try {
      const automations = Object.values(this._hass.states)
        .filter(s => s.entity_id.startsWith('automation.'))
        .map(s => s.attributes.id)
        .filter(Boolean);
      if (automations.length === 0) return;

      // Sample first 5 automations to check their stored_traces
      const sample = automations.slice(0, 5);
      const values = [];
      for (const id of sample) {
        try {
          const config = await this._hass.callApi('GET', `config/automation/config/${id}`);
          values.push(config.stored_traces || 5);
        } catch { values.push(5); }
      }

      const unique = [...new Set(values)];
      const current = unique.length === 1 ? unique[0] : `${Math.min(...values)}-${Math.max(...values)}`;
      if (infoEl) {
        infoEl.innerHTML = `\u{1F4CA} Obecne ustawienie HA: <span class="val">stored_traces = ${current}</span> (sprawdzono ${sample.length} z ${automations.length} automatyzacji)`;
      }
      // Pre-select current value if all are the same
      if (unique.length === 1 && selectEl) {
        const opt = selectEl.querySelector(`option[value="${unique[0]}"]`);
        if (opt) opt.selected = true;
      }
    } catch (e) {
      console.warn('[HA Tools] Could not load stored_traces info:', e);
    }
  }

  async _applyStoredTraces(count, statusEl) {
    if (!this._hass) {
      statusEl.textContent = '\u274C Brak połączenia z Home Assistant';
      statusEl.className = 'status-msg visible error';
      return;
    }
    statusEl.textContent = '\u23F3 Pobieranie listy automatyzacji...';
    statusEl.className = 'status-msg visible info';

    try {
      // Get all automations
      const automations = Object.values(this._hass.states)
        .filter(s => s.entity_id.startsWith('automation.'))
        .map(s => s.attributes.id)
        .filter(Boolean);

      let updated = 0;
      let skippedYaml = 0;
      let errors = 0;

      // Count YAML vs UI automations
      for (const id of automations) {
        statusEl.textContent = `\u23F3 Sprawdzanie ${updated + skippedYaml + 1}/${automations.length}...`;
        try {
          await this._hass.callApi('GET', `config/automation/config/${id}`);
          updated++;
        } catch (e) {
          skippedYaml++;
        }
      }

      statusEl.innerHTML = `\u2705 stored_traces: ${count}<br>` +
        `<small>\u{1F4CA} ${automations.length} automatyzacji: ${updated} UI, ${skippedYaml} YAML</small><br>` +
        `<small style="opacity:0.8">\u{1F4DD} Ustaw <code>stored_traces: ${count}</code> w configuration.yaml pod sekcją <code>automation:</code> — API nie obsługuje tego pola per-automatyzacja.</small>`;
      statusEl.className = 'status-msg visible success';
    } catch (e) {
      statusEl.textContent = `\u274C Błąd: ${e.message}`;
      statusEl.className = 'status-msg visible error';
    }
  }

  _loadTool(toolId, tag) {
    this._activeView = 'tool';
    this._activeToolId = toolId;
    this._cardInstance = null;

    const tool = HAToolsPanel.TOOLS.find(t => t.id === toolId);
    const displayName = tool ? tool.name : toolId;
    const displayIcon = tool ? tool.icon : '';
    const title = this.shadowRoot.getElementById('title');
    title.textContent = `${displayIcon} ${displayName}`;
    this.shadowRoot.getElementById('refreshBtn').style.display = '';

    const content = this.shadowRoot.getElementById('content');
    content.innerHTML = `<div class="empty"><div class="big">\u23F3</div><div>Ładowanie...</div></div>`;

    setTimeout(() => {
      try {
        content.innerHTML = '';
        const card = document.createElement(tag);

        if (typeof card.setConfig === 'function') {
          card.setConfig({ title: displayName, panel_mode: true });
        }

        if (tag === 'ha-cry-analyzer') {
          card.hassObj = this._hass;
        } else {
          card.hass = this._hass;
        }

        card.style.cssText = 'display:block; min-height:calc(100vh - 56px);';
        content.appendChild(card);
        this._cardInstance = card;
      } catch (e) {
        content.innerHTML = `<div class="empty"><div class="big">\u26A0\uFE0F</div><div>Błąd: ${e.message}</div></div>`;
      }
    }, 150);
  }
}

if (!customElements.get('ha-tools-panel')) { customElements.define('ha-tools-panel', HAToolsPanel); }
console.log('[HA Tools Panel v2.2] Registered — auto-loading addons');
