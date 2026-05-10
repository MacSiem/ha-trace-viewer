/* HA Tools split — ha-trace-viewer v4.0.0 (2026-05-10) — single-tool standalone repo */
(function() {
'use strict';

// -- HA Tools Persistence (stub -- full impl in ha-tools-panel.js) --
window._haToolsPersistence = window._haToolsPersistence || { _cache: {}, _hass: null, setHass(h) { this._hass = h; }, async save(k, d) { try { localStorage.setItem('ha-trace-viewer-' + k, JSON.stringify(d)); } catch(e) { console.debug('[ha-trace-viewer] caught:', e); } }, async load(k) { try { const r = localStorage.getItem('ha-trace-viewer-' + k); return r ? JSON.parse(r) : null; } catch(e) { return null; } }, loadSync(k) { try { const r = localStorage.getItem('ha-trace-viewer-' + k); return r ? JSON.parse(r) : null; } catch(e) { return null; } } };

// -- HA Tools Escape helper (fallback) --
const _esc = window._haToolsEsc || ((s) => String(s == null ? '' : s).replace(/[&<>"\']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));

/* ===== HA Tools split — inline shared infrastructure ===== */
// Bento Design System CSS (inline copy — keeps tool standalone)
if (typeof window !== 'undefined' && !window.HAToolsBentoCSS) {
  window.HAToolsBentoCSS = `
/* ═══════════════════════════════════════════════
   HA Tools — Bento Design System v2.0 (Premium)
   ═══════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');

:host {
  /* Brand palette — diamond top, gradient-friendly */
  --bento-primary: #6366f1;
  --bento-primary-2: #8b5cf6;
  --bento-primary-3: #ec4899;
  --bento-primary-hover: #4f46e5;
  --bento-primary-light: rgba(99, 102, 241, 0.08);
  --bento-primary-glow: rgba(99, 102, 241, 0.35);
  --bento-success: #10B981;
  --bento-success-light: rgba(16, 185, 129, 0.10);
  --bento-success-border: rgba(16, 185, 129, 0.25);
  --bento-error: #EF4444;
  --bento-error-light: rgba(239, 68, 68, 0.10);
  --bento-error-border: rgba(239, 68, 68, 0.25);
  --bento-warning: #F59E0B;
  --bento-warning-light: rgba(245, 158, 11, 0.10);
  --bento-warning-border: rgba(245, 158, 11, 0.25);
  --bento-info: #06b6d4;
  --bento-info-light: rgba(6, 182, 212, 0.10);
  --bento-info-border: rgba(6, 182, 212, 0.25);

  /* Theme */
  --bento-bg:     var(--primary-background-color, #fafaf9);
  --bento-bg-2:   var(--card-background-color, #f5f5f4);
  --bento-card:   var(--card-background-color, #ffffff);
  --bento-glass:  rgba(255, 255, 255, 0.7);
  --bento-border: var(--divider-color, #e7e5e4);
  --bento-border-strong: rgba(0, 0, 0, 0.08);
  --bento-text:           var(--primary-text-color,   #0c0a09);
  --bento-text-secondary: var(--secondary-text-color, #57534e);
  --bento-text-muted:     var(--disabled-text-color,  #a8a29e);

  /* Radii */
  --bento-radius-xs: 8px;
  --bento-radius-sm: 12px;
  --bento-radius-md: 18px;
  --bento-radius-lg: 24px;
  --bento-radius-pill: 999px;

  /* Shadows — modern, layered */
  --bento-shadow-sm: 0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02);
  --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.03);
  --bento-shadow-lg: 0 24px 48px -12px rgba(0,0,0,0.10), 0 12px 24px -8px rgba(0,0,0,0.05);
  --bento-shadow-glow: 0 0 0 1px rgba(99,102,241,0.15), 0 8px 32px -8px rgba(99,102,241,0.25);

  /* Gradients */
  --bento-grad-primary: linear-gradient(135deg, #6366f1, #8b5cf6);
  --bento-grad-rainbow: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  --bento-grad-success: linear-gradient(135deg, #10b981, #34d399);
  --bento-grad-error:   linear-gradient(135deg, #ef4444, #f87171);
  --bento-grad-warning: linear-gradient(135deg, #f59e0b, #fbbf24);

  /* Motion */
  --bento-trans-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --bento-trans:      0.25s cubic-bezier(0.4, 0, 0.2, 1);
  --bento-trans-slow: 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  /* Typography */
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif;
  font-feature-settings: "cv11" 1, "ss01" 1;
  letter-spacing: -0.01em;
  display: block;
  color: var(--bento-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── Dark mode ───────────────────────────────── */
@media (prefers-color-scheme: dark) {
  :host {
    --bento-bg:     var(--primary-background-color, #0a0a0f);
    --bento-bg-2:   var(--card-background-color,    #111119);
    --bento-card:   var(--card-background-color,    #16161f);
    --bento-glass:  rgba(22, 22, 31, 0.7);
    --bento-border: var(--divider-color,            #27272f);
    --bento-border-strong: rgba(255, 255, 255, 0.08);
    --bento-text:           var(--primary-text-color,   #fafaf9);
    --bento-text-secondary: var(--secondary-text-color, #d6d3d1);
    --bento-text-muted:     var(--disabled-text-color,  #78716c);
    --bento-primary:        #818cf8;
    --bento-primary-2:      #a78bfa;
    --bento-primary-3:      #f472b6;
    --bento-primary-light:  rgba(129, 140, 248, 0.12);
    --bento-primary-glow:   rgba(129, 140, 248, 0.45);
    --bento-success: #34d399;
    --bento-success-light:  rgba(52, 211, 153, 0.12);
    --bento-success-border: rgba(52, 211, 153, 0.30);
    --bento-error:   #f87171;
    --bento-error-light:    rgba(248, 113, 113, 0.12);
    --bento-error-border:   rgba(248, 113, 113, 0.30);
    --bento-warning: #fbbf24;
    --bento-warning-light:  rgba(251, 191, 36, 0.12);
    --bento-warning-border: rgba(251, 191, 36, 0.30);
    --bento-info:    #22d3ee;
    --bento-info-light:     rgba(34, 211, 238, 0.12);
    --bento-info-border:    rgba(34, 211, 238, 0.30);
    --bento-shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
    --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.2);
    --bento-shadow-lg: 0 24px 48px -12px rgba(0,0,0,0.6), 0 12px 24px -8px rgba(0,0,0,0.3);
    --bento-shadow-glow: 0 0 0 1px rgba(129,140,248,0.2), 0 8px 32px -8px rgba(129,140,248,0.5);
    --bento-grad-primary: linear-gradient(135deg, #818cf8, #a78bfa);
    --bento-grad-rainbow: linear-gradient(135deg, #818cf8, #a78bfa 50%, #f472b6);
    color-scheme: dark !important;
  }
  .card, .card-container, .main-card, .panel-card {
    background: var(--bento-card) !important; color: var(--bento-text) !important; border-color: var(--bento-border) !important;
  }
  input, select, textarea { background: var(--bento-bg-2); color: var(--bento-text); border-color: var(--bento-border); }
  table th { background: var(--bento-bg-2); color: var(--bento-text-secondary); border-color: var(--bento-border); }
  table td { color: var(--bento-text); border-color: var(--bento-border); }
  pre, code { background: #1e1e2e !important; color: #e2e8f0 !important; }
}

/* ── Reset & motion preferences ──────────────── */
* { box-sizing: border-box; }
@media (prefers-reduced-motion: reduce) { * { animation-duration: 0s !important; transition-duration: 0s !important; } }

/* ── Main Card Wrapper ───────────────────────── */
.card {
  background: var(--bento-card);
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-md);
  box-shadow: var(--bento-shadow-md);
  color: var(--bento-text);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
  position: relative;
  transition: box-shadow var(--bento-trans), border-color var(--bento-trans);
}

/* ── Header ──────────────────────────────────── */
.header {
  padding: 20px 24px 0;
  display: flex; align-items: center; gap: 12px;
}
.header-icon { font-size: 24px; }
.header-title {
  font-size: 18px; font-weight: 700; letter-spacing: -0.02em;
  color: var(--bento-text);
}
.header-badge {
  margin-left: auto;
  background: var(--bento-grad-primary); color: #fff;
  font-size: 11px; padding: 4px 10px; border-radius: var(--bento-radius-pill);
  font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
  box-shadow: 0 4px 14px -2px var(--bento-primary-glow);
}
.content { padding: 20px 24px 24px; }

/* ── Tabs (modern pill style) ────────────────── */
.tabs, .tab-bar, .tab-nav, .tab-header {
  display: flex !important; gap: 4px !important;
  padding: 4px !important;
  background: var(--bento-bg-2) !important;
  border-radius: var(--bento-radius-pill) !important;
  margin-bottom: 20px !important;
  overflow-x: auto !important; overflow-y: hidden !important;
  -webkit-overflow-scrolling: touch !important;
  flex-wrap: nowrap !important; border-bottom: 0 !important;
  width: fit-content; max-width: 100%;
}
.tab, .tab-btn, .tab-button, .dtab {
  padding: 8px 16px !important;
  border: none !important; background: transparent !important; cursor: pointer !important;
  font-size: 13px !important; font-weight: 600 !important;
  font-family: "Inter", sans-serif !important;
  color: var(--bento-text-secondary) !important;
  border-radius: var(--bento-radius-pill) !important;
  margin-bottom: 0 !important;
  transition: all var(--bento-trans) !important;
  white-space: nowrap !important; flex: none !important;
  letter-spacing: -0.005em !important;
}
.tab:hover, .tab-btn:hover, .tab-button:hover, .dtab:hover {
  color: var(--bento-text) !important;
  background: var(--bento-card) !important;
}
.tab.active, .tab-btn.active, .tab-button.active, .dtab.active {
  background: var(--bento-card) !important;
  color: var(--bento-primary) !important;
  box-shadow: var(--bento-shadow-sm) !important;
  font-weight: 700 !important;
}
.tab-content { display: block; }
.tab-content.active { animation: bentoFadeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
@keyframes bentoFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Stat / KPI cards (premium) ──────────────── */
.stat-card, .stat-item, .metric-card, .kpi-card {
  background: var(--bento-bg-2) !important;
  border: 1px solid var(--bento-border) !important;
  border-radius: var(--bento-radius-sm) !important;
  padding: 18px !important;
  text-align: left !important;
  transition: transform var(--bento-trans), box-shadow var(--bento-trans), border-color var(--bento-trans);
  position: relative; overflow: hidden;
}
.stat-card::before, .metric-card::before, .kpi-card::before {
  content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--bento-grad-primary);
  opacity: 0; transition: opacity var(--bento-trans);
}
.stat-card:hover, .stat-item:hover, .metric-card:hover, .kpi-card:hover {
  transform: translateY(-2px); box-shadow: var(--bento-shadow-lg); border-color: var(--bento-primary-light);
}
.stat-card:hover::before, .metric-card:hover::before, .kpi-card:hover::before { opacity: 1; }
.stat-icon { font-size: 22px; margin-bottom: 6px; opacity: 0.85; }
.stat-value, .stat-val, .metric-value, .kpi-val {
  font-size: 26px; font-weight: 800; line-height: 1.1;
  letter-spacing: -0.02em; color: var(--bento-text);
  font-feature-settings: "tnum" 1;
}
.stat-label, .stat-lbl, .metric-label, .kpi-lbl {
  font-size: 11px; color: var(--bento-text-secondary);
  margin-top: 4px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;
}
.stat-num {
  font-size: 24px; font-weight: 800; color: var(--bento-primary);
  font-feature-settings: "tnum" 1; letter-spacing: -0.02em;
}
.stat-sub { font-size: 12px; color: var(--bento-text-muted); font-weight: 500; }

/* ── Overview grid ───────────────────────────── */
.overview-grid, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px; margin-bottom: 20px;
}

/* ── Section headers ─────────────────────────── */
.section-header, .section-title {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12px; font-weight: 700; color: var(--bento-text-secondary);
  text-transform: uppercase; letter-spacing: 0.08em;
  margin: 16px 0 10px;
}
.section-header::before, .section-title::before {
  content: ""; width: 4px; height: 4px; border-radius: 50%; background: var(--bento-primary);
  margin-right: 8px; flex-shrink: 0;
}

/* ── Loading / Empty / Info ──────────────────── */
.loading-bar {
  height: 3px; border-radius: var(--bento-radius-pill);
  background: linear-gradient(90deg, var(--bento-primary), var(--bento-primary-2), transparent);
  background-size: 200% 100%;
  animation: bentoLoad 1.5s linear infinite; margin-bottom: 12px;
}
@keyframes bentoLoad { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.empty-state, .no-data, .no-results {
  text-align: center; color: var(--bento-text-secondary);
  padding: 40px 20px; font-size: 14px;
  background: var(--bento-bg-2); border-radius: var(--bento-radius-md);
  border: 1px dashed var(--bento-border);
}
.info-note, .tip-box {
  font-size: 13px; color: var(--bento-text-secondary);
  background: var(--bento-primary-light);
  border-radius: var(--bento-radius-sm); padding: 12px 14px;
  border-left: 3px solid var(--bento-primary); margin-top: 12px;
  line-height: 1.55;
}
.last-updated {
  font-size: 11px; color: var(--bento-text-muted);
  text-align: right; margin-top: 12px; font-feature-settings: "tnum" 1;
}

/* ── Buttons (premium) ───────────────────────── */
.refresh-btn {
  background: var(--bento-bg-2); border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-pill); padding: 6px 14px;
  font-size: 12px; color: var(--bento-text-secondary);
  cursor: pointer; font-weight: 600; transition: all var(--bento-trans);
  font-family: "Inter", sans-serif;
}
.refresh-btn:hover {
  background: var(--bento-card); color: var(--bento-primary);
  border-color: var(--bento-primary); transform: translateY(-1px);
  box-shadow: var(--bento-shadow-sm);
}
.toggle-btn, .action-btn {
  background: var(--bento-grad-primary); border: none;
  border-radius: var(--bento-radius-xs); padding: 8px 16px;
  font-size: 13px; color: #fff; cursor: pointer; font-weight: 600;
  transition: all var(--bento-trans); font-family: "Inter", sans-serif;
  letter-spacing: -0.005em;
  box-shadow: 0 4px 12px -2px var(--bento-primary-glow);
}
.toggle-btn:hover, .action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px -4px var(--bento-primary-glow);
}
.send-btn, .btn-primary {
  width: 100%;
  background: var(--bento-grad-primary); color: #fff;
  border: none; border-radius: var(--bento-radius-sm);
  padding: 12px 20px; font-size: 14px; font-weight: 700;
  cursor: pointer; font-family: "Inter", sans-serif;
  letter-spacing: -0.01em;
  transition: all var(--bento-trans);
  box-shadow: 0 4px 14px -2px var(--bento-primary-glow);
}
.send-btn:hover, .btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px -6px var(--bento-primary-glow);
}
.send-btn:active, .btn-primary:active { transform: translateY(0); }
.send-btn:disabled, .btn-primary:disabled {
  opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none;
}

/* ── Badges / Status (modern pill) ───────────── */
.badge, .status-badge, .tag, .chip {
  padding: 4px 12px; border-radius: var(--bento-radius-pill);
  font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;
  letter-spacing: 0.04em; text-transform: uppercase;
  border: 1px solid;
}
.badge-ok, .badge-success { background: var(--bento-success-light); color: var(--bento-success); border-color: var(--bento-success-border); }
.badge-er, .badge-error   { background: var(--bento-error-light);   color: var(--bento-error);   border-color: var(--bento-error-border); }
.badge-warn, .badge-warning { background: var(--bento-warning-light); color: var(--bento-warning); border-color: var(--bento-warning-border); }
.badge-info { background: var(--bento-info-light); color: var(--bento-info); border-color: var(--bento-info-border); }

.count-badge {
  font-size: 11px; font-weight: 700; padding: 3px 10px;
  border-radius: var(--bento-radius-pill); display: inline-flex; align-items: center;
  font-feature-settings: "tnum" 1;
}
.error-badge { background: var(--bento-error-light); color: var(--bento-error); border: 1px solid var(--bento-error-border); }
.warn-badge  { background: var(--bento-warning-light); color: var(--bento-warning); border: 1px solid var(--bento-warning-border); }
.info-badge  { background: var(--bento-primary-light); color: var(--bento-primary); border: 1px solid var(--bento-border); }
.ok-badge    { background: var(--bento-success-light); color: var(--bento-success); border: 1px solid var(--bento-success-border); }

/* ── Tables (modern) ─────────────────────────── */
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th {
  background: var(--bento-bg-2); color: var(--bento-text-secondary);
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  padding: 12px 16px; text-align: left;
  border-bottom: 1px solid var(--bento-border);
}
th:first-child { border-top-left-radius: var(--bento-radius-sm); }
th:last-child  { border-top-right-radius: var(--bento-radius-sm); }
td {
  padding: 14px 16px; border-bottom: 1px solid var(--bento-border);
  color: var(--bento-text); font-size: 13px;
}
tr { transition: background var(--bento-trans-fast); }
tr:hover td { background: var(--bento-primary-light); }
tr:last-child td { border-bottom: 0; }

/* ── Forms / Inputs ──────────────────────────── */
input, select, textarea {
  padding: 10px 14px; border: 1.5px solid var(--bento-border);
  border-radius: var(--bento-radius-xs);
  background: var(--bento-card); color: var(--bento-text);
  font-size: 14px; font-family: "Inter", sans-serif;
  transition: all var(--bento-trans); outline: none;
  letter-spacing: -0.005em;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--bento-primary);
  box-shadow: 0 0 0 4px var(--bento-primary-light);
}
input::placeholder, textarea::placeholder { color: var(--bento-text-muted); }

/* ── Code blocks ─────────────────────────────── */
code {
  background: var(--bento-bg-2); padding: 2px 6px;
  border-radius: 4px; font-size: 12px;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  border: 1px solid var(--bento-border);
}
pre {
  background: #1e1e2e; color: #e2e8f0;
  padding: 16px; border-radius: var(--bento-radius-sm);
  font-size: 12.5px; overflow-x: auto; line-height: 1.65;
  white-space: pre-wrap; word-break: break-word;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  box-shadow: var(--bento-shadow-md);
}

/* ── Grid layouts ────────────────────────────── */
.schedule-grid, .send-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}
.schedule-card, .send-card, .info-card {
  background: var(--bento-bg-2); border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-sm); padding: 16px;
  transition: all var(--bento-trans);
}
.schedule-card:hover, .send-card:hover, .info-card:hover {
  border-color: var(--bento-primary-light); transform: translateY(-1px);
  box-shadow: var(--bento-shadow-md);
}

/* ── Log entries ─────────────────────────────── */
.log-entry {
  display: flex; flex-wrap: wrap; align-items: flex-start;
  gap: 4px 8px; padding: 10px 12px;
  border-radius: var(--bento-radius-sm); margin-bottom: 6px;
  font-size: 12.5px; min-width: 0; overflow: hidden;
  border: 1px solid transparent; transition: all var(--bento-trans-fast);
}
.error-entry { background: var(--bento-error-light); border-color: var(--bento-error-border); }
.warn-entry  { background: var(--bento-warning-light); border-color: var(--bento-warning-border); }
.log-time { color: var(--bento-text-muted); font-feature-settings: "tnum" 1; flex-shrink: 0; font-family: "JetBrains Mono", monospace; }
.log-domain {
  font-weight: 700; flex-shrink: 1; min-width: 0; max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; word-break: break-all;
}
.error-domain { color: var(--bento-error); }
.warn-domain  { color: var(--bento-warning); }
.log-msg {
  color: var(--bento-text-secondary); flex-basis: 100%;
  word-break: break-word; overflow-wrap: anywhere;
  white-space: pre-wrap; min-width: 0; line-height: 1.55;
}

/* ── Send status ─────────────────────────────── */
.send-status {
  padding: 12px 16px; border-radius: var(--bento-radius-sm);
  margin-top: 14px; font-size: 13px; font-weight: 600;
  text-align: center; letter-spacing: -0.005em;
  border: 1px solid;
}
.send-status.sending { background: var(--bento-primary-light); color: var(--bento-primary); border-color: var(--bento-border); }
.send-status.success { background: var(--bento-success-light); color: var(--bento-success); border-color: var(--bento-success-border); }
.send-status.error   { background: var(--bento-error-light);   color: var(--bento-error);   border-color: var(--bento-error-border); }

/* ── Scrollbar ───────────────────────────────── */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: var(--bento-radius-pill); border: 2px solid transparent; background-clip: content-box; }
::-webkit-scrollbar-thumb:hover { background: var(--bento-text-muted); background-clip: content-box; }

/* ── Animations ──────────────────────────────── */
@keyframes bentoSpin  { to { transform: rotate(360deg); } }
@keyframes bentoPulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
@keyframes bentoSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes bentoStaggerIn { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

/* Apply stagger to grids of stat-cards */
.stats-grid > *, .overview-grid > *, .summary-grid > * {
  animation: bentoStaggerIn 0.35s cubic-bezier(0.4, 0, 0.2, 1) both;
}
.stats-grid > *:nth-child(1)  { animation-delay: 0.02s; }
.stats-grid > *:nth-child(2)  { animation-delay: 0.06s; }
.stats-grid > *:nth-child(3)  { animation-delay: 0.10s; }
.stats-grid > *:nth-child(4)  { animation-delay: 0.14s; }
.stats-grid > *:nth-child(5)  { animation-delay: 0.18s; }
.stats-grid > *:nth-child(6)  { animation-delay: 0.22s; }

/* ── Mobile — 768 px ─────────────────────────── */
@media (max-width: 768px) {
  .content { padding: 16px; }
  .header { padding: 16px 16px 0; }
  .tabs { gap: 2px !important; padding: 3px !important; }
  .tab, .tab-button, .tab-btn { padding: 6px 12px !important; font-size: 12px !important; }
  .overview-grid, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid {
    grid-template-columns: repeat(2, 1fr); gap: 10px;
  }
  .stat-value, .stat-val, .kpi-val, .metric-val { font-size: 22px; }
  .stat-label, .stat-lbl, .kpi-lbl, .metric-lbl { font-size: 10px; }
  .send-grid, .schedule-grid { grid-template-columns: 1fr; }
  .log-entry { flex-wrap: wrap; gap: 2px 6px; padding: 8px 10px; }
  .log-domain { max-width: 60%; font-size: 11.5px; }
  .log-msg { flex-basis: 100%; max-width: 100%; font-size: 11.5px; }
  pre { padding: 12px; font-size: 11.5px; }
  h2 { font-size: 18px; }
  h3 { font-size: 15px; }
  table { font-size: 12.5px; }
  th, td { padding: 10px 12px; }
}
@media (max-width: 480px) {
  .tabs { gap: 1px !important; padding: 2px !important; }
  .tab, .tab-button, .tab-btn { padding: 5px 10px !important; font-size: 11px !important; }
  .overview-grid, .stats-grid, .summary-grid { grid-template-columns: 1fr 1fr; }
  .stat-value, .stat-val, .kpi-val { font-size: 18px; }
}
`;
}
// XSS escape singleton (idempotent)
if (typeof window !== 'undefined') {
  window._haToolsEsc = window._haToolsEsc || (function(){
    var MAP = {};
    MAP[String.fromCharCode(38)] = '&amp;';
    MAP[String.fromCharCode(60)] = '&lt;';
    MAP[String.fromCharCode(62)] = '&gt;';
    MAP[String.fromCharCode(34)] = '&quot;';
    MAP[String.fromCharCode(39)] = '&#39;';
    return function(s){ return typeof s === 'string' ? s.replace(/[&<>"']/g, function(c){ return MAP[c]; }) : (s == null ? '' : s); };
  })();
}
// Universal donate footer injector — guarantees the support box appears
// on every split-tool card regardless of internal render state.
if (typeof window !== 'undefined' && !window.__haToolsSplitDonateInjector) {
  window.__haToolsSplitDonateInjector = true;
  var SPLIT_TAGS = ['ha-purge-cache','ha-yaml-checker','ha-data-exporter','ha-baby-tracker','ha-chore-tracker','ha-energy-optimizer','ha-energy-insights','ha-energy-email','ha-log-email','ha-smart-reports','ha-network-map','ha-trace-viewer','ha-automation-analyzer','ha-storage-monitor','ha-backup-manager','ha-security-check','ha-device-health','ha-sentence-manager','ha-encoding-fixer','ha-entity-renamer','ha-frigate-privacy','ha-vacuum-water-monitor'];
  var DONATE_HTML = ''
    + '<div class="donate-section" data-source="ha-tools-split-injector">'
    + '  <div class="donate-text">'
    + '    <h3>❤️ Support HA Tools Development</h3>'
    + '    <p>If this tool makes your Home Assistant life easier, consider supporting the project. Every coffee motivates further development!</p>'
    + '  </div>'
    + '  <div class="donate-buttons">'
    + '    <a class="donate-btn coffee" href="https://buymeacoffee.com/macsiem" target="_blank" rel="noopener noreferrer">☕ Buy Me a Coffee</a>'
    + '    <a class="donate-btn paypal" href="https://www.paypal.com/donate/?hosted_button_id=Y967H4PLRBN8W" target="_blank" rel="noopener noreferrer">💳 PayPal</a>'
    + '  </div>'
    + '</div>';
  function deepFindAll(tag, root) {
    var out = [];
    (function walk(node){
      if (!node || !node.querySelectorAll) return;
      var children = node.querySelectorAll('*');
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c.tagName && c.tagName.toLowerCase() === tag) out.push(c);
        if (c.shadowRoot) walk(c.shadowRoot);
      }
    })(root || document);
    return out;
  }
  // Per-tool prerequisite check + inline install banner
  var PREREQS = {
    'ha-energy-email': { service: 'ha_tools_email', repo: 'ha-tools-email-integration', label: 'HA Tools Email integration', kind: 'integration' },
    'ha-log-email':    { service: 'ha_tools_email', repo: 'ha-tools-email-integration', label: 'HA Tools Email integration', kind: 'integration' },
    'ha-encoding-fixer': { shellCommand: 'fix_encoding', label: 'shell_command.fix_encoding (optional advanced feature)', kind: 'shell_command_optional' }
  };
  // Per-tool first-run intro banner (one-line scope + 3 use cases)
  var INTROS = {
    'ha-yaml-checker': { headline: 'Validate Home Assistant YAML configuration on demand.', steps: ['Click \'Check HA Configuration\' to run homeassistant.check_config.', 'Switch to \'Encje\' tab to search entities by domain.', 'Use \'Template\' tab to preview Jinja2 templates.'] },
    'ha-data-exporter': { headline: 'Browse, filter, and export Home Assistant entity data.', steps: ['Filter by domain or search entities live.', 'Take a snapshot or export selection to CSV / JSON.', 'Privacy warning before downloading attributes with sensitive data.'] },
    'ha-chore-tracker': { headline: 'Household chore tracker with kanban + recurring schedules.', steps: ['Add a chore: name + assignee + frequency.', 'Drag from \'Todo\' to \'Done\' to mark complete.', 'Stats tab shows counts per assignee.'] },
    'ha-energy-optimizer': { headline: 'Tariff-aware energy usage with hourly heatmaps + tips.', steps: ['Today / Yesterday / 7-day / 30-day usage and cost.', 'Patterns tab — hourly heatmap of consumption.', 'Recommendations tab — auto-generated tips.'] },
    'ha-energy-insights': { headline: 'Daily / weekly / monthly energy charts + top consumers.', steps: ['Switch view tabs to see consumption over time.', 'Top devices ranked by kWh.', 'Tips tab with energy-saving suggestions.'] },
    'ha-energy-email': { headline: 'Energy reports delivered by email via ha_tools_email.', steps: ['Click \'Send Now\' to email the current snapshot.', 'Schedule daily / weekly / monthly delivery.', 'Configure SMTP in the Schedule tab (one-time).'] },
    'ha-log-email': { headline: 'Daily error / warning digests delivered by email.', steps: ['Click \'Send Now\' to email the current digest.', 'Schedule daily delivery + threshold (e.g. \u22653 errors).', 'Requires ha-tools-email-integration.'] },
    'ha-smart-reports': { headline: 'Aggregate weekly / monthly reports — energy + automations + state changes.', steps: ['Weekly summary card on Overview.', 'Drill down by Energy / Automations / System sub-tabs.', 'Privacy-safe view strips entity names before sharing.'] },
    'ha-network-map': { headline: 'Visualise the network around HA — devices, topology, MAC bindings.', steps: ['Devices tab — table of all known devices.', 'Topology tab — graph view of the network.', 'Click \'Rescan\' to ping the local subnet (user-initiated).'] },
    'ha-trace-viewer': { headline: 'Step through HA automation traces with a flow graph.', steps: ['Pick automation in sidebar to see latest 5 traces.', 'Click trace for full path through triggers / conditions / actions.', 'Export trace as JSON for offline debug.'] },
    'ha-automation-analyzer': { headline: 'Surface slow / failing / suspicious automations.', steps: ['Overview shows total + health score + top failing.', 'Performance tab ranks by avg runtime.', 'Optimization tab suggests improvements (loops, redundant triggers).'] },
    'ha-storage-monitor': { headline: 'Disk + recorder DB + add-on storage breakdown.', steps: ['Overview shows used / free + per-category breakdown.', 'Backups tab — count + size warning.', 'Cleanup tab — actionable suggestions.'] },
    'ha-backup-manager': { headline: 'Create + list + inspect HA backups.', steps: ['List existing backups (date / size / encryption).', 'Click \'Create backup now\' to invoke backup.create.', 'Restore selected backup.'] },
    'ha-security-check': { headline: 'Security audit + remediation tips.', steps: ['Overview shows score (X/100) + letter grade.', 'Click warning row for step-by-step remediation.', 'Tips tab — checklist of best practices.'] },
    'ha-device-health': { headline: 'Device battery / signal / last-seen health.', steps: ['List devices grouped by health (OK / Warning / Critical).', 'Filter by low battery (<20%) or weak signal.', 'Click device for model / manufacturer / last seen.'] },
    'ha-encoding-fixer': { headline: 'Detect + fix UTF-8 / mojibake issues across HA.', steps: ['Click \'Scan\' to walk entity registry + states.', 'Per-entity \'Fix\' button calls homeassistant.reload.', 'Optional: deep file scan via shell_command (see README).'] },
    'ha-entity-renamer': { headline: 'Bulk-rename HA entities + friendly names.', steps: ['Pick an entity, set new ID — entity_registry/update.', 'Bulk pattern: sensor.old_* \u2192 sensor.new_*.', 'Optional: rewrite Lovelace dashboard refs.'] },
    'ha-frigate-privacy': { headline: 'One-click Frigate privacy mode (pause detection / recording / snapshots).', steps: ['Click \'Pause 15 min\' for instant privacy.', 'Schedules tab — daily privacy window (e.g. 22:00\u201306:00).', 'Resume at any time to re-enable cameras.'] }
  };
  var PREREQ_HTML_CACHE = {};
  function buildPrereqBanner(tag, prereq, hass) {
    if (PREREQ_HTML_CACHE[tag]) return PREREQ_HTML_CACHE[tag];
    var html = '';
    if (prereq.kind === 'integration') {
      html = '<div class="prereq-banner prereq-error" data-prereq="' + tag + '">' +
        '<div class="prereq-icon">⚠️</div>' +
        '<div class="prereq-text">' +
          '<strong>This tool requires the ' + prereq.label + '</strong><br>' +
          'Install it from HACS: <code>https://github.com/MacSiem/' + prereq.repo + '</code> ' +
          '(Category: <strong>Integration</strong>) — then add <code>' + prereq.service + ':</code> to your <code>configuration.yaml</code> and restart HA.' +
        '</div>' +
        '<a class="prereq-cta" href="https://github.com/MacSiem/' + prereq.repo + '" target="_blank" rel="noopener noreferrer">Open install guide ↗</a>' +
      '</div>';
    } else if (prereq.kind === 'shell_command_optional') {
      html = '<div class="prereq-banner prereq-info" data-prereq="' + tag + '">' +
        '<div class="prereq-icon">💡</div>' +
        '<div class="prereq-text">' +
          '<strong>Optional advanced feature: deep file scan</strong><br>' +
          'To enable scanning of <code>configuration.yaml</code> files, install the bundled <code>encoding_scanner.py</code> + add <code>shell_command:</code> entries. See README.' +
        '</div>' +
      '</div>';
    }
    PREREQ_HTML_CACHE[tag] = html;
    return html;
  }
  function buildIntroBanner(tag, intro) {
    var stepsHtml = intro.steps.map(function(s){ return '<li>' + s + '</li>'; }).join('');
    return '<div class="intro-banner" data-intro="' + tag + '">' +
      '<button class="intro-dismiss" type="button" title="Dismiss" aria-label="Dismiss">✕</button>' +
      '<div class="intro-headline">💡 ' + intro.headline + '</div>' +
      '<ol class="intro-steps">' + stepsHtml + '</ol>' +
    '</div>';
  }
  function introDismissed(tag) {
    try { return localStorage.getItem('ha-intro-dismissed-' + tag) === '1'; } catch(e) { return false; }
  }
  function dismissIntro(tag, el) {
    try { localStorage.setItem('ha-intro-dismissed-' + tag, '1'); } catch(e) {}
    var node = el.shadowRoot && el.shadowRoot.querySelector('.intro-banner[data-intro="' + tag + '"]');
    if (node) node.remove();
  }
  function injectAll() {
    SPLIT_TAGS.forEach(function(tag){
      deepFindAll(tag).forEach(function(el){
        // panel_custom auto-init: HA assigns hass/panel/narrow but does not always call setConfig.
        if (typeof el.setConfig === 'function' && !el.config && !el._config) {
          try { el.setConfig({ type: 'custom:' + tag, title: tag }); } catch(e) {}
        }
        if (!el.shadowRoot) return;
        // 0) First-run intro banner (skip if tool has its own native tip)
        var intro = INTROS[tag];
        if (intro && !introDismissed(tag)) {
          var hasOwnTip = el.shadowRoot.querySelector('#tip-banner, .tip-banner');
          var injectedIntro = el.shadowRoot.querySelector('.intro-banner[data-intro="' + tag + '"]');
          if (!hasOwnTip && !injectedIntro) {
            var topCard = el.shadowRoot.querySelector('.card, .card-container, .main-card, [class$="-card"]') || el.shadowRoot.firstElementChild;
            if (topCard) {
              try {
                topCard.insertAdjacentHTML('afterbegin', buildIntroBanner(tag, intro));
                var btn = el.shadowRoot.querySelector('.intro-banner[data-intro="' + tag + '"] .intro-dismiss');
                if (btn) btn.addEventListener('click', function(ev){ ev.stopPropagation(); dismissIntro(tag, el); });
              } catch(e) {}
            }
          }
        }
        // 1) Prereq banner — checked every poll so it disappears when prereq becomes available
        var prereq = PREREQS[tag];
        if (prereq && el._hass) {
          var hassReady = !!el._hass;
          var present = true;
          if (prereq.service) present = !!(el._hass.services && el._hass.services[prereq.service]);
          if (prereq.shellCommand) present = !!(el._hass.services && el._hass.services.shell_command && el._hass.services.shell_command[prereq.shellCommand]);
          var existing = el.shadowRoot.querySelector('.prereq-banner[data-prereq="' + tag + '"]');
          if (!present && hassReady) {
            if (!existing) {
              var top = el.shadowRoot.querySelector('.card, .card-container, .main-card, [class$="-card"]') || el.shadowRoot.firstElementChild || el.shadowRoot;
              try { top.insertAdjacentHTML('afterbegin', buildPrereqBanner(tag, prereq, el._hass)); } catch(e) {}
            }
          } else if (present && existing) {
            existing.remove();
          }
        }
        // 2) Donate footer
        if (el.shadowRoot.querySelector('.donate-section')) return;
        var target = el.shadowRoot.querySelector('.card, .card-container, .main-card, [class$="-card"]') || el.shadowRoot.firstElementChild || el.shadowRoot;
        try { target.insertAdjacentHTML('beforeend', DONATE_HTML); } catch(e) {}
      });
    });
  }
  // Run immediately, then aggressive MutationObserver for late mounts + view switches.
  injectAll();
  setTimeout(injectAll, 250);
  setTimeout(injectAll, 1000);
  setTimeout(injectAll, 3000);
  // MutationObserver catches every new node anywhere in the DOM, including shadow root attachments
  // that are deferred until the user navigates to a view.
  try {
    var obs = new MutationObserver(function(muts){
      // Debounce: schedule a microtask injection
      if (window.__haToolsDonateScheduled) return;
      window.__haToolsDonateScheduled = true;
      setTimeout(function(){ window.__haToolsDonateScheduled = false; injectAll(); }, 100);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  } catch(e) {}
  // Also re-inject on hash/path change (Lovelace view switches)
  window.addEventListener('hashchange', function(){ setTimeout(injectAll, 200); });
  window.addEventListener('popstate', function(){ setTimeout(injectAll, 200); });
  // Backup interval (every 3s for first 5min — handles cases where MutationObserver missed events)
  var pollCount = 0;
  var pollInterval = setInterval(function(){
    injectAll();
    if (++pollCount >= 100) clearInterval(pollInterval);
  }, 3000);
}
/* ============================================================ */

class HATraceViewer extends HTMLElement {
  constructor() {
    super();
    this._lang = (navigator.language || '').startsWith('pl') ? 'pl' : 'en';
    this.attachShadow({ mode: 'open' });
    this.config = {};
    this._hass = null;

    // View state
    this.viewMode = 'automations'; // 'automations' | 'all-traces'
    this.groupBy = 'automation'; // 'automation' | 'result' | 'trigger'
    this.selectedAutomation = null;
    this.selectedTrace = null;
    this.traceDetail = null;
    this.detailTab = 'timeline'; // 'timeline' | 'json' | 'changes' | 'config' | 'related'

    // Data
    this.automations = [];
    this._rawAutomations = [];
    this.traces = [];
    this._allTraces = [];
    this._traceMap = {};
    this._allFlatTraces = [];

    // Filters
    this.sortBy = 'last_triggered';
    this.filterStatus = 'all';
    this.searchQuery = '';
    this.traceFilterResult = 'all';

    // Time filter
    this.timeRange = 'all';
    this.customTimeFrom = null;
    this.customTimeTo = null;

    // Multi-select for export
    this.selectedTraceIds = new Set();
    this.selectedAutoIds = new Set();
    this.selectMode = false;
    this.tracePage = 0;
    this.tracePageSize = this._loadPageSize();

    // Automation list pagination
    this.autoPage = 0;
    this.autoPageSize = this._loadSetting('autoPageSize', 15);

    // Trace persistence
    this._storedTraces = this._loadStoredTraces();
    this._storedDetails = this._loadStoredDetails();

    // Auto-refresh
    this.relativeTimeUpdater = null;

    // Restore user settings
    this._restoreSettings();
  }

  _loadPageSize() {
    try {
      const s = localStorage.getItem('ha-tools-settings');
      if (s) { const p = JSON.parse(s); if (p['trace-viewer.pageSize']) return parseInt(p['trace-viewer.pageSize']); }
      const tv = localStorage.getItem('ha-tools-trace-viewer-pageSize');
      if (tv) return parseInt(tv);
    } catch {}
    return 15;
  }

  _savePageSize(size) {
    try { localStorage.setItem('ha-tools-trace-viewer-pageSize', String(size)); } catch {}
    try {
      const s = localStorage.getItem('ha-tools-settings');
      const settings = s ? JSON.parse(s) : {};
      settings['trace-viewer.pageSize'] = size;
      localStorage.setItem('ha-tools-settings', JSON.stringify(settings));
    } catch {}
  }

  _sanitize(s) { try { return decodeURIComponent(escape(s)); } catch(e) { return s; } }

  // ============================================================

  _loadSetting(key, fallback) {
    try {
      const s = localStorage.getItem('ha-tools-settings');
      if (s) { const p = JSON.parse(s); if (p['trace-viewer.' + key] !== undefined) return p['trace-viewer.' + key]; }
      const v = localStorage.getItem('ha-tools-trace-viewer-' + key);
      if (v !== null) return JSON.parse(v);
    } catch {}
    return fallback;
  }

  _saveSetting(key, value) {
    try {
      const s = localStorage.getItem('ha-tools-settings');
      const settings = s ? JSON.parse(s) : {};
      settings['trace-viewer.' + key] = value;
      localStorage.setItem('ha-tools-settings', JSON.stringify(settings));
    } catch {}
  }

  _restoreSettings() {
    this.viewMode = this._loadSetting('viewMode', 'automations');
    this.sortBy = this._loadSetting('sortBy', 'last_triggered');
    this.filterStatus = this._loadSetting('filterStatus', 'all');
    this.groupBy = this._loadSetting('groupBy', 'automation');
    this.timeRange = this._loadSetting('timeRange', 'all');
    this.traceFilterResult = this._loadSetting('traceFilterResult', 'all');
  }

  _saveCurrentSettings() {
    this._saveSetting('viewMode', this.viewMode);
    this._saveSetting('sortBy', this.sortBy);
    this._saveSetting('filterStatus', this.filterStatus);
    this._saveSetting('groupBy', this.groupBy);
    this._saveSetting('timeRange', this.timeRange);
    this._saveSetting('traceFilterResult', this.traceFilterResult);
  }

  // ============================================================

  _loadStoredTraces() {
    try {
      const d = localStorage.getItem('ha-tools-trace-viewer-stored');
      if (d) {
        const parsed = JSON.parse(d);
        const map = {};
        for (const t of parsed) { map[t.item_id + '::' + t.run_id] = t; }
        return map;
      }
    } catch {}
    return {};
  }

  _saveStoredTraces() {
    try {
      const arr = Object.values(this._storedTraces);
      arr.sort((a, b) => {
        const ta = a.timestamp?.start || '';
        const tb = b.timestamp?.start || '';
        return tb.localeCompare(ta);
      });
      const trimmed = arr.slice(0, 2000);
      localStorage.setItem('ha-tools-trace-viewer-stored', JSON.stringify(trimmed));
    } catch (e) {
      console.warn('[Trace Viewer] Could not save traces:', e);
    }
  }

  _loadStoredDetails() {
    try {
      const d = localStorage.getItem('ha-tools-trace-viewer-details');
      return d ? JSON.parse(d) : {};
    } catch {}
    return {};
  }

  _saveStoredDetails() {
    try {
      const keys = Object.keys(this._storedDetails);
      if (keys.length > 200) {
        const sorted = keys.sort();
        sorted.slice(0, keys.length - 200).forEach(k => delete this._storedDetails[k]);
      }
      localStorage.setItem('ha-tools-trace-viewer-details', JSON.stringify(this._storedDetails));
    } catch (e) {
      console.warn('[Trace Viewer] Could not save details:', e);
    }
  }

  _mergeAndStoreTraces(liveTraces) {
    for (const t of liveTraces) {
      this._storedTraces[t.item_id + '::' + t.run_id] = t;
    }
    this._saveStoredTraces();
    const merged = { ...this._storedTraces };
    for (const t of liveTraces) { merged[t.item_id + '::' + t.run_id] = t; }
    return Object.values(merged);
  }

  _getStoredTraceCount() {
    return Object.keys(this._storedTraces).length;
  }

  // ============================================================

  static get _translations() {
    return {
      en: {
        traceViewer: 'Trace Viewer', automations: 'Automations', allTraces: 'All Traces',
        traces: 'Traces', traceDetail: 'Trace Detail', timeline: 'Timeline', json: 'JSON',
        changes: 'Changes', config: 'Config', related: 'Related', flowGraph: 'Flow',
        search: 'Search automations...', searchTraces: 'Search traces...',
        noTraces: 'No traces found', noAutomations: 'No automations found',
        clickAutomationToView: 'Select an automation to view traces',
        clickTraceToView: 'Select a trace to view details',
        trigger: 'Trigger', conditions: 'Conditions', actions: 'Actions',
        status: 'Status', duration: 'Duration', ms: 'ms',
        loading: 'Loading trace detail...', error: 'Error', success: 'Success',
        running: 'Running', aborted: 'Aborted', stopped: 'Stopped',
        sortBy: 'Sort:', sortName: 'Name (A-Z)', sortLastTriggered: 'Last Triggered',
        sortTriggerCount: 'Trace Count',
        filterByStatus: 'Status:', allStatuses: 'All', statusRunning: 'On',
        statusStopped: 'Off', statusError: 'Error',
        justNow: 'Just now', minutesAgo: 'm ago', hoursAgo: 'h ago', daysAgo: 'd ago',
        groupBy: 'Group:', groupAutomation: 'Automation', groupResult: 'Result', groupTrigger: 'Trigger',
        timeRange: 'Time:', timeAll: 'All', time1h: '1h', time6h: '6h',
        time24h: '24h', time7d: '7d', time30d: '30d', timeCustom: 'Custom...',
        export: 'Export', exportJson: 'JSON', exportCsv: 'CSV',
        selectAll: 'All', selected: 'selected', refresh: 'Refresh',
        totalTraces: 'total', successRate: 'success', avgDuration: 'avg',
        changedVariables: 'Changed Variables', noChanges: 'No variable changes',
        viewMode: 'View:', byAutomation: 'By Automation', flatList: 'All Traces',
        executedAt: 'Executed:', finishedAt: 'Finished at', runtime: 'runtime',
        triggeredBy: 'Triggered by', testCondition: 'Test condition',
        performAction: 'Perform action', automationConfig: 'Automation Configuration',
        relatedActivity: 'Related Activity', noRelatedActivity: 'No related activity found',
        entityChanged: 'changed to', triggeredByAction: 'triggered by action',
        copyJson: 'Copy', copied: 'Copied!',
        selectMode: 'Select', cancel: 'Cancel',
        previousPage: 'Previous page', nextPage: 'Next page',
      },
            pl: {
        traceViewer: 'Przegl\u0105darka \u015alad\u00f3w', automations: 'Automatyzacje', allTraces: 'Wszystkie',
        traces: '\u015alady', traceDetail: 'Szczeg\u00f3\u0142y', timeline: 'O\u015b Czasowa', json: 'JSON',
        changes: 'Zmiany', config: 'Konfiguracja', related: 'Powi\u0105zane', flowGraph: 'Graf',
        search: 'Wyszukaj automatyzacje...', searchTraces: 'Wyszukaj \u015blady...',
        noTraces: 'Nie znaleziono \u015blad\u00f3w', noAutomations: 'Nie znaleziono automatyzacji',
        clickAutomationToView: 'Wybierz automatyzacj\u0119', clickTraceToView: 'Wybierz \u015blad',
        trigger: 'Wyzwalacz', conditions: 'Warunki', actions: 'Akcje',
        status: 'Status', duration: 'Czas', ms: 'ms',
        loading: '\u0141adowanie...', error: 'B\u0142\u0105d', success: 'Sukces',
        running: 'Uruchomione', aborted: 'Przerwane', stopped: 'Zatrzymane',
        sortBy: 'Sortuj:', sortName: 'Nazwa (A-Z)', sortLastTriggered: 'Ostatnie',
        sortTriggerCount: 'Liczba \u015alad\u00f3w',
        filterByStatus: 'Status:', allStatuses: 'Wszystkie', statusRunning: 'W\u0142.',
        statusStopped: 'Wy\u0142.', statusError: 'B\u0142\u0105d',
        justNow: 'Teraz', minutesAgo: 'm temu', hoursAgo: 'h temu', daysAgo: 'd temu',
        groupBy: 'Grupuj:', groupAutomation: 'Automatyzacja', groupResult: 'Rezultat', groupTrigger: 'Wyzwalacz',
        timeRange: 'Czas:', timeAll: 'Ca\u0142y', time1h: '1h', time6h: '6h',
        time24h: '24h', time7d: '7d', time30d: '30d', timeCustom: 'W\u0142asny...',
        export: 'Eksport', exportJson: 'JSON', exportCsv: 'CSV',
        selectAll: 'Wszystkie', selected: 'wybranych', refresh: 'Od\u015bwie\u017c',
        totalTraces: '\u0142\u0105cznie', successRate: 'sukces', avgDuration: '\u015brednio',
        changedVariables: 'Zmienione Zmienne', noChanges: 'Brak zmian zmiennych',
        viewMode: 'Widok:', byAutomation: 'Wg Automatyzacji', flatList: 'Wszystkie',
        executedAt: 'Wykonano:', finishedAt: 'Zako\u0144czono o', runtime: 'czas wykonania',
        triggeredBy: 'Wyzwolone przez', testCondition: 'Warunek',
        performAction: 'Wykonaj akcj\u0119', automationConfig: 'Konfiguracja Automatyzacji',
        relatedActivity: 'Powi\u0105zana Aktywno\u015b\u0107', noRelatedActivity: 'Brak powi\u0105zanej aktywno\u015bci',
        entityChanged: 'zmieniono na', triggeredByAction: 'wyzwolone przez akcj\u0119',
        copyJson: 'Kopiuj', copied: 'Skopiowano!',
        selectMode: 'Zaznacz', cancel: 'Anuluj',
        previousPage: 'Poprzednia strona', nextPage: 'Nast\u0119pna strona',
      },
    };
  }

  _t(key) {
    const lang = this._hass?.language || 'en';
    const T = HATraceViewer._translations;
    return (T[lang] || T['en'])[key] || T['en'][key] || key;
  }

  setConfig(config) { this.config = { title: 'Trace Viewer', ...config }; }

  set hass(hass) {

    if (hass?.language) this._lang = hass.language.startsWith('pl') ? 'pl' : 'en';    const firstLoad = !this._hass;
    this._hass = hass;
    if (firstLoad) {
      this._allTraces = [];
      this._traceMap = {};
      this.updateAutomationData();
    }
  }

  // ============================================================

  async updateAutomationData() {
    if (!this._hass) return;
    let liveTraces = [];
    try {
      liveTraces = await this._hass.callWS({ type: 'trace/list', domain: 'automation' });
    } catch (e) {
      console.warn('[Trace Viewer] Could not fetch traces:', e);
    }

    // Merge live traces with stored (persisted) traces
    this._allTraces = this._mergeAndStoreTraces(liveTraces);

    this._traceMap = {};
    this._allTraces.forEach(t => {
      const key = t.item_id;
      if (!this._traceMap[key]) this._traceMap[key] = { count: 0, lastRun: null, traces: [] };
      this._traceMap[key].count++;
      this._traceMap[key].traces.push(t);
      const st = t.timestamp?.start ? new Date(t.timestamp.start) : null;
      if (st && (!this._traceMap[key].lastRun || st > this._traceMap[key].lastRun)) this._traceMap[key].lastRun = st;
    });

    this._rawAutomations = Object.entries(this._hass.states)
      .filter(([e]) => e.startsWith('automation.'))
      .map(([entity, state]) => {
        const name = state.attributes?.friendly_name || entity.replace('automation.', '');
        const automationId = state.attributes?.id || null;
        const lastTriggered = state.attributes?.last_triggered ? new Date(state.attributes.last_triggered) : null;
        const traceInfo = automationId ? this._traceMap[automationId] : null;
        return {
          entity, name, automationId,
          isActive: state.state === 'on', lastTriggered,
          triggerCount: traceInfo ? traceInfo.count : 0,
          status: state.state === 'on' ? 'running' : state.state === 'off' ? 'stopped' : 'error'
        };
      });

    this._allFlatTraces = [];
    for (const t of this._allTraces) {
      const auto = this._rawAutomations.find(a => a.automationId === t.item_id);
      const st = t.timestamp?.start ? new Date(t.timestamp.start) : new Date();
      const ft = t.timestamp?.finish ? new Date(t.timestamp.finish) : st;
      this._allFlatTraces.push({
        id: t.run_id, item_id: t.item_id,
        automationEntity: auto?.entity || t.item_id,
        automationName: auto?.name || t.item_id,
        timestamp: st, finishTime: ft,
        status: this._traceStatus(t),
        duration: ft - st,
        lastStep: t.last_step || '', scriptExecution: t.script_execution || '',
        trigger: t.trigger || 'unknown', raw: t
      });
    }
    this._allFlatTraces.sort((a, b) => b.timestamp - a.timestamp);

    this.applyFiltersAndSort();
    this.render();
    this._startTimer();
  }

  _traceStatus(t) {
    if (t.state === 'stopped' && t.script_execution === 'finished') return 'success';
    if (t.state === 'stopped' && t.script_execution === 'error') return 'error';
    if (t.state === 'running') return 'running';
    if (t.script_execution === 'aborted') return 'aborted';
    if (t.script_execution === 'error' || t.script_execution === 'any_error') return 'error';
    return 'success';
  }

  // ============================================================

  _timeCutoff() {
    if (this.timeRange === 'all') return null;
    const ms = { '1h': 36e5, '6h': 216e5, '24h': 864e5, '7d': 6048e5, '30d': 2592e6 };
    if (ms[this.timeRange]) return new Date(Date.now() - ms[this.timeRange]);
    if (this.timeRange === 'custom' && this.customTimeFrom) return new Date(this.customTimeFrom);
    return null;
  }

  _timeEnd() {
    return (this.timeRange === 'custom' && this.customTimeTo) ? new Date(this.customTimeTo) : null;
  }

  _filterByTime(traces) {
    const c = this._timeCutoff(), e = this._timeEnd();
    if (!c && !e) return traces;
    return traces.filter(t => (!c || t.timestamp >= c) && (!e || t.timestamp <= e));
  }

  applyFiltersAndSort() {
    let f = [...this._rawAutomations].filter(a => {
      const ms = a.name.toLowerCase().includes(this.searchQuery.toLowerCase());
      const fs = this.filterStatus === 'all' || a.status === this.filterStatus;
      return ms && fs;
    });
    f.sort((a, b) => {
      if (this.sortBy === 'name') return a.name.localeCompare(b.name);
      if (this.sortBy === 'last_triggered') return (b.lastTriggered?.getTime() || 0) - (a.lastTriggered?.getTime() || 0);
      if (this.sortBy === 'trigger_count') return b.triggerCount - a.triggerCount;
      return 0;
    });
    this.automations = f;
  }

  _filteredFlat() {
    let t = this._filterByTime([...this._allFlatTraces]);
    if (this.traceFilterResult !== 'all') t = t.filter(x => x.status === this.traceFilterResult);
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      t = t.filter(x => x.automationName.toLowerCase().includes(q) || x.trigger.toLowerCase().includes(q));
    }
    return t;
  }

  _groupTraces(traces) {
    const g = {};
    for (const t of traces) {
      const key = this.groupBy === 'result' ? t.status : this.groupBy === 'trigger' ? t.trigger : t.automationName;
      if (!g[key]) g[key] = { name: key, traces: [], count: 0 };
      g[key].traces.push(t); g[key].count++;
    }
    return Object.values(g).sort((a, b) => b.count - a.count);
  }

  _stats(traces) {
    const n = traces.length;
    const ok = traces.filter(t => t.status === 'success').length;
    const err = traces.filter(t => t.status === 'error').length;
    const avg = n ? Math.round(traces.reduce((s, t) => s + t.duration, 0) / n) : 0;
    return { n, ok, err, avg, rate: n ? Math.round((ok / n) * 100) : 0 };
  }

  // ============================================================

  _startTimer() {
    if (this.relativeTimeUpdater) clearInterval(this.relativeTimeUpdater);
    this.relativeTimeUpdater = setInterval(() => {
      this.shadowRoot?.querySelectorAll('[data-ts]').forEach(el => {
        el.textContent = this._relTime(new Date(el.dataset.ts));
      });
    }, 30000);
  }

  _relTime(d) {
    const m = Math.floor((Date.now() - d) / 60000);
    if (m < 1) return this._t('justNow');
    if (m < 60) return `${m}${this._t('minutesAgo')}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}${this._t('hoursAgo')}`;
    return `${Math.floor(h / 24)}${this._t('daysAgo')}`;
  }

  _fmtDur(ms) {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  _fmtTime(d) {
    return d.toLocaleString(undefined, { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  _fmtTimeShort(d) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // ============================================================

  onAutoClick(entity) {
    this.selectedAutomation = entity;
    this.selectedTrace = null;
    this.traceDetail = null;
    this.selectedTraceIds.clear();
    this.selectMode = false;
    this.tracePage = 0;
    this._loadTraces(entity);
  }

  _loadTraces(entity) {
    const auto = this._rawAutomations.find(a => a.entity === entity);
    const aid = auto?.automationId;
    if (aid && this._traceMap[aid]) {
      let list = this._traceMap[aid].traces.map(t => {
        const st = t.timestamp?.start ? new Date(t.timestamp.start) : new Date();
        const ft = t.timestamp?.finish ? new Date(t.timestamp.finish) : st;
        return {
          id: t.run_id, item_id: t.item_id, automationEntity: entity,
          automationName: auto?.name || entity,
          timestamp: st, finishTime: ft,
          status: this._traceStatus(t), duration: ft - st,
          lastStep: t.last_step || '', scriptExecution: t.script_execution || '',
          trigger: t.trigger || 'unknown', raw: t
        };
      }).sort((a, b) => b.timestamp - a.timestamp);
      this.traces = this._filterByTime(list);
      if (this.traceFilterResult !== 'all') this.traces = this.traces.filter(x => x.status === this.traceFilterResult);
      this.tracePage = 0;
    } else {
      this.traces = [];
    }
    this.render();
  }

  async onTraceClick(traceId) {
    if (this.selectMode) {
      this.selectedTraceIds.has(traceId) ? this.selectedTraceIds.delete(traceId) : this.selectedTraceIds.add(traceId);
      this.render();
      return;
    }
    const trace = this.traces.find(t => t.id === traceId) || this._allFlatTraces.find(t => t.id === traceId);
    if (!trace) return;
    this.selectedTrace = traceId;
    this.traceDetail = null;
    this.detailTab = 'timeline';
    this.render();

    try {
      const detail = await this._hass.callWS({
        type: 'trace/get', domain: 'automation',
        item_id: trace.item_id, run_id: trace.id
      });
      // Persist detail for future use (HA may purge)
      this._storedDetails[trace.item_id + '::' + trace.id] = detail;
      this._saveStoredDetails();
      this.traceDetail = this._buildDetail(trace, detail);
    } catch (e) {
      // Try loading from stored details
      const storedKey = trace.item_id + '::' + trace.id;
      if (this._storedDetails[storedKey]) {
        this.traceDetail = this._buildDetail(trace, this._storedDetails[storedKey]);
      } else {
        this.traceDetail = {
          trace, steps: [], changedVars: [], rawData: { error: e.message },
          configYaml: '', relatedEntities: []
        };
      }
    }
    this.render();
  }

  // ============================================================

  _buildDetail(trace, detail) {
    const steps = [];
    const changedVars = [];
    const relatedEntities = [];
    const traceSteps = detail.trace || {};
    const configData = detail.config || {};

    // Sort trace steps
    const order = ['trigger', 'condition', 'action'];
    const keys = Object.keys(traceSteps).sort((a, b) => {
      const [at, ai] = a.split('/'); const [bt, bi] = b.split('/');
      return (order.indexOf(at) * 1000 + parseInt(ai || 0)) - (order.indexOf(bt) * 1000 + parseInt(bi || 0));
    });

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const stArr = traceSteps[key];
      if (!Array.isArray(stArr) || !stArr.length) continue;
      const st = stArr[0];
      const [cat] = key.split('/');

      let description = '';
      let icon = '';
      let details = {};
      let stepStatus = st.error ? 'error' : 'success';

      if (cat === 'trigger' && st.changed_variables?.trigger) {
        const trig = st.changed_variables.trigger;
        icon = '\u26A1';
        description = trig.description || `${this._t('triggeredBy')} ${trig.platform || 'unknown'}`;
        details = {};
        if (trig.entity_id) details.entity_id = trig.entity_id;
        if (trig.to_state?.state !== undefined) details.to = trig.to_state.state;
        if (trig.from_state?.state !== undefined) details.from = trig.from_state.state;
        if (trig.platform) details.platform = trig.platform;
        if (trig.event) details.event = trig.event;

        // Related: trigger entity
        if (trig.entity_id) {
          relatedEntities.push({
            entity: trig.entity_id,
            action: `triggered (${trig.from_state?.state || '?'} \u2192 ${trig.to_state?.state || '?'})`,
            time: st.timestamp ? new Date(st.timestamp) : trace.timestamp
          });
        }
      } else if (cat === 'condition') {
        icon = '\u2753';
        const res = st.result;
        if (res?.result === true || res?.result === false) {
          description = `${this._t('testCondition')}: ${res.result ? '\u2714 true' : '\u274C false'}`;
          stepStatus = res.result ? 'success' : 'skipped';
        } else {
          description = st.result?.alias || key;
        }
        details = typeof st.result === 'object' ? st.result : {};
      } else if (cat === 'action') {
        icon = '\u25B6';
        const res = st.result;
        description = res?.alias || `${this._t('performAction')}: ${key}`;
        details = typeof res === 'object' ? { ...res } : {};
        delete details.alias;

        // Related: action results that change entities
        if (res?.entity_id || stArr.length > 1) {
          for (const sub of stArr) {
            if (sub.changed_variables) {
              for (const [vk, vv] of Object.entries(sub.changed_variables)) {
                if (vk === 'context') continue;
                if (typeof vv === 'object' && vv?.entity_id) {
                  relatedEntities.push({
                    entity: vv.entity_id,
                    action: `${this._t('entityChanged')} ${vv.state || JSON.stringify(vv)}`,
                    time: sub.timestamp ? new Date(sub.timestamp) : trace.timestamp
                  });
                }
              }
            }
          }
        }
      }

      // Collect changed variables
      if (st.changed_variables) {
        for (const [vk, vv] of Object.entries(st.changed_variables)) {
          if (vk === 'trigger' || vk === 'context') continue;
          changedVars.push({ step: key, variable: vk, value: vv });
        }
      }

      // Duration calculation
      const stepStart = st.timestamp ? new Date(st.timestamp) : null;
      let stepEnd = stepStart;
      if (stArr.length > 1 && stArr[stArr.length - 1].timestamp) {
        stepEnd = new Date(stArr[stArr.length - 1].timestamp);
      }
      if (i < keys.length - 1) {
        const nextArr = traceSteps[keys[i + 1]];
        if (nextArr?.[0]?.timestamp) stepEnd = new Date(nextArr[0].timestamp);
      }
      const dur = stepStart && stepEnd ? Math.max(0, stepEnd - stepStart) : 0;

      steps.push({
        key, category: cat, icon, description, details,
        status: stepStatus, duration: Math.round(dur),
        timestamp: stepStart, error: st.error || null
      });
    }

    // Add "finished" step
    if (trace.finishTime) {
      steps.push({
        key: 'finished', category: 'result', icon: '\u23F9',
        description: `${this._t('finishedAt')} ${this._fmtTime(trace.finishTime)} (${this._t('runtime')}: ${this._fmtDur(trace.duration)})`,
        details: {}, status: trace.status === 'success' ? 'success' : 'error',
        duration: 0, timestamp: trace.finishTime, error: null
      });
    }

    // Build YAML from config
    let configYaml = '';
    try {
      configYaml = this._objToYaml(configData, 0);
    } catch (e) {
      configYaml = JSON.stringify(configData, null, 2);
    }

    // Look up related entity states from HA for richer related activity
    const traceEntities = new Set();
    steps.forEach(s => {
      if (s.details?.entity_id) traceEntities.add(s.details.entity_id);
    });
    // Add entity state info to related
    traceEntities.forEach(eid => {
      const state = this._hass?.states?.[eid];
      if (state && !relatedEntities.find(r => r.entity === eid)) {
        relatedEntities.push({
          entity: eid,
          action: `current: ${state.state}`,
          time: state.last_changed ? new Date(state.last_changed) : null,
          friendlyName: state.attributes?.friendly_name
        });
      }
    });

    return { trace, steps, changedVars, rawData: detail, configYaml, relatedEntities };
  }

  _objToYaml(obj, indent) {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj === 'string') return obj.includes('\n') ? `|\n${obj.split('\n').map(l => '  '.repeat(indent + 1) + l).join('\n')}` : `${obj}`;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      return obj.map(item => {
        if (typeof item === 'object' && item !== null) {
          const inner = this._objToYaml(item, indent + 1);
          const lines = inner.split('\n');
          return '  '.repeat(indent) + '- ' + lines[0].trim() + (lines.length > 1 ? '\n' + lines.slice(1).join('\n') : '');
        }
        return '  '.repeat(indent) + '- ' + this._objToYaml(item, indent + 1);
      }).join('\n');
    }
    if (typeof obj === 'object') {
      const entries = Object.entries(obj);
      if (entries.length === 0) return '{}';
      return entries.map(([k, v]) => {
        if (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length > 0) {
          return '  '.repeat(indent) + `${k}:\n${this._objToYaml(v, indent + 1)}`;
        }
        if (Array.isArray(v) && v.length > 0) {
          return '  '.repeat(indent) + `${k}:\n${this._objToYaml(v, indent + 1)}`;
        }
        return '  '.repeat(indent) + `${k}: ${this._objToYaml(v, indent + 1)}`;
      }).join('\n');
    }
    return String(obj);
  }

  // ============================================================

  _renderFlowGraph(steps) {
    if (!steps || steps.length < 2) return '';
    const nodeH = 36, nodeW = 220, gapY = 16, padX = 30, padY = 20;
    const totalH = padY * 2 + steps.length * (nodeH + gapY) - gapY;
    const totalW = nodeW + padX * 2;
    const cx = totalW / 2;

    let svg = `<svg class="flow-graph" viewBox="0 0 ${totalW} ${totalH}" width="100%" style="max-width:${totalW}px">`;

    steps.forEach((step, i) => {
      const y = padY + i * (nodeH + gapY);
      const nodeCY = y + nodeH / 2;

      // Connector line to next
      if (i < steps.length - 1) {
        const nextY = padY + (i + 1) * (nodeH + gapY);
        svg += `<line x1="${cx}" y1="${y + nodeH}" x2="${cx}" y2="${nextY}" stroke="var(--divider-color)" stroke-width="2" stroke-dasharray="${step.status === 'skipped' ? '4,4' : 'none'}"/>`;
      }

      // Node colors (Bento tokens with hex fallbacks)
      let fill, stroke, textFill;
      if (step.category === 'trigger') { fill = 'rgba(59,130,246,0.12)'; stroke = 'var(--bento-primary, #3B82F6)'; textFill = 'var(--bento-primary, #3B82F6)'; }
      else if (step.category === 'condition') {
        if (step.status === 'skipped') { fill = 'rgba(100,116,139,0.08)'; stroke = 'var(--bento-text-secondary, #94A3B8)'; textFill = 'var(--bento-text-secondary, #94A3B8)'; }
        else { fill = 'rgba(245,158,11,0.12)'; stroke = 'var(--bento-warning, #F59E0B)'; textFill = 'var(--tc, #B45309)'; }
      }
      else if (step.category === 'result') { fill = step.status === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'; stroke = step.status === 'success' ? 'var(--bento-success, #10B981)' : 'var(--bento-error, #EF4444)'; textFill = stroke; }
      else if (step.status === 'error') { fill = 'rgba(239,68,68,0.12)'; stroke = 'var(--bento-error, #EF4444)'; textFill = 'var(--bento-error, #EF4444)'; }
      else { fill = 'rgba(16,185,129,0.1)'; stroke = 'var(--bento-success, #10B981)'; textFill = 'var(--tc, #1E293B)'; }

      // Rounded rect node
      svg += `<rect x="${cx - nodeW / 2}" y="${y}" width="${nodeW}" height="${nodeH}" rx="18" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;

      // Icon circle
      svg += `<circle cx="${cx - nodeW / 2 + 20}" cy="${nodeCY}" r="11" fill="${stroke}" opacity="0.2"/>`;

      // Icon text
      svg += `<text x="${cx - nodeW / 2 + 20}" y="${nodeCY + 1}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="${stroke}">${step.icon}</text>`;

      // Label (truncated)
      const label = step.description.length > 28 ? step.description.substring(0, 26) + '...' : step.description;
      svg += `<text x="${cx - nodeW / 2 + 38}" y="${nodeCY + 1}" dominant-baseline="central" font-size="11" fill="${textFill}" font-weight="500">${this._escHtml(label)}</text>`;

      // Duration on the right
      if (step.duration > 0) {
        svg += `<text x="${cx + nodeW / 2 - 8}" y="${nodeCY + 1}" text-anchor="end" dominant-baseline="central" font-size="9" fill="var(--text-secondary)">${this._fmtDur(step.duration)}</text>`;
      }
    });

    svg += '</svg>';
    return svg;
  }

  _escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ============================================================

  async _export(fmt, onlySelected) {
    let list = onlySelected && this.selectedTraceIds.size > 0
      ? this._allFlatTraces.filter(t => this.selectedTraceIds.has(t.id))
      : this.viewMode === 'all-traces' ? this._filteredFlat() : this.traces;
    if (!list.length) return;

    const full = [];
    for (const t of list) {
      try {
        const d = await this._hass.callWS({ type: 'trace/get', domain: 'automation', item_id: t.item_id, run_id: t.id });
        full.push({ s: t, d });
      } catch (e) { full.push({ s: t, d: null }); }
    }

    let content, filename, mime;
    if (fmt === 'json') {
      content = JSON.stringify(full.map(f => ({
        run_id: f.s.id, item_id: f.s.item_id, automation: f.s.automationName,
        timestamp: f.s.timestamp.toISOString(), finish: f.s.finishTime?.toISOString(),
        status: f.s.status, duration_ms: f.s.duration, trigger: f.s.trigger,
        detail: f.d
      })), null, 2);
      filename = `traces-${Date.now()}.json`; mime = 'application/json';
    } else {
      const rows = [['run_id','automation','timestamp','status','duration_ms','trigger','last_step']];
      full.forEach(f => rows.push([f.s.id, `"${f.s.automationName}"`, f.s.timestamp.toISOString(), f.s.status, f.s.duration, `"${f.s.trigger}"`, `"${f.s.lastStep}"`]));
      content = rows.map(r => r.join(',')).join('\n');
      filename = `traces-${Date.now()}.csv`; mime = 'text/csv';
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = filename; a.click();
  }

  async _exportMultiAuto(fmt) {
    if (!this.selectedAutoIds.size) return;
    const autoEntities = [...this.selectedAutoIds];
    const allTraces = [];

    for (const entity of autoEntities) {
      const auto = this._rawAutomations.find(a => a.entity === entity);
      const aid = auto?.automationId;
      if (aid && this._traceMap[aid]) {
        for (const t of this._traceMap[aid].traces) {
          const st = t.timestamp?.start ? new Date(t.timestamp.start) : new Date();
          const ft = t.timestamp?.finish ? new Date(t.timestamp.finish) : st;
          allTraces.push({
            id: t.run_id, item_id: t.item_id, automationEntity: entity,
            automationName: auto?.name || entity,
            timestamp: st, finishTime: ft,
            status: this._traceStatus(t), duration: ft - st,
            lastStep: t.last_step || '', scriptExecution: t.script_execution || '',
            trigger: t.trigger || 'unknown', raw: t
          });
        }
      }
    }

    if (!allTraces.length) return;

    const full = [];
    for (const t of allTraces) {
      try {
        const d = await this._hass.callWS({ type: 'trace/get', domain: 'automation', item_id: t.item_id, run_id: t.id });
        full.push({ s: t, d });
      } catch (e) {
        const stored = this._storedDetails[t.item_id + '::' + t.id];
        full.push({ s: t, d: stored || null });
      }
    }

    let content, filename, mime;
    if (fmt === 'json') {
      const grouped = {};
      full.forEach(f => {
        if (!grouped[f.s.automationName]) grouped[f.s.automationName] = [];
        grouped[f.s.automationName].push({
          run_id: f.s.id, item_id: f.s.item_id,
          timestamp: f.s.timestamp.toISOString(), finish: f.s.finishTime?.toISOString(),
          status: f.s.status, duration_ms: f.s.duration, trigger: f.s.trigger,
          detail: f.d
        });
      });
      content = JSON.stringify(grouped, null, 2);
      filename = `automations-export-${Date.now()}.json`; mime = 'application/json';
    } else {
      const rows = [['automation','run_id','timestamp','status','duration_ms','trigger','last_step']];
      full.forEach(f => rows.push([`"${f.s.automationName}"`, f.s.id, f.s.timestamp.toISOString(), f.s.status, f.s.duration, `"${f.s.trigger}"`, `"${f.s.lastStep}"`]));
      content = rows.map(r => r.join(',')).join('\n');
      filename = `automations-export-${Date.now()}.csv`; mime = 'text/csv';
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = filename; a.click();
  }

  // ============================================================

  _safeJson(obj) {
    try {
      const seen = new WeakSet();
      return JSON.stringify(obj, (k, v) => {
        if (typeof v === 'object' && v !== null) { if (seen.has(v)) return '[Circular]'; seen.add(v); }
        return v;
      }, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    } catch (e) { return 'Error: ' + e.message; }
  }

  // ============================================================

  _ico(s) { return s === 'success' ? '\u2714' : s === 'running' ? '\u21BB' : s === 'error' ? '\u274C' : s === 'aborted' ? '\u23F9' : '\u2753'; }
  _sLabel(s) { return this._t(s) || s; }

  // ============================================================

  _renderAutoList() {
    if (!this.automations.length) return `<div class="empty"><div class="empty-ico">\u26A0</div><div>${this._t('noAutomations')}</div></div>`;

    const ps = this.autoPageSize;
    const totalPages = Math.ceil(this.automations.length / ps);
    if (this.autoPage >= totalPages) this.autoPage = Math.max(0, totalPages - 1);
    const pageList = this.automations.slice(this.autoPage * ps, (this.autoPage + 1) * ps);

    const pag = totalPages > 1 ? `<div class="pag">
      <button class="pag-btn" data-apdir="-1" ${this.autoPage === 0 ? 'disabled' : ''} aria-label="${this._t('previousPage')}">\u2039</button>
      <span class="pag-info">${this.autoPage + 1}/${totalPages} (${this.automations.length})</span>
      <button class="pag-btn" data-apdir="1" ${this.autoPage >= totalPages - 1 ? 'disabled' : ''} aria-label="${this._t('nextPage')}">\u203A</button>
      <select class="pag-size" id="autoPagSize">
        <option value="15" ${ps === 15 ? 'selected' : ''}>15</option>
        <option value="30" ${ps === 30 ? 'selected' : ''}>30</option>
        <option value="50" ${ps === 50 ? 'selected' : ''}>50</option>
        <option value="100" ${ps === 100 ? 'selected' : ''}>100</option>
      </select>
    </div>` : '';

    return pag + `<div class="list">${pageList.map(a => {
      const isSel = this.selectedAutomation === a.entity;
      const isChk = this.selectedAutoIds.has(a.entity);
      return `
      <div class="auto-item ${isSel ? 'sel' : ''} ${isChk ? 'chk' : ''} s-${a.status}" data-auto="${a.entity}">
        ${this.selectMode ? `<span class="tr-cb" data-autocheck="${a.entity}">${isChk ? '\u2611' : '\u2610'}</span>` : ''}
        <div style="flex:1;min-width:0">
          <div class="auto-name">${this._sanitize(a.name)}</div>
          <div class="auto-meta">
            <span class="auto-dot s-${a.status}"></span>
            <span data-ts="${a.lastTriggered?.toISOString() || ''}">${a.lastTriggered ? this._relTime(a.lastTriggered) : 'Never'}</span>
            <span class="auto-count">${a.triggerCount}</span>
          </div>
        </div>
      </div>`;
    }).join('')}</div>` + pag;
  }

  // ============================================================

  _renderTracesList() {
    if (this.viewMode === 'automations' && !this.selectedAutomation)
      return `<div class="empty"><div class="empty-ico">\u261A</div><div>${this._t('clickAutomationToView')}</div></div>`;

    const list = this.viewMode === 'all-traces' ? this._filteredFlat() : this.traces;
    if (!list.length) return `<div class="empty"><div class="empty-ico">\u26A0</div><div>${this._t('noTraces')}</div></div>`;

    const stats = this._stats(list);
    const statsHtml = `<div class="stats">
      <div class="stat"><span class="sv">${stats.n}</span><span class="sl">${this._t('totalTraces')}</span></div>
      <div class="stat ok"><span class="sv">${stats.rate}%</span><span class="sl">${this._t('successRate')}</span></div>
      <div class="stat"><span class="sv">${this._fmtDur(stats.avg)}</span><span class="sl">${this._t('avgDuration')}</span></div>
      <div class="stat err"><span class="sv">${stats.err}</span><span class="sl">${this._t('error')}</span></div>
    </div>`;

    if (this.viewMode === 'all-traces' && this.groupBy !== 'none') {
      const groups = this._groupTraces(list);
      return statsHtml + `<div class="list">${groups.map(g => `
        <div class="tgroup">
          <div class="tgroup-h" data-group="${g.name}">
            <span class="tg-tog">\u25BC</span><span class="tg-name">${this._sanitize(g.name)}</span>
            <span class="tg-cnt">${g.count}</span>
          </div>
          <div class="tgroup-items">${g.traces.map(t => this._renderTraceItem(t)).join('')}</div>
        </div>
      `).join('')}</div>`;
    }
        const ps = this.tracePageSize;
    const totalPages = Math.ceil(list.length / ps);
    if (this.tracePage >= totalPages) this.tracePage = Math.max(0, totalPages - 1);
    const pageList = list.slice(this.tracePage * ps, (this.tracePage + 1) * ps);
    const pag = totalPages > 1 ? `<div class="pag"><button class="pag-btn" data-pdir="-1" ${this.tracePage===0?'disabled':''}>‹ Prev</button><span class="pag-info">Page ${this.tracePage+1}/${totalPages} (${list.length} traces)</span><button class="pag-btn" data-pdir="1" ${this.tracePage>=totalPages-1?'disabled':''}>Next ›</button><select class="pag-size" id="pagSize"><option value="15" ${ps===15?'selected':''}>15/page</option><option value="30" ${ps===30?'selected':''}>30/page</option><option value="50" ${ps===50?'selected':''}>50/page</option><option value="100" ${ps===100?'selected':''}>100/page</option></select></div>` : '';
    return statsHtml + pag + `<div class="list">${pageList.map(t => this._renderTraceItem(t)).join('')}</div>` + pag;
  }

  _renderTraceItem(t) {
    const sel = this.selectedTrace === t.id;
    const chk = this.selectedTraceIds.has(t.id);
    const showName = this.viewMode === 'all-traces' && this.groupBy !== 'automation';
    return `
      <div class="tr-item ${sel ? 'sel' : ''} ${chk ? 'chk' : ''} s-${t.status}" data-trace="${t.id}">
        ${this.selectMode ? `<span class="tr-cb" data-tcheck="${t.id}">${chk ? '\u2611' : '\u2610'}</span>` : ''}
        <span class="tr-ico s-${t.status}">${this._ico(t.status)}</span>
        <div class="tr-info">
          ${showName ? `<div class="tr-auto">${t.automationName}</div>` : ''}
          <div class="tr-time" data-ts="${t.timestamp.toISOString()}">${this._fmtTimeShort(t.timestamp)} \u00B7 ${this._relTime(t.timestamp)}</div>
          <div class="tr-trig">${t.lastStep || t.scriptExecution || t.trigger}</div>
        </div>
        <span class="tr-dur">${this._fmtDur(t.duration)}</span>
      </div>`;
  }

  // ============================================================

  _renderDetail() {
    if (!this.traceDetail) {
      if (this.selectedTrace) return `<div class="empty"><div class="spinner"></div><div>${this._t('loading')}</div></div>`;
      return `<div class="empty"><div class="empty-ico">\u261A</div><div>${this._t('clickTraceToView')}</div></div>`;
    }

    const { trace, steps, changedVars, rawData, configYaml, relatedEntities } = this.traceDetail;
    const tabs = ['timeline', 'related', 'changes', 'config', 'json'];
    const tabLabels = { timeline: this._t('timeline'), related: `${this._t('related')} (${relatedEntities.length})`,
      changes: `${this._t('changes')} (${changedVars.length})`, config: this._t('config'), json: this._t('json') };

    // Build only the active tab pane
    let activePane = '';
    switch (this.detailTab) {
      case 'timeline':
        activePane = steps.map((s, i) => `
          <div class="tl-step s-${s.status}">
            <div class="tl-head">
              <div class="tl-num" style="background:${s.category === 'trigger' ? 'var(--bento-primary, #3B82F6)' : s.category === 'condition' ? 'var(--bento-warning, #F59E0B)' : s.category === 'result' ? (s.status === 'success' ? 'var(--bento-success, #10B981)' : 'var(--bento-error, #EF4444)') : s.status === 'error' ? 'var(--bento-error, #EF4444)' : 'var(--bento-success, #10B981)'}">${s.icon}</div>
              <div class="tl-title">
                <span class="tl-cat">${s.category.toUpperCase()}</span>
                <span class="tl-desc">${s.description}</span>
              </div>
              <span class="tl-dur">${s.duration > 0 ? this._fmtDur(s.duration) : ''}</span>
            
        <!-- Support / Donation -->
        <div class="donate-section" data-source="ha-tools-split">
          <div class="donate-text">
            <h3>❤️ ${this._lang === 'pl' ? 'Wesprzyj rozwój HA Tools' : 'Support HA Tools Development'}</h3>
            <p>${this._lang === 'pl' ? 'Jeśli to narzędzie ułatwia Ci życie z Home Assistant, rozważ wsparcie projektu. Każda kawa motywuje do dalszego rozwoju!' : 'If this tool makes your Home Assistant life easier, consider supporting the project. Every coffee motivates further development!'}</p>
          </div>
          <div class="donate-buttons">
            <a class="donate-btn coffee" href="https://buymeacoffee.com/macsiem" target="_blank" rel="noopener noreferrer">☕ Buy Me a Coffee</a>
            <a class="donate-btn paypal" href="https://www.paypal.com/donate/?hosted_button_id=Y967H4PLRBN8W" target="_blank" rel="noopener noreferrer">💳 PayPal</a>
          </div>
        </div>
        </div>
            ${s.error ? `<div class="tl-err">\u26A0 ${typeof s.error === 'string' ? s.error : JSON.stringify(s.error)}</div>` : ''}
            ${Object.keys(s.details).length > 0 ? `<div class="tl-dets">${Object.entries(s.details).filter(([,v]) => v !== undefined && v !== null).map(([k, v]) =>
              `<span class="tl-det"><b>${k}:</b> ${typeof v === 'object' ? JSON.stringify(v) : v}</span>`
            ).join('')}</div>` : ''}
            ${s.timestamp ? `<div class="tl-ts">${this._fmtTimeShort(s.timestamp)}</div>` : ''}
          </div>
        `).join('');
        break;
      case 'related':
        activePane = relatedEntities.length === 0 ? `<div class="empty" style="height:auto;padding:24px">${this._t('noRelatedActivity')}</div>` :
          `<div class="rel-list">${relatedEntities.map(r => `
            <div class="rel-item">
              <div class="rel-entity">${r.friendlyName || r.entity}</div>
              <div class="rel-action">${r.action}</div>
              ${r.time ? `<div class="rel-time">${this._fmtTimeShort(r.time)}</div>` : ''}
            </div>
          `).join('')}</div>`;
        break;
      case 'changes':
        activePane = changedVars.length === 0 ? `<div class="empty" style="height:auto;padding:24px">${this._t('noChanges')}</div>` :
          changedVars.map(cv => `
            <div class="cv-item">
              <div class="cv-head"><span class="cv-step">${cv.step}</span><span class="cv-name">${cv.variable}</span></div>
              <pre class="cv-val">${this._safeJson(cv.value)}</pre>
            </div>
          `).join('');
        break;
      case 'config':
        activePane = `<div class="config-header">${this._t('automationConfig')}</div>
          <pre class="yaml-content">${this._escHtml(configYaml)}</pre>`;
        break;
      case 'json':
        activePane = `<div class="json-bar"><button class="btn-s" id="cpJson">\u{1F4CB} ${this._t('copyJson')}</button></div>
          <pre class="json-content">${this._safeJson(rawData)}</pre>`;
        break;
    }

    return `
      <!-- Header with status -->
      <div class="det-head">
        <div class="det-info">
          <div class="det-title">${trace.automationName || this._t('traceDetail')}</div>
          <div class="det-time">${this._t('executedAt')} ${this._fmtTime(trace.timestamp)}</div>
        </div>
        <div class="det-badge s-${trace.status}">
          ${this._ico(trace.status)} ${this._sLabel(trace.status)}
          <span class="det-dur">${this._fmtDur(trace.duration)}</span>
        </div>
      </div>

      <!-- Flow graph -->
      <div class="det-flow">
        ${this._renderFlowGraph(steps)}
      </div>

      <!-- Tabs -->
      <div class="det-tabs">
        ${tabs.map(t => `<button class="dtab ${this.detailTab === t ? 'act' : ''}" data-dtab="${t}" role="tab" aria-selected="${!!(this.detailTab === t )}">${tabLabels[t]}</button>`).join('')}
      </div>

      <!-- Tab content -->
      <div class="det-body">
        <div class="tab-pane act" id="tp-${this.detailTab}">
          ${activePane}
        </div>
      </div>
    `;
  }

  // ============================================================

  render() {
    if (!this._hass) return;
    const selN = this.selectedTraceIds.size;
    this.shadowRoot.innerHTML = `${this._css()}
    <div class="card">
      <div class="col-main">
        <!-- TOP BAR -->
        <div class="topbar">
          <span class="title">${this.config.title || this._t('traceViewer')}</span>
          <div class="topbar-r">
            <span class="trace-saved-badge" id="traceStorageInfo" title="${this._lang === 'pl' ? 'Zapisane trace\u2019y' : 'Saved traces'}" style="font-size:11px;color:var(--bento-text-secondary);padding:4px 8px;background:var(--bento-bg);border-radius:var(--radius-xs);border:1px solid var(--bento-border);display:inline-flex;align-items:center;gap:4px">\u{1F4BE} ${this._getStoredTraceCount()} saved</span><span class="trace-settings-btn" id="goToSettingsBtn" title="${this._lang === 'pl' ? 'Ustawienia Trace Viewer' : 'Trace Viewer Settings'}" style="font-size:11px;color:var(--bento-text-secondary);padding:4px 8px;background:var(--bento-bg);border-radius:var(--radius-xs);border:1px solid var(--bento-border);cursor:pointer;display:inline-flex;align-items:center;gap:4px;margin-left:6px">\u2699\uFE0F ${this._lang === 'pl' ? 'Ustawienia' : 'Settings'}</span>
            <div class="dd" id="expDD">
              <button class="btn-s" id="expBtn" ${selN === 0 && this.selectedAutoIds.size === 0 ? 'disabled style="opacity:0.4;pointer-events:none;cursor:default"' : ''}>${this._t('export')} \u25BE</button>
              <div class="dd-menu">
                ${selN > 0 ? `<div class="dd-i" data-exp="sel-json">JSON (${selN} traces ${this._t('selected')})</div><div class="dd-i" data-exp="sel-csv">CSV (${selN} traces ${this._t('selected')})</div><div class="dd-div"></div>` : ''}
                ${this.selectedAutoIds.size > 0 ? `<div class="dd-i" data-exp="auto-json">JSON (${this.selectedAutoIds.size} ${this._t('automations')})</div><div class="dd-i" data-exp="auto-csv">CSV (${this.selectedAutoIds.size} ${this._t('automations')})</div><div class="dd-div"></div>` : ''}
                
              </div>
            </div>
          </div>
        </div>

        <!-- CONTROLS -->
        <div class="cbar">
          <div class="cg"><label>${this._t('viewMode')}</label><select id="viewSel">
            <option value="automations" ${this.viewMode === 'automations' ? 'selected' : ''}>${this._t('byAutomation')}</option>
            <option value="all-traces" ${this.viewMode === 'all-traces' ? 'selected' : ''}>${this._t('flatList')}</option>
          </select></div>
          ${this.viewMode === 'all-traces' ? `<div class="cg"><label>${this._t('groupBy')}</label><select id="grpSel">
            <option value="automation" ${this.groupBy === 'automation' ? 'selected' : ''}>${this._t('groupAutomation')}</option>
            <option value="result" ${this.groupBy === 'result' ? 'selected' : ''}>${this._t('groupResult')}</option>
            <option value="trigger" ${this.groupBy === 'trigger' ? 'selected' : ''}>${this._t('groupTrigger')}</option>
          </select></div>` : ''}
          <div class="cg"><label>${this._t('timeRange')}</label>
            <select id="timeSel">${['all','1h','6h','24h','7d','30d','custom'].map(v =>
              `<option value="${v}" ${this.timeRange === v ? 'selected' : ''}>${this._t('time' + v.charAt(0).toUpperCase() + v.slice(1))}</option>`
            ).join('')}</select>
          </div>
          ${this.timeRange === 'custom' ? `<div class="cg"><input type="datetime-local" id="cfrom" value="${this.customTimeFrom || ''}" /><span>\u2192</span><input type="datetime-local" id="cto" value="${this.customTimeTo || ''}" /></div>` : ''}
          <div class="cg"><label>${this._t('filterByStatus')}</label><select id="resSel">
            <option value="all" ${this.traceFilterResult === 'all' ? 'selected' : ''}>${this._t('allStatuses')}</option>
            <option value="success" ${this.traceFilterResult === 'success' ? 'selected' : ''}>${this._t('success')}</option>
            <option value="error" ${this.traceFilterResult === 'error' ? 'selected' : ''}>${this._t('error')}</option>
          </select></div>
          <div class="cg cg-r">
            <button class="btn-s ${this.selectMode ? 'btn-act' : ''}" id="selBtn">\u2611 ${this.selectMode ? this._t('cancel') : this._t('selectMode')}</button>
            ${this.selectMode ? `
              <span style="font-size:12px;color:var(--bento-text-secondary);font-weight:500">${this.selectedAutoIds.size}A + ${this.selectedTraceIds.size}T</span>
            ` : ''}
          </div>
        </div>

        <!-- PANELS -->
        <div class="panels">
          ${this.viewMode === 'automations' ? `
          <div class="pan-left">
            <div class="pan-head"><span class="pan-title">${this._t('automations')} (${this.automations.length})</span></div>
            <div class="search-box"><input type="text" class="sinput" id="autoSearch" placeholder="${this._t('search')}" value="${this._escHtml(this.searchQuery)}" /></div>
            <div class="ctrls">
              <div class="crow"><span class="clbl">${this._t('sortBy')}</span><select class="csel" id="sortSel">
                <option value="last_triggered" ${this.sortBy === 'last_triggered' ? 'selected' : ''}>${this._t('sortLastTriggered')}</option>
                <option value="name" ${this.sortBy === 'name' ? 'selected' : ''}>${this._t('sortName')}</option>
                <option value="trigger_count" ${this.sortBy === 'trigger_count' ? 'selected' : ''}>${this._t('sortTriggerCount')}</option>
              </select></div>
              <div class="crow"><span class="clbl">${this._t('filterByStatus')}</span><select class="csel" id="fltSel">
                <option value="all" ${this.filterStatus === 'all' ? 'selected' : ''}>${this._t('allStatuses')}</option>
                <option value="running" ${this.filterStatus === 'running' ? 'selected' : ''}>${this._t('statusRunning')}</option>
                <option value="stopped" ${this.filterStatus === 'stopped' ? 'selected' : ''}>${this._t('statusStopped')}</option>
              </select></div>
            </div>
            ${this._renderAutoList()}
          </div>` : ''}

          <div class="pan-center ${this.viewMode === 'all-traces' ? 'expanded' : ''}">
            <div class="pan-head">
              <span class="pan-title">${this.viewMode === 'all-traces' ? this._t('allTraces') : this._t('traces')}</span>
              ${this.viewMode === 'all-traces' ? `<input type="text" class="sinput-sm" id="trSearch" placeholder="${this._t('searchTraces')}" value="${this._escHtml(this.searchQuery)}" />` : ''}
            </div>
            ${this._renderTracesList()}
          </div>

          <div class="pan-right">
            ${this._renderDetail()}
          </div>
        </div>
      </div>
    </div>`;
    this._bindEvents();
    // Apply compact classes immediately after render based on current width
    this._applyCompactClasses();
  }

  _applyCompactClasses() {
    const w = this.offsetWidth || this.clientWidth || 0;
    const card = this.shadowRoot?.querySelector('.card');
    if (!card || !w) return;
    card.classList.toggle('compact-mobile', w < 768);
    card.classList.toggle('compact-xs', w < 480);
    card.classList.toggle('compact-hide-right', w < 1200);
    card.classList.toggle('compact-hide-left', w < 900);
  }

  // ============================================================

  _bindEvents() {
    const $ = s => this.shadowRoot.querySelector(s);
    const $$ = s => this.shadowRoot.querySelectorAll(s);

    // Trace storage info badge -- navigate to panel Settings >
    $('#traceStorageInfo')?.addEventListener('click', () => {
      // Shadow DOM: this element lives inside ha-tools-panel's shadowRoot
      // closest() can't cross shadow boundaries, use getRootNode().host instead
      let panel = null;
      try {
        const root = this.getRootNode();
        if (root && root.host && root.host.tagName === 'HA-TOOLS-PANEL') {
          panel = root.host;
        }
      } catch (e) { console.debug('[ha-trace-viewer] caught:', e); }
      if (!panel) panel = document.querySelector('ha-tools-panel');
      if (panel && panel._navigateToSettings) {
        panel._navigateToSettings('trace-backend');
      } else {
        this.dispatchEvent(new CustomEvent('navigate-settings', { bubbles: true, composed: true, detail: { section: 'trace-backend' } }));
      }
    });

    // Settings info bar button
    $('#goToSettingsBtn')?.addEventListener('click', () => {
      let panel = null;
      try {
        const root = this.getRootNode();
        if (root && root.host && root.host.tagName === 'HA-TOOLS-PANEL') panel = root.host;
      } catch (e) { console.debug('[ha-trace-viewer] caught:', e); }
      if (!panel) panel = document.querySelector('ha-tools-panel');
      if (panel && panel._navigateToSettings) {
        panel._navigateToSettings('trace-backend');
      } else {
        this.dispatchEvent(new CustomEvent('navigate-settings', { bubbles: true, composed: true, detail: { section: 'trace-backend' } }));
      }
    });

    // Export dropdown
    $('#expBtn')?.addEventListener('click', e => {
      e.stopPropagation();
      const dd = $('#expDD'); dd.classList.toggle('open');
      const close = () => { dd.classList.remove('open'); document.removeEventListener('click', close); };
      this._expDDClose = close;
      setTimeout(() => document.addEventListener('click', close), 0);
    });
    $$('.dd-i[data-exp]').forEach(el => el.addEventListener('click', () => {
      const a = el.dataset.exp;
      if (a === 'all-json') this._export('json', false);
      else if (a === 'all-csv') this._export('csv', false);
      else if (a === 'sel-json') this._export('json', true);
      else if (a === 'sel-csv') this._export('csv', true);
      else if (a === 'auto-json') this._exportMultiAuto('json');
      else if (a === 'auto-csv') this._exportMultiAuto('csv');
      $('#expDD').classList.remove('open');
    }));

    // Controls
    $('#viewSel')?.addEventListener('change', e => { this.viewMode = e.target.value; this.searchQuery = ''; this.selectedAutomation = null; this.selectedTrace = null; this.traceDetail = null; this.selectedTraceIds.clear(); this.selectMode = false;
    this.tracePage = 0; this.autoPage = 0;
    this.tracePageSize = this._loadPageSize(); this._saveCurrentSettings(); this.render(); });
    $('#grpSel')?.addEventListener('change', e => { this.groupBy = e.target.value; this._saveCurrentSettings(); this.render(); });
    $('#timeSel')?.addEventListener('change', e => { this.timeRange = e.target.value; this.tracePage = 0; this._saveCurrentSettings(); this.selectedAutomation ? this._loadTraces(this.selectedAutomation) : this.render(); });
    $('#cfrom')?.addEventListener('change', e => { this.customTimeFrom = e.target.value; this.selectedAutomation ? this._loadTraces(this.selectedAutomation) : this.render(); });
    $('#cto')?.addEventListener('change', e => { this.customTimeTo = e.target.value; this.selectedAutomation ? this._loadTraces(this.selectedAutomation) : this.render(); });
    $('#resSel')?.addEventListener('change', e => { this.traceFilterResult = e.target.value; this.tracePage = 0; this._saveCurrentSettings(); this.selectedAutomation ? this._loadTraces(this.selectedAutomation) : this.render(); });
    $('#selBtn')?.addEventListener('click', () => {
      this.selectMode = !this.selectMode;
      this.selectMode = this.selectMode;
      if (!this.selectMode) { this.selectedTraceIds.clear(); this.selectedAutoIds.clear(); }
      this.render();
    });
    // Pagination
    this.shadowRoot?.querySelectorAll('.pag-btn').forEach(b => b.addEventListener('click', () => {
      this.tracePage += parseInt(b.dataset.pdir); this.render();
    }));
    this.shadowRoot?.querySelector('#pagSize')?.addEventListener('change', e => {
      this.tracePageSize = parseInt(e.target.value); this.tracePage = 0; this._savePageSize(this.tracePageSize); this.render();
    });

    // Automation pagination
    $$('[data-apdir]').forEach(b => b.addEventListener('click', () => {
      this.autoPage += parseInt(b.dataset.apdir); this.render();
    }));
    $('#autoPagSize')?.addEventListener('change', e => {
      this.autoPageSize = parseInt(e.target.value); this.autoPage = 0;
      this._saveSetting('autoPageSize', this.autoPageSize); this.render();
    });

    // Auto checkboxes
    $$('[data-autocheck]').forEach(el => el.addEventListener('click', e => {
      e.stopPropagation();
      const entity = el.dataset.autocheck;
      this.selectedAutoIds.has(entity) ? this.selectedAutoIds.delete(entity) : this.selectedAutoIds.add(entity);
      this.render();
    }));

    // Automations
    $('#autoSearch')?.addEventListener('input', e => { this.searchQuery = e.target.value; this.autoPage = 0; this.applyFiltersAndSort(); this.render(); });
    $('#trSearch')?.addEventListener('input', e => { this.searchQuery = e.target.value; this.render(); });
    $('#sortSel')?.addEventListener('change', e => { this.sortBy = e.target.value; this.autoPage = 0; this._saveCurrentSettings(); this.applyFiltersAndSort(); this.render(); });
    $('#fltSel')?.addEventListener('change', e => { this.filterStatus = e.target.value; this.autoPage = 0; this._saveCurrentSettings(); this.applyFiltersAndSort(); this.render(); });

    $$('.auto-item[data-auto]').forEach(el => el.addEventListener('click', () => {
      if (this.selectMode) {
        const entity = el.dataset.auto;
        this.selectedAutoIds.has(entity) ? this.selectedAutoIds.delete(entity) : this.selectedAutoIds.add(entity);
        this.render();
      } else {
        this.onAutoClick(el.dataset.auto);
      }
    }));
    $$('.tr-item[data-trace]').forEach(el => el.addEventListener('click', () => this.onTraceClick(el.dataset.trace)));
    $$('[data-tcheck]').forEach(el => el.addEventListener('click', e => {
      e.stopPropagation(); const id = el.dataset.tcheck;
      this.selectedTraceIds.has(id) ? this.selectedTraceIds.delete(id) : this.selectedTraceIds.add(id); this.render();
    }));
    $$('.tgroup-h').forEach(h => h.addEventListener('click', () => h.parentElement.classList.toggle('collapsed')));

    // Detail tabs
    $$('.dtab').forEach(tab => tab.addEventListener('click', () => {
      this.detailTab = tab.dataset.dtab;
      $$('.dtab').forEach(t => t.classList.remove('act'));
      tab.classList.add('act');
      $$('.tab-pane').forEach(p => p.classList.remove('act'));
      $(`#tp-${this.detailTab}`)?.classList.add('act');
    }));

    // Copy JSON
    $('#cpJson')?.addEventListener('click', () => {
      const txt = this.traceDetail?.rawData ? JSON.stringify(this.traceDetail.rawData, null, 2) : '';
      navigator.clipboard?.writeText(txt).then(() => {
        const b = $('#cpJson'); if (b) { b.textContent = `\u2714 ${this._t('copied')}`; setTimeout(() => b.textContent = `\u{1F4CB} ${this._t('copyJson')}`, 1500); }
      });
    });
  }

  // ============================================================

  _css() {
    return `<style>${window.HAToolsBentoCSS || ""}
/* === HA Tools split — premium banners (donate / intro / prereq) === */

/* Donation footer — diamond top */
.donate-section {  margin: 24px 0 4px; padding: 20px 24px; position: relative; overflow: hidden;  background: linear-gradient(135deg, rgba(99,102,241,0.06), rgba(236,72,153,0.06));  border: 1px solid rgba(99,102,241,0.18); border-radius: var(--bento-radius-md, 18px);  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px;  font-family: 'Inter', -apple-system, sans-serif;}
.donate-section::before {  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;  background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);}
.donate-section .donate-text { flex: 1; min-width: 240px; }
.donate-section h3 {  margin: 0 0 6px; font-size: 16px; font-weight: 700; letter-spacing: -0.02em;  background: linear-gradient(135deg, #6366f1, #ec4899);  -webkit-background-clip: text; background-clip: text; color: transparent;}
.donate-section p { margin: 0; font-size: 13px; line-height: 1.55; color: var(--bento-text-secondary, #57534e); letter-spacing: -0.005em; }
.donate-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
.donate-btn {  display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px;  border-radius: 12px; font-weight: 700; font-size: 13px; letter-spacing: -0.005em;  text-decoration: none; transition: transform 0.2s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s, filter 0.2s;  border: 1px solid transparent;}
.donate-btn:hover { transform: translateY(-2px); filter: brightness(1.05); }
.donate-btn.coffee {  background: linear-gradient(135deg, #FFDD00, #FFC700); color: #000;  box-shadow: 0 4px 14px -2px rgba(255, 221, 0, 0.4);}
.donate-btn.coffee:hover { box-shadow: 0 8px 24px -4px rgba(255, 221, 0, 0.55); }
.donate-btn.paypal {  background: linear-gradient(135deg, #0070ba, #005ea6); color: #fff;  box-shadow: 0 4px 14px -2px rgba(0, 112, 186, 0.45);}
.donate-btn.paypal:hover { box-shadow: 0 8px 24px -4px rgba(0, 112, 186, 0.6); }
@media (prefers-color-scheme: dark) {  .donate-section { background: linear-gradient(135deg, rgba(129,140,248,0.10), rgba(244,114,182,0.10)); border-color: rgba(129,140,248,0.25); }  .donate-section h3 { background: linear-gradient(135deg, #a5b4fc, #f9a8d4); -webkit-background-clip: text; background-clip: text; color: transparent; }  .donate-section p { color: #d6d3d1; } }
@media (max-width: 600px) {  .donate-section { flex-direction: column; text-align: center; padding: 18px; }  .donate-buttons { justify-content: center; width: 100%; } }

/* Prereq banner — premium */
.prereq-banner {  display: flex; align-items: flex-start; gap: 14px; padding: 16px 20px;  border-radius: var(--bento-radius-sm, 12px); margin: 0 0 16px;  font-size: 13px; line-height: 1.55; border: 1px solid;  font-family: 'Inter', sans-serif; letter-spacing: -0.005em;  position: relative; overflow: hidden;}
.prereq-banner::before {  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;}
.prereq-banner.prereq-error { background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.25); color: #991b1b; }
.prereq-banner.prereq-error::before { background: linear-gradient(180deg, #ef4444, #f87171); }
.prereq-banner.prereq-info  { background: rgba(99,102,241,0.06); border-color: rgba(99,102,241,0.25); color: #4338ca; }
.prereq-banner.prereq-info::before  { background: linear-gradient(180deg, #6366f1, #8b5cf6); }
.prereq-banner .prereq-icon { font-size: 22px; line-height: 1; padding-top: 2px; flex-shrink: 0; }
.prereq-banner .prereq-text { flex: 1; min-width: 0; }
.prereq-banner .prereq-text strong { font-weight: 700; letter-spacing: -0.01em; }
.prereq-banner code {  background: rgba(0,0,0,0.06); padding: 1px 7px; border-radius: 5px;  font-size: 12px; font-family: 'JetBrains Mono', ui-monospace, monospace;  border: 1px solid rgba(0,0,0,0.08);}
.prereq-banner .prereq-cta {  display: inline-flex; align-items: center; padding: 8px 16px; border-radius: 10px;  background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff !important;  text-decoration: none; font-weight: 700; font-size: 12.5px; flex-shrink: 0;  letter-spacing: -0.005em;  box-shadow: 0 4px 14px -2px rgba(99,102,241,0.45);  transition: all 0.2s cubic-bezier(0.4,0,0.2,1);}
.prereq-banner .prereq-cta:hover { transform: translateY(-1px); box-shadow: 0 8px 24px -4px rgba(99,102,241,0.6); }
@media (prefers-color-scheme: dark) {  .prereq-banner.prereq-error { background: rgba(248,113,113,0.10); border-color: rgba(248,113,113,0.30); color: #fca5a5; }  .prereq-banner.prereq-info  { background: rgba(129,140,248,0.10); border-color: rgba(129,140,248,0.30); color: #c7d2fe; }  .prereq-banner code { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.10); } }
@media (max-width: 600px) {  .prereq-banner { flex-direction: column; align-items: stretch; padding-left: 20px; }  .prereq-banner .prereq-cta { align-self: flex-start; } }

/* First-run intro banner — premium */
.intro-banner {  position: relative; padding: 18px 52px 18px 22px; margin: 0 0 18px;  background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(236,72,153,0.06));  border: 1px solid rgba(99,102,241,0.20);  border-radius: var(--bento-radius-sm, 12px);  font-size: 13px; line-height: 1.55; overflow: hidden;  font-family: 'Inter', sans-serif; letter-spacing: -0.005em;  animation: bentoSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);}
.intro-banner::before {  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;  background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);}
.intro-banner .intro-headline {  font-weight: 700; font-size: 14.5px; margin-bottom: 10px; letter-spacing: -0.02em;  background: linear-gradient(135deg, #6366f1, #ec4899);  -webkit-background-clip: text; background-clip: text; color: transparent;  display: flex; align-items: center; gap: 8px;}
.intro-banner .intro-steps {  margin: 8px 0 0; padding: 0; list-style: none; counter-reset: introstep;}
.intro-banner .intro-steps li {  margin-bottom: 8px; line-height: 1.55; color: var(--bento-text, #0c0a09);  padding-left: 32px; position: relative; counter-increment: introstep;  font-size: 12.5px;}
.intro-banner .intro-steps li::before {  content: counter(introstep); position: absolute; left: 0; top: -1px;  width: 22px; height: 22px; border-radius: 50%;  background: var(--bento-card, #fff); border: 1px solid rgba(99,102,241,0.25);  display: flex; align-items: center; justify-content: center;  font-size: 11px; font-weight: 800; color: #6366f1;  font-family: 'JetBrains Mono', ui-monospace, monospace;  font-feature-settings: 'tnum' 1;}
.intro-banner .intro-dismiss {  position: absolute; top: 12px; right: 14px;  background: var(--bento-card, transparent); border: 1px solid var(--bento-border, transparent);  cursor: pointer; font-size: 14px; line-height: 1;  color: var(--bento-text-secondary, #64748B);  padding: 4px 8px; border-radius: 999px;  transition: all 0.15s ease;}
.intro-banner .intro-dismiss:hover {  background: var(--bento-bg-2, #e7e5e4); color: var(--bento-text, #0c0a09);  transform: rotate(90deg);}
@media (prefers-color-scheme: dark) {  .intro-banner { background: linear-gradient(135deg, rgba(129,140,248,0.14), rgba(244,114,182,0.10)); border-color: rgba(129,140,248,0.30); }  .intro-banner .intro-headline { background: linear-gradient(135deg, #a5b4fc, #f9a8d4); -webkit-background-clip: text; background-clip: text; color: transparent; }  .intro-banner .intro-steps li { color: #fafaf9; }  .intro-banner .intro-steps li::before { background: #16161f; border-color: rgba(129,140,248,0.35); color: #a5b4fc; }  .intro-banner .intro-dismiss { background: #16161f; border-color: #27272f; color: #d6d3d1; }  .intro-banner .intro-dismiss:hover { background: #27272f; color: #fafaf9; } }



/* ===== BENTO DESIGN SYSTEM (local fallback) ===== */

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
  --bento-bg: var(--primary-background-color, #F8FAFC);
  --bento-card: var(--card-background-color, #FFFFFF);
  --bento-border: var(--divider-color, #E2E8F0);
  --bento-text: var(--primary-text-color, #1E293B);
  --bento-text-secondary: var(--secondary-text-color, #64748B);
  --bento-text-muted: var(--disabled-text-color, #94A3B8);
  --bento-radius-xs: 6px;
  --bento-radius-sm: 10px;
  --bento-radius-md: 16px;
  --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
  --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04);
  --bento-shadow-lg: 0 8px 25px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.04);
  --bento-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

:host {
  --pc: var(--bento-primary);
  --ec: var(--bento-error);
  --wc: var(--bento-warning);
  --sc: var(--bento-success);
  --bg: var(--bento-bg);
  --cbg: var(--bento-card);
  --tc: var(--bento-text);
  --ts: var(--bento-text-secondary);
  --dc: var(--bento-border);
  --hov: rgba(59, 130, 246, 0.04);
  --sel: rgba(59, 130, 246, 0.08);
  --radius: var(--bento-radius-md);
  --radius-sm: var(--bento-radius-sm);
  --radius-xs: var(--bento-radius-xs);
  --shadow: var(--bento-shadow-sm);
  --shadow-md: var(--bento-shadow-md);
  --tr: var(--bento-transition);
  display: block;
  color-scheme: light dark;
}
* { box-sizing: border-box; margin: 0; padding: 0; }

.card {
  display: flex; height: 100%; background: var(--bento-card); color: var(--bento-text); container-type: inline-size;
  border-radius: var(--radius); overflow: visible;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  border: 1px solid var(--bento-border); box-shadow: var(--shadow);
}
.col-main { display: flex; flex-direction: column; flex: 1; overflow: hidden; color: var(--bento-text); font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

/* Top bar */
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-bottom: 1px solid var(--bento-border); background: var(--bento-card);
  border-radius: var(--radius) var(--radius) 0 0;
}
.title { font-size: 20px; font-weight: 700; color: var(--bento-text); letter-spacing: -0.01em; }
.topbar-r { display: flex; gap: 8px; align-items: center; }
.btn-s {
  padding: 9px 16px; border: 1.5px solid var(--bento-border); border-radius: var(--radius-sm);
  background: var(--bento-card); color: var(--bento-text); cursor: pointer; font-size: 13px;
  font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--tr); white-space: nowrap;
}
.btn-s:hover { background: var(--bento-bg); border-color: var(--bento-primary); color: var(--bento-primary); }
.btn-act {
  background: var(--bento-primary) !important; color: white !important; border-color: var(--bento-primary) !important;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25) !important;
}

/* Dropdown */
.dd { position: relative; display: inline-block; }
.dd-menu {
  display: none; position: absolute; right: 0; top: 100%; margin-top: 4px;
  background: var(--bento-card); border: 1px solid var(--bento-border); border-radius: var(--radius-sm);
  min-width: 180px; z-index: 100; box-shadow: var(--shadow-md); overflow: hidden;
}
.dd.open .dd-menu { display: block; }
.dd-i {
  padding: 10px 16px; cursor: pointer; font-size: 13px; color: var(--bento-text);
  transition: var(--tr); font-family: 'Inter', sans-serif;
}
.dd-i:hover { background: rgba(59, 130, 246, 0.06); color: var(--bento-primary); }
.dd-div { border-top: 1px solid var(--bento-border); margin: 4px 0; }

/* Controls bar */
.cbar {
  display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px;
  border-bottom: 1px solid var(--bento-border); background: var(--bento-bg); align-items: center;
}
.cg { display: inline-flex; gap: 6px; align-items: center; font-size: 12px; flex-shrink: 0; }
.cg label {
  display: block; font-size: 12px; font-weight: 600; color: var(--bento-text-secondary);
  text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap;
}
.cg select, .cg input {
  width: auto; padding: 6px 10px; border: 1.5px solid var(--bento-border); border-radius: var(--radius-xs);
  background: var(--bento-card); color: var(--bento-text); font-size: 13px;
  font-family: 'Inter', sans-serif; transition: var(--tr); outline: none;
}
.cg select:focus, .cg input:focus { border-color: var(--bento-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.cg-r { margin-left: auto; }

/* Stats */
.stats {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px; padding: 12px 16px; background: var(--bento-bg); border-bottom: 1px solid var(--bento-border);
}
.stat {
  display: flex; flex-direction: column; align-items: center; padding: 12px;
  background: var(--bento-card); border-radius: var(--radius-sm); border: 1px solid var(--bento-border);
  transition: var(--tr); text-align: center;
}
.stat:hover { border-color: var(--bento-primary); box-shadow: var(--shadow-md); transform: translateY(-1px); }
.sv { font-size: 24px; font-weight: 700; color: var(--bento-primary); line-height: 1.2; }
.sl { font-size: 12px; color: var(--bento-text-secondary); font-weight: 500; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
.stat.ok .sv { color: var(--bento-success); }
.stat.err .sv { color: var(--bento-error); }

/* Panels */
.panels { display: flex; flex: 1; overflow: hidden; }
.pan-left {
  width: 280px; min-width: 240px; display: flex; flex-direction: column;
  border-right: 1px solid var(--bento-border); background: var(--bento-card);
}
.pan-center {
  flex: 1; min-width: 280px; display: flex; flex-direction: column;
  border-right: 1px solid var(--bento-border); background: var(--bento-card);
}
.pan-center.expanded { min-width: 360px; }
.pan-right {
  flex: 1.4; min-width: 360px; display: flex; flex-direction: column;
  background: var(--bento-bg); overflow-y: auto;
}
.pan-head {
  padding: 12px 16px; border-bottom: 1px solid var(--bento-border); background: var(--bento-bg);
  display: flex; align-items: center; gap: 8px;
}
.pan-title {
  font-size: 12px; font-weight: 600; color: var(--bento-text-secondary); text-transform: uppercase;
  letter-spacing: 0.04em;
}
.sinput-sm {
  flex: 1; max-width: 180px; padding: 6px 10px; border: 1.5px solid var(--bento-border);
  border-radius: var(--radius-xs); background: var(--bento-card); color: var(--bento-text);
  font-size: 13px; font-family: 'Inter', sans-serif; transition: var(--tr); outline: none;
}
.sinput-sm:focus { border-color: var(--bento-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

/* Search & controls in left panel */
.search-box { padding: 10px 12px; border-bottom: 1px solid var(--bento-border); }
.sinput {
  width: 100%; padding: 9px 14px; border: 1.5px solid var(--bento-border); border-radius: var(--radius-sm);
  background: var(--bento-card); color: var(--bento-text); font-size: 13px;
  font-family: 'Inter', sans-serif; transition: var(--tr); outline: none;
}
.sinput:focus { border-color: var(--bento-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.sinput::placeholder, .sinput-sm::placeholder { color: var(--bento-text-secondary); opacity: 0.7; }
.ctrls { padding: 10px 12px; border-bottom: 1px solid var(--bento-border); display: flex; flex-direction: column; gap: 6px; }
.crow { display: flex; gap: 8px; align-items: center; font-size: 12px; }
.clbl { font-weight: 600; min-width: 55px; color: var(--bento-text-secondary); font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; }
.csel {
  flex: 1; padding: 6px 10px; border: 1.5px solid var(--bento-border); border-radius: var(--radius-xs);
  background: var(--bento-card); color: var(--bento-text); font-size: 13px;
  font-family: 'Inter', sans-serif; transition: var(--tr); outline: none;
}
.csel:focus { border-color: var(--bento-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

/* List */
.list { flex: 1; overflow-y: auto; overflow-x: hidden; border: 1px solid var(--bento-border); border-radius: var(--radius-sm); margin: 0; }
.empty {
  display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  height: 100%; color: var(--bento-text-secondary); gap: 12px; font-size: 14px; padding: 48px 24px;
  font-family: 'Inter', sans-serif;
}
.empty-ico { font-size: 48px; opacity: 0.5; }
.pag {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 16px; font-size: 13px; color: var(--bento-text-secondary); border-bottom: 1px solid var(--bento-border);
}
@container (max-width: 600px) { .pag { display: none !important; } }
.pag-btn {
  padding: 8px 14px; border: 1.5px solid var(--bento-border); border-radius: var(--radius-xs);
  background: var(--bento-card); color: var(--bento-text); cursor: pointer; font-size: 13px;
  font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--tr);
}
.pag-btn:hover:not(:disabled) { background: var(--bento-primary); color: white; border-color: var(--bento-primary); }
.pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pag-info { font-size: 13px; color: var(--bento-text-secondary); font-weight: 500; padding: 0 8px; }
.pag-size {
  padding: 6px 10px; border: 1.5px solid var(--bento-border); border-radius: var(--radius-xs);
  background: var(--bento-card); color: var(--bento-text); font-size: 13px; cursor: pointer;
  font-family: 'Inter', sans-serif;
}

/* Auto items */
.auto-item {
  padding: 12px 16px; border-bottom: 1px solid var(--bento-border); cursor: pointer;
  transition: var(--tr); display: flex; align-items: center; gap: 10px;
  font-family: 'Inter', sans-serif;
}
.auto-item:hover { background: rgba(59, 130, 246, 0.04); }
.auto-item.sel { background: rgba(59, 130, 246, 0.08); border-left: 3px solid var(--bento-primary); padding-left: 13px; }
.auto-item.chk { background: rgba(59, 130, 246, 0.06); }
.auto-name { font-weight: 500; font-size: 13px; color: var(--bento-text); margin-bottom: 2px; line-height: 1.4; }
.auto-meta { display: flex; gap: 8px; font-size: 12px; color: var(--bento-text-secondary); align-items: center; }
.auto-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--bento-text-secondary); display: inline-block; }
.auto-dot.s-running { background: var(--bento-success); color: var(--bento-success); }
.auto-dot.s-stopped { background: var(--bento-text-secondary); color: var(--bento-text-secondary); }
.auto-dot.s-error { background: var(--bento-error); color: var(--bento-error); }
.auto-count {
  background: var(--bento-border); padding: 2px 8px; border-radius: 10px; font-weight: 600;
  font-size: 11px; color: var(--bento-text-secondary); margin-left: auto;
}

/* Trace groups */
.tgroup { border: 1px solid var(--bento-border); border-radius: var(--radius-xs); margin-bottom: 8px; overflow: hidden; }
.tgroup-h {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  background: var(--bento-bg); cursor: pointer; font-size: 13px; font-weight: 600;
  user-select: none; transition: var(--tr); font-family: 'Inter', sans-serif; color: var(--bento-text);
}
.tgroup-h:hover { background: rgba(59, 130, 246, 0.06); }
.tg-tog { font-size: 12px; transition: transform 0.2s; color: var(--bento-text-secondary); }
.tgroup.collapsed .tg-tog { transform: rotate(-90deg); }
.tgroup.collapsed .tgroup-items { display: none; }
.tg-name { flex: 1; font-weight: 600; font-size: 13px; color: var(--bento-text); }
.tg-cnt {
  font-size: 11px; color: var(--bento-text-secondary); margin-left: auto; background: var(--bento-border);
  padding: 2px 8px; border-radius: 10px;
}

/* Trace items */
.tr-item {
  padding: 10px 16px; border-bottom: 1px solid var(--bento-border); cursor: pointer;
  transition: var(--tr); display: flex; align-items: center; gap: 10px;
  font-family: 'Inter', sans-serif;
}
.tr-item:hover { background: rgba(59, 130, 246, 0.04); }
.tr-item.sel { background: rgba(59, 130, 246, 0.08); border-left: 3px solid var(--bento-primary); padding-left: 13px; }
.tr-item.chk { background: rgba(59, 130, 246, 0.06); }
.tr-cb { font-size: 16px; cursor: pointer; user-select: none; }
.tr-ico { font-size: 14px; min-width: 18px; text-align: center; }
.tr-ico.s-success { color: var(--bento-success); }
.tr-ico.s-error { color: var(--bento-error); }
.tr-ico.s-running { color: var(--bento-primary); }
.tr-ico.s-aborted { color: var(--bento-warning); }
.tr-info { flex: 1; min-width: 0; }
.tr-auto { font-size: 12px; font-weight: 600; color: var(--bento-primary); margin-bottom: 2px; }
.tr-time { font-size: 12px; font-weight: 500; color: var(--bento-text); }
.tr-trig { font-size: 11px; color: var(--bento-text-secondary); margin-top: 2px; }
.tr-dur { font-size: 11px; color: var(--bento-text-secondary); white-space: nowrap; font-weight: 600; }

/* Detail panel */
.det-head {
  padding: 16px 20px; border-bottom: 1px solid var(--bento-border); display: flex;
  justify-content: space-between; align-items: flex-start; gap: 12px; background: var(--bento-card);
}
.det-info { flex: 1; min-width: 0; }
.det-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; color: var(--bento-text); letter-spacing: -0.01em; }
.det-time { font-size: 12px; color: var(--bento-text-secondary); }
.det-badge {
  display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px;
  border-radius: 20px; font-size: 11px; font-weight: 600; white-space: nowrap;
  letter-spacing: 0.02em; text-transform: uppercase;
}
.det-dur { margin-left: 4px; opacity: 0.8; }
.det-badge.s-success { background: rgba(16, 185, 129, 0.1); color: #059669; }
.det-badge.s-error { background: rgba(239, 68, 68, 0.1); color: #DC2626; }
.det-badge.s-running { background: rgba(59, 130, 246, 0.1); color: var(--bento-primary); }
.det-badge.s-aborted { background: rgba(245, 158, 11, 0.1); color: #B45309; }

/* Flow graph */
.det-flow {
  padding: 16px 20px; border-bottom: 1px solid var(--bento-border); display: flex;
  justify-content: center; background: var(--bento-bg); overflow-x: auto;
}
.flow-graph { display: block; }

/* Detail tabs */
.det-tabs {
  display: flex; gap: 4px; border-bottom: 2px solid var(--bento-border); padding: 0 16px;
  overflow-x: auto; margin-bottom: 0;
}
.dtab {
  padding: 10px 20px; background: transparent; border: none; border-bottom: 2px solid transparent;
  color: var(--bento-text-secondary); cursor: pointer; font-size: 14px; font-weight: 500;
  transition: var(--tr); margin-bottom: -2px; white-space: nowrap;
  border-radius: 8px 8px 0 0; font-family: 'Inter', sans-serif;
}
.dtab.act { color: var(--bento-primary); border-bottom-color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.dtab:hover { color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }

/* Tab panes */
.det-body { flex: 1; overflow-y: auto; padding: 16px 20px; }
.tab-pane { display: none; animation: fadeSlideIn 0.3s ease-out; }
.tab-pane.act { display: block; }

/* Timeline steps */
.tl-step {
  margin-bottom: 10px; border-left: 3px solid var(--bento-border); padding: 12px 14px;
  background: var(--bento-card); border-radius: 0 var(--radius-xs) var(--radius-xs) 0;
  transition: var(--tr);
}
.tl-step:hover { box-shadow: var(--shadow); }
.tl-step.s-success { border-left-color: var(--bento-success); }
.tl-step.s-error { border-left-color: var(--bento-error); }
.tl-step.s-skipped { border-left-color: var(--bento-text-secondary); opacity: 0.6; }
.tl-head { display: flex; gap: 10px; align-items: center; }
.tl-num {
  width: 24px; height: 24px; border-radius: 50%; color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0;
  font-weight: 600;
}
.tl-title { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.tl-cat { font-size: 10px; font-weight: 700; color: var(--bento-primary); text-transform: uppercase; letter-spacing: 0.04em; }
.tl-desc { font-size: 13px; font-weight: 500; color: var(--bento-text); }
.tl-dur { font-size: 11px; color: var(--bento-text-secondary); white-space: nowrap; font-weight: 600; }
.tl-err {
  margin-top: 8px; padding: 8px 12px; background: rgba(239, 68, 68, 0.08);
  border-radius: var(--radius-xs); font-size: 12px; color: #DC2626;
}
.tl-dets { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px 14px; }
.tl-det { font-size: 11px; color: var(--bento-text-secondary); word-break: break-word; }
.tl-det b { color: var(--bento-text); font-weight: 600; }
.tl-ts { font-size: 10px; color: var(--bento-text-secondary); margin-top: 4px; opacity: 0.6; }

/* Related activity */
.rel-list { display: flex; flex-direction: column; gap: 8px; }
.rel-item {
  padding: 12px 14px; border: 1px solid var(--bento-border); border-radius: var(--radius-xs);
  display: flex; flex-direction: column; gap: 4px; transition: var(--tr);
  background: var(--bento-card);
}
.rel-item:hover { border-color: var(--bento-primary); box-shadow: var(--shadow); }
.rel-entity { font-size: 13px; font-weight: 600; color: var(--bento-primary); }
.rel-action { font-size: 13px; color: var(--bento-text); }
.rel-time { font-size: 11px; color: var(--bento-text-secondary); }

/* Changed vars */
.cv-item {
  margin-bottom: 10px; border: 1px solid var(--bento-border); border-radius: var(--radius-xs);
  overflow: hidden; background: var(--bento-card);
}
.cv-head {
  display: flex; gap: 8px; padding: 8px 12px; background: var(--bento-bg);
  font-size: 12px; align-items: center; border-bottom: 1px solid var(--bento-border);
}
.cv-step { color: var(--bento-primary); font-weight: 700; }
.cv-name { font-weight: 500; color: var(--bento-text); }
.cv-val {
  margin: 0; padding: 10px 12px; font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px; overflow-x: auto; color: var(--bento-text); line-height: 1.5;
  white-space: pre-wrap; word-break: break-word; background: var(--bento-card);
}

/* Config */
.config-header {
  font-size: 12px; font-weight: 600; color: var(--bento-text-secondary); text-transform: uppercase;
  letter-spacing: 0.04em; margin-bottom: 10px;
}
.yaml-content {
  margin: 0; padding: 16px; background: var(--bento-bg); border: 1px solid var(--bento-border);
  border-radius: var(--radius-sm); font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px; overflow-x: auto; color: var(--bento-text); line-height: 1.6;
  max-height: 600px; overflow-y: auto; white-space: pre-wrap; word-break: break-word;
}

/* JSON */
.json-bar { margin-bottom: 8px; display: flex; gap: 8px; }
.json-content {
  margin: 0; padding: 16px; background: var(--bento-bg); border: 1px solid var(--bento-border);
  border-radius: var(--radius-sm); font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px; overflow-x: auto; color: var(--bento-text); line-height: 1.5;
  max-height: 600px; overflow-y: auto;
}

/* Loading spinner */
.spinner {
  width: 32px; height: 32px; border: 3px solid var(--bento-border);
  border-top: 3px solid var(--bento-primary); border-radius: 50%;
  animation: spin 0.8s linear infinite; margin: 24px auto;
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--bento-text-secondary); }

/* Responsive */
@media (max-width: 1200px) { .pan-right { display: none; } }
@media (max-width: 900px) { .pan-left { display: none !important; } .pan-center.expanded { min-width: 100%; } }
@media (max-width: 768px) {
  .stats { grid-template-columns: repeat(2, 1fr); }
  .panels { flex-direction: column; }
  .pan-left { display: block !important; width: 100% !important; max-height: 30vh; overflow-y: auto; border-right: none; border-bottom: 1px solid var(--bento-border); min-width: auto; }
  .pan-center { width: 100% !important; min-width: 0 !important; flex: 1; }
  .pan-right { display: block !important; width: 100% !important; min-width: auto; max-height: none; overflow-y: auto; border-right: none; border-top: 1px solid var(--bento-border); flex: 1; min-height: 300px; }
  .pan-right:empty, .pan-right .empty { display: none; }
}


@media (prefers-color-scheme: dark) {
  :host {
    --bento-bg: var(--primary-background-color, #1a1a2e);
    --bento-card: var(--card-background-color, #16213e);
    --bento-text: var(--primary-text-color, #e2e8f0);
    --bento-text-secondary: var(--secondary-text-color, #94a3b8);
    --bento-border: var(--divider-color, #334155);
    --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
    --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  }
}
/* === DARK MODE ADDED - old comment below === */

        /* === MOBILE FIX === */
        @media (max-width: 768px) {
          .tabs { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; gap: 2px; }
          .tab, .tab-btn, .tab-btn { padding: 6px 10px; font-size: 12px; white-space: nowrap; }
          .card, .card-container { padding: 14px; }
          .stats, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .stat-val, .kpi-val, .metric-val { font-size: 18px; }
          .stat-lbl, .kpi-lbl, .metric-lbl { font-size: 10px; }
          .panels, .board { flex-direction: column; }
          .column { min-width: unset; }
          h2 { font-size: 18px; }
          h3 { font-size: 15px; }
        }
        @media (max-width: 480px) {
          .tabs { gap: 1px; }
          .tab, .tab-btn, .tab-btn { padding: 5px 8px; font-size: 11px; }
          .stats, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid { grid-template-columns: 1fr 1fr; }
          .stat-val, .kpi-val, .metric-val { font-size: 16px; }
        }
      
        /* Settings Info Bar */

/* === Container-based responsive (for dashboard cards) === */
.card.compact-hide-right .pan-right { display: none; }
.card.compact-hide-left .pan-left { display: none !important; }
.card.compact-hide-left .pan-center.expanded { min-width: 100%; }
.card.compact-mobile .stats { grid-template-columns: repeat(2, 1fr); }
.card.compact-mobile .panels { flex-direction: column; }
.card.compact-mobile .pan-left { display: block !important; width: 100% !important; max-height: 30vh; overflow-y: auto; border-right: none; border-bottom: 1px solid var(--bento-border); min-width: auto; }
.card.compact-mobile .pan-center { width: 100% !important; min-width: 0 !important; flex: 1; }
.card.compact-mobile .pan-right { display: block !important; width: 100% !important; min-width: auto; max-height: none; overflow-y: auto; border-right: none; border-top: 1px solid var(--bento-border); flex: 1; min-height: 300px; }
.card.compact-mobile .pan-right:empty, .card.compact-mobile .pan-right .empty { display: none; }
.card.compact-mobile .tabs { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; gap: 2px; }
.card.compact-mobile .tab, .card.compact-mobile .tab-btn { padding: 6px 10px; font-size: 12px; white-space: nowrap; }
.card.compact-mobile .card-container { padding: 14px; }
.card.compact-mobile .stats, .card.compact-mobile .stats-grid, .card.compact-mobile .summary-grid, .card.compact-mobile .stat-cards, .card.compact-mobile .kpi-grid, .card.compact-mobile .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
.card.compact-mobile .stat-val, .card.compact-mobile .kpi-val, .card.compact-mobile .metric-val { font-size: 18px; }
.card.compact-mobile .stat-lbl, .card.compact-mobile .kpi-lbl, .card.compact-mobile .metric-lbl { font-size: 10px; }
.card.compact-mobile .panels, .card.compact-mobile .board { flex-direction: column; }
.card.compact-mobile .column { min-width: unset; }
.card.compact-mobile h2 { font-size: 18px; }
.card.compact-mobile h3 { font-size: 15px; }
.card.compact-xs .tabs { gap: 1px; }
.card.compact-xs .tab, .card.compact-xs .tab-btn { padding: 5px 8px; font-size: 11px; }
.card.compact-xs .stats, .card.compact-xs .stats-grid, .card.compact-xs .summary-grid, .card.compact-xs .stat-cards, .card.compact-xs .kpi-grid, .card.compact-xs .metrics-grid { grid-template-columns: 1fr 1fr; }
.card.compact-xs .stat-val, .card.compact-xs .kpi-val, .card.compact-xs .metric-val { font-size: 16px; }

</style>`;
  }

  // ============================================================

  connectedCallback() {
    if (this._hass) this.updateAutomationData();
    // ResizeObserver for mobile view in small dashboard cards
    this._resizeObserver = new ResizeObserver(() => this._applyCompactClasses());
    this._resizeObserver.observe(this);
  }
  disconnectedCallback() {
    if (this.relativeTimeUpdater) clearInterval(this.relativeTimeUpdater);
    if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
    if (this._expDDClose) { document.removeEventListener('click', this._expDDClose); this._expDDClose = null; }
  }
  static getConfigElement() { return document.createElement('ha-trace-viewer-editor'); }
  getCardSize() { return 10; }

  static getStubConfig() { return { type: 'custom:ha-trace-viewer', title: 'Trace Viewer' }; }
}

if (!customElements.get('ha-trace-viewer')) customElements.define('ha-trace-viewer', HATraceViewer);


if (!customElements.get('ha-tools-panel')) {
  const _cs = document.currentScript?.src || '';
  const _bu = _cs.substring(0, _cs.lastIndexOf('/') + 1);
  if (_bu) { const s = document.createElement('script'); s.src = _bu + 'ha-tools-panel.js'; document.head.appendChild(s); }
}

class HaTraceViewerEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }
  _dispatch() {
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config }, bubbles: true, composed: true }));
  }
  _render() {
    this.shadowRoot.innerHTML = `
      <style>
            :host { display:block; padding:16px; }
            h3 { margin:0 0 16px; font-size:15px; font-weight:600; color:var(--bento-text, var(--primary-text-color,#1e293b)); }
            input { outline:none; transition:border-color .2s; }
            input:focus { border-color:var(--bento-primary, var(--primary-color,#3b82f6)); }
        </style>
      <h3>Trace Viewer</h3>
            <div style="margin-bottom:12px;">
              <label style="display:block;font-weight:500;margin-bottom:4px;font-size:13px;">Title</label>
              <input type="text" id="cf_title" value="${_esc(this._config?.title || 'Trace Viewer')}"
                style="width:100%;padding:8px 12px;border:1px solid var(--divider-color,#e2e8f0);border-radius:8px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#1e293b);font-size:14px;box-sizing:border-box;">
            </div>
    `;
        const f_title = this.shadowRoot.querySelector('#cf_title');
        if (f_title) f_title.addEventListener('input', (e) => {
          this._config = { ...this._config, title: e.target.value };
          this._dispatch();
        });
  }
  connectedCallback() { this._render(); }
}
if (!customElements.get('ha-trace-viewer-editor')) { customElements.define('ha-trace-viewer-editor', HaTraceViewerEditor); }

})();

window.customCards = window.customCards || [];
window.customCards.push({ type: 'ha-trace-viewer', name: 'HA Trace Viewer', description: 'Automation trace viewer for Home Assistant' });