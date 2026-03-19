class HATraceViewer extends HTMLElement {
  constructor() {
    super();
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
      const tv = localStorage.getItem('ha-trace-viewer-pageSize');
      if (tv) return parseInt(tv);
    } catch {}
    return 15;
  }

  _savePageSize(size) {
    try { localStorage.setItem('ha-trace-viewer-pageSize', String(size)); } catch {}
    try {
      const s = localStorage.getItem('ha-tools-settings');
      const settings = s ? JSON.parse(s) : {};
      settings['trace-viewer.pageSize'] = size;
      localStorage.setItem('ha-tools-settings', JSON.stringify(settings));
    } catch {}
  }

  // ═══════════ SETTINGS PERSISTENCE ═══════════

  _loadSetting(key, fallback) {
    try {
      const s = localStorage.getItem('ha-tools-settings');
      if (s) { const p = JSON.parse(s); if (p['trace-viewer.' + key] !== undefined) return p['trace-viewer.' + key]; }
      const v = localStorage.getItem('ha-trace-viewer-' + key);
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

  // ═══════════ TRACE PERSISTENCE ═══════════

  _loadStoredTraces() {
    try {
      const d = localStorage.getItem('ha-trace-viewer-stored');
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
      localStorage.setItem('ha-trace-viewer-stored', JSON.stringify(trimmed));
    } catch (e) {
      console.warn('[Trace Viewer] Could not save traces:', e);
    }
  }

  _loadStoredDetails() {
    try {
      const d = localStorage.getItem('ha-trace-viewer-details');
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
      localStorage.setItem('ha-trace-viewer-details', JSON.stringify(this._storedDetails));
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ TRANSLATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      },
      pl: {
        traceViewer: 'PrzeglÄ…darka ĹšladĂłw', automations: 'Automatyzacje', allTraces: 'Wszystkie',
        traces: 'Ĺšlady', traceDetail: 'SzczegĂłĹ‚y', timeline: 'OĹ› Czasowa', json: 'JSON',
        changes: 'Zmiany', config: 'Konfiguracja', related: 'PowiÄ…zane', flowGraph: 'Graf',
        search: 'Wyszukaj automatyzacje...', searchTraces: 'Wyszukaj Ĺ›lady...',
        noTraces: 'Nie znaleziono Ĺ›ladĂłw', noAutomations: 'Nie znaleziono automatyzacji',
        clickAutomationToView: 'Wybierz automatyzacjÄ™', clickTraceToView: 'Wybierz Ĺ›lad',
        trigger: 'Wyzwalacz', conditions: 'Warunki', actions: 'Akcje',
        status: 'Status', duration: 'Czas', ms: 'ms',
        loading: 'Ĺadowanie...', error: 'BĹ‚Ä…d', success: 'Sukces',
        running: 'Uruchomione', aborted: 'Przerwane', stopped: 'Zatrzymane',
        sortBy: 'Sortuj:', sortName: 'Nazwa (A-Z)', sortLastTriggered: 'Ostatnie',
        sortTriggerCount: 'Liczba ĹšladĂłw',
        filterByStatus: 'Status:', allStatuses: 'Wszystkie', statusRunning: 'WĹ‚.',
        statusStopped: 'WyĹ‚.', statusError: 'BĹ‚Ä…d',
        justNow: 'Teraz', minutesAgo: 'm temu', hoursAgo: 'h temu', daysAgo: 'd temu',
        groupBy: 'Grupuj:', groupAutomation: 'Automatyzacja', groupResult: 'Rezultat', groupTrigger: 'Wyzwalacz',
        timeRange: 'Czas:', timeAll: 'CaĹ‚y', time1h: '1h', time6h: '6h',
        time24h: '24h', time7d: '7d', time30d: '30d', timeCustom: 'WĹ‚asny...',
        export: 'Eksport', exportJson: 'JSON', exportCsv: 'CSV',
        selectAll: 'Wszystkie', selected: 'wybranych', refresh: 'OdĹ›wieĹĽ',
        totalTraces: 'Ĺ‚Ä…cznie', successRate: 'sukces', avgDuration: 'Ĺ›rednio',
        changedVariables: 'Zmienione Zmienne', noChanges: 'Brak zmian zmiennych',
        viewMode: 'Widok:', byAutomation: 'Wg Automatyzacji', flatList: 'Wszystkie',
        executedAt: 'Wykonano:', finishedAt: 'ZakoĹ„czono o', runtime: 'czas wykonania',
        triggeredBy: 'Wyzwolone przez', testCondition: 'Warunek',
        performAction: 'Wykonaj akcjÄ™', automationConfig: 'Konfiguracja Automatyzacji',
        relatedActivity: 'PowiÄ…zana AktywnoĹ›Ä‡', noRelatedActivity: 'Brak powiÄ…zanej aktywnoĹ›ci',
        entityChanged: 'zmieniono na', triggeredByAction: 'wyzwolone przez akcjÄ™',
        copyJson: 'Kopiuj', copied: 'Skopiowano!',
        selectMode: 'Zaznacz', cancel: 'Anuluj',
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
    const firstLoad = !this._hass;
    this._hass = hass;
    if (firstLoad) {
      this._allTraces = [];
      this._traceMap = {};
      this.updateAutomationData();
    }
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ DATA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ FILTERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ TIME HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ ACTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ TRACE DETAIL BUILDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ FLOW GRAPH (SVG) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

      // Node colors
      let fill, stroke, textFill;
      if (step.category === 'trigger') { fill = 'rgba(59,130,246,0.12)'; stroke = '#3B82F6'; textFill = '#3B82F6'; }
      else if (step.category === 'condition') {
        if (step.status === 'skipped') { fill = 'rgba(100,116,139,0.08)'; stroke = '#94A3B8'; textFill = '#94A3B8'; }
        else { fill = 'rgba(245,158,11,0.12)'; stroke = '#F59E0B'; textFill = '#B45309'; }
      }
      else if (step.category === 'result') { fill = step.status === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'; stroke = step.status === 'success' ? '#10B981' : '#EF4444'; textFill = stroke; }
      else if (step.status === 'error') { fill = 'rgba(239,68,68,0.12)'; stroke = '#EF4444'; textFill = '#EF4444'; }
      else { fill = 'rgba(16,185,129,0.1)'; stroke = '#10B981'; textFill = '#1E293B'; }

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ EXPORT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ SAFE JSON â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  _safeJson(obj) {
    try {
      const seen = new WeakSet();
      return JSON.stringify(obj, (k, v) => {
        if (typeof v === 'object' && v !== null) { if (seen.has(v)) return '[Circular]'; seen.add(v); }
        return v;
      }, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    } catch (e) { return 'Error: ' + e.message; }
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ STATUS HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  _ico(s) { return s === 'success' ? '\u2714' : s === 'running' ? '\u21BB' : s === 'error' ? '\u274C' : s === 'aborted' ? '\u23F9' : '\u2753'; }
  _sLabel(s) { return this._t(s) || s; }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ RENDER: AUTOMATIONS LIST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  _renderAutoList() {
    if (!this.automations.length) return `<div class="empty"><div class="empty-ico">\u26A0</div><div>${this._t('noAutomations')}</div></div>`;

    const ps = this.autoPageSize;
    const totalPages = Math.ceil(this.automations.length / ps);
    if (this.autoPage >= totalPages) this.autoPage = Math.max(0, totalPages - 1);
    const pageList = this.automations.slice(this.autoPage * ps, (this.autoPage + 1) * ps);

    const pag = totalPages > 1 ? `<div class="pag">
      <button class="pag-btn" data-apdir="-1" ${this.autoPage === 0 ? 'disabled' : ''}>\u2039</button>
      <span class="pag-info">${this.autoPage + 1}/${totalPages} (${this.automations.length})</span>
      <button class="pag-btn" data-apdir="1" ${this.autoPage >= totalPages - 1 ? 'disabled' : ''}>\u203A</button>
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
          <div class="auto-name">${a.name}</div>
          <div class="auto-meta">
            <span class="auto-dot s-${a.status}">\u25CF</span>
            <span data-ts="${a.lastTriggered?.toISOString() || ''}">${a.lastTriggered ? this._relTime(a.lastTriggered) : 'Never'}</span>
            <span class="auto-count">${a.triggerCount}</span>
          </div>
        </div>
      </div>`;
    }).join('')}</div>` + pag;
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ RENDER: TRACES LIST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            <span class="tg-tog">\u25BC</span><span class="tg-name">${g.name}</span>
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ RENDER: DETAIL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  _renderDetail() {
    if (!this.traceDetail) {
      if (this.selectedTrace) return `<div class="empty"><div class="spinner"></div><div>${this._t('loading')}</div></div>`;
      return `<div class="empty"><div class="empty-ico">\u261A</div><div>${this._t('clickTraceToView')}</div></div>`;
    }

    const { trace, steps, changedVars, rawData, configYaml, relatedEntities } = this.traceDetail;
    const tabs = ['timeline', 'related', 'changes', 'config', 'json'];
    const tabLabels = { timeline: this._t('timeline'), related: `${this._t('related')} (${relatedEntities.length})`,
      changes: `${this._t('changes')} (${changedVars.length})`, config: this._t('config'), json: this._t('json') };

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
        ${tabs.map(t => `<button class="dtab ${this.detailTab === t ? 'act' : ''}" data-dtab="${t}">${tabLabels[t]}</button>`).join('')}
      </div>

      <!-- Tab content -->
      <div class="det-body">
        <!-- TIMELINE -->
        <div class="tab-pane ${this.detailTab === 'timeline' ? 'act' : ''}" id="tp-timeline">
          ${steps.map((s, i) => `
            <div class="tl-step s-${s.status}">
              <div class="tl-head">
                <div class="tl-num" style="background:${s.category === 'trigger' ? '#3B82F6' : s.category === 'condition' ? '#F59E0B' : s.category === 'result' ? (s.status === 'success' ? '#10B981' : '#EF4444') : s.status === 'error' ? '#EF4444' : '#10B981'}">${s.icon}</div>
                <div class="tl-title">
                  <span class="tl-cat">${s.category.toUpperCase()}</span>
                  <span class="tl-desc">${s.description}</span>
                </div>
                <span class="tl-dur">${s.duration > 0 ? this._fmtDur(s.duration) : ''}</span>
              </div>
              ${s.error ? `<div class="tl-err">\u26A0 ${typeof s.error === 'string' ? s.error : JSON.stringify(s.error)}</div>` : ''}
              ${Object.keys(s.details).length > 0 ? `<div class="tl-dets">${Object.entries(s.details).filter(([,v]) => v !== undefined && v !== null).map(([k, v]) =>
                `<span class="tl-det"><b>${k}:</b> ${typeof v === 'object' ? JSON.stringify(v) : v}</span>`
              ).join('')}</div>` : ''}
              ${s.timestamp ? `<div class="tl-ts">${this._fmtTimeShort(s.timestamp)}</div>` : ''}
            </div>
          `).join('')}
        </div>

        <!-- RELATED ACTIVITY -->
        <div class="tab-pane ${this.detailTab === 'related' ? 'act' : ''}" id="tp-related">
          ${relatedEntities.length === 0 ? `<div class="empty" style="height:auto;padding:24px">${this._t('noRelatedActivity')}</div>` :
          `<div class="rel-list">${relatedEntities.map(r => `
            <div class="rel-item">
              <div class="rel-entity">${r.friendlyName || r.entity}</div>
              <div class="rel-action">${r.action}</div>
              ${r.time ? `<div class="rel-time">${this._fmtTimeShort(r.time)}</div>` : ''}
            </div>
          `).join('')}</div>`}
        </div>

        <!-- CHANGES -->
        <div class="tab-pane ${this.detailTab === 'changes' ? 'act' : ''}" id="tp-changes">
          ${changedVars.length === 0 ? `<div class="empty" style="height:auto;padding:24px">${this._t('noChanges')}</div>` :
          changedVars.map(cv => `
            <div class="cv-item">
              <div class="cv-head"><span class="cv-step">${cv.step}</span><span class="cv-name">${cv.variable}</span></div>
              <pre class="cv-val">${this._safeJson(cv.value)}</pre>
            </div>
          `).join('')}
        </div>

        <!-- CONFIG -->
        <div class="tab-pane ${this.detailTab === 'config' ? 'act' : ''}" id="tp-config">
          <div class="config-header">${this._t('automationConfig')}</div>
          <pre class="yaml-content">${this._escHtml(configYaml)}</pre>
        </div>

        <!-- JSON -->
        <div class="tab-pane ${this.detailTab === 'json' ? 'act' : ''}" id="tp-json">
          <div class="json-bar"><button class="btn-s" id="cpJson">\u{1F4CB} ${this._t('copyJson')}</button></div>
          <pre class="json-content">${this._safeJson(rawData)}</pre>
        </div>
      </div>
    `;
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ MAIN RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  render() {
    const selN = this.selectedTraceIds.size;
    this.shadowRoot.innerHTML = `${this._css()}
    <div class="card">
      <div class="col-main">
        <!-- TOP BAR -->
        <div class="topbar">
          <span class="title">${this.config.title || this._t('traceViewer')}</span>
          <div class="topbar-r">
            <span style="font-size:11px;color:var(--ts);padding:4px 8px;background:var(--bg);border-radius:var(--radius-xs);border:1px solid var(--dc)">\u{1F4BE} ${this._getStoredTraceCount()} saved</span>
            <button class="btn-s" id="refreshBtn">\u21BB</button>
            <div class="dd" id="expDD">
              <button class="btn-s" id="expBtn">${this._t('export')} \u25BE</button>
              <div class="dd-menu">
                ${selN > 0 ? `<div class="dd-i" data-exp="sel-json">JSON (${selN} traces ${this._t('selected')})</div><div class="dd-i" data-exp="sel-csv">CSV (${selN} traces ${this._t('selected')})</div><div class="dd-div"></div>` : ''}
                ${this.selectedAutoIds.size > 0 ? `<div class="dd-i" data-exp="auto-json">JSON (${this.selectedAutoIds.size} ${this._t('automations')})</div><div class="dd-i" data-exp="auto-csv">CSV (${this.selectedAutoIds.size} ${this._t('automations')})</div><div class="dd-div"></div>` : ''}
                <div class="dd-i" data-exp="all-json">${this._t('exportJson')}</div>
                <div class="dd-i" data-exp="all-csv">${this._t('exportCsv')}</div>
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
              <span style="font-size:12px;color:var(--ts);font-weight:500">${this.selectedAutoIds.size}A + ${this.selectedTraceIds.size}T</span>
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
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ EVENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  _bindEvents() {
    const $ = s => this.shadowRoot.querySelector(s);
    const $$ = s => this.shadowRoot.querySelectorAll(s);

    $('#refreshBtn')?.addEventListener('click', () => this.updateAutomationData());

    // Export dropdown
    $('#expBtn')?.addEventListener('click', e => {
      e.stopPropagation();
      const dd = $('#expDD'); dd.classList.toggle('open');
      const close = () => { dd.classList.remove('open'); document.removeEventListener('click', close); };
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ STYLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  _css() {
    return `<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:host {
  --pc: #3B82F6;
  --ec: #EF4444;
  --wc: #F59E0B;
  --sc: #10B981;
  --bg: #F8FAFC;
  --cbg: #FFFFFF;
  --tc: #1E293B;
  --ts: #64748B;
  --dc: #E2E8F0;
  --hov: rgba(59, 130, 246, 0.04);
  --sel: rgba(59, 130, 246, 0.08);
  --radius: 16px;
  --radius-sm: 10px;
  --radius-xs: 6px;
  --shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
  --tr: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: block;
  color-scheme: light !important;
}
* { box-sizing: border-box; margin: 0; padding: 0; }

.card {
  display: flex; height: 100%; background: var(--cbg); color: var(--tc);
  border-radius: var(--radius); overflow: hidden;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  border: 1px solid var(--dc); box-shadow: var(--shadow);
}
.col-main { display: flex; flex-direction: column; flex: 1; overflow: hidden; color: var(--tc); font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

/* Top bar */
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-bottom: 1px solid var(--dc); background: var(--cbg);
}
.title { font-size: 20px; font-weight: 700; color: var(--tc); letter-spacing: -0.01em; }
.topbar-r { display: flex; gap: 8px; align-items: center; }
.btn-s {
  padding: 9px 16px; border: 1.5px solid var(--dc); border-radius: var(--radius-sm);
  background: var(--cbg); color: var(--tc); cursor: pointer; font-size: 13px;
  font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--tr); white-space: nowrap;
}
.btn-s:hover { background: var(--bg); border-color: var(--pc); color: var(--pc); }
.btn-act {
  background: var(--pc) !important; color: white !important; border-color: var(--pc) !important;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25) !important;
}

/* Dropdown */
.dd { position: relative; display: inline-block; }
.dd-menu {
  display: none; position: absolute; right: 0; top: 100%; margin-top: 4px;
  background: var(--cbg); border: 1px solid var(--dc); border-radius: var(--radius-sm);
  min-width: 180px; z-index: 100; box-shadow: var(--shadow-md); overflow: hidden;
}
.dd.open .dd-menu { display: block; }
.dd-i {
  padding: 10px 16px; cursor: pointer; font-size: 13px; color: var(--tc);
  transition: var(--tr); font-family: 'Inter', sans-serif;
}
.dd-i:hover { background: rgba(59, 130, 246, 0.06); color: var(--pc); }
.dd-div { border-top: 1px solid var(--dc); margin: 4px 0; }

/* Controls bar */
.cbar {
  display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px;
  border-bottom: 1px solid var(--dc); background: var(--bg); align-items: center;
}
.cg { display: flex; gap: 8px; align-items: center; font-size: 12px; }
.cg label {
  display: block; font-size: 12px; font-weight: 600; color: var(--ts);
  text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap;
}
.cg select, .cg input {
  padding: 6px 10px; border: 1.5px solid var(--dc); border-radius: var(--radius-xs);
  background: var(--cbg); color: var(--tc); font-size: 13px;
  font-family: 'Inter', sans-serif; transition: var(--tr); outline: none;
}
.cg select:focus, .cg input:focus { border-color: var(--pc); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.cg-r { margin-left: auto; }

/* Stats */
.stats {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px; padding: 12px 16px; background: var(--bg); border-bottom: 1px solid var(--dc);
}
.stat {
  display: flex; flex-direction: column; align-items: center; padding: 12px;
  background: var(--cbg); border-radius: var(--radius-sm); border: 1px solid var(--dc);
  transition: var(--tr); text-align: center;
}
.stat:hover { border-color: var(--pc); box-shadow: var(--shadow-md); transform: translateY(-1px); }
.sv { font-size: 24px; font-weight: 700; color: var(--pc); line-height: 1.2; }
.sl { font-size: 12px; color: var(--ts); font-weight: 500; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
.stat.ok .sv { color: var(--sc); }
.stat.err .sv { color: var(--ec); }

/* Panels */
.panels { display: flex; flex: 1; overflow: hidden; }
.pan-left {
  width: 280px; min-width: 240px; display: flex; flex-direction: column;
  border-right: 1px solid var(--dc); background: var(--cbg);
}
.pan-center {
  flex: 1; min-width: 280px; display: flex; flex-direction: column;
  border-right: 1px solid var(--dc); background: var(--cbg);
}
.pan-center.expanded { min-width: 360px; }
.pan-right {
  flex: 1.4; min-width: 360px; display: flex; flex-direction: column;
  background: var(--bg); overflow-y: auto;
}
.pan-head {
  padding: 12px 16px; border-bottom: 1px solid var(--dc); background: var(--bg);
  display: flex; align-items: center; gap: 8px;
}
.pan-title {
  font-size: 12px; font-weight: 600; color: var(--ts); text-transform: uppercase;
  letter-spacing: 0.04em;
}
.sinput-sm {
  flex: 1; max-width: 180px; padding: 6px 10px; border: 1.5px solid var(--dc);
  border-radius: var(--radius-xs); background: var(--cbg); color: var(--tc);
  font-size: 13px; font-family: 'Inter', sans-serif; transition: var(--tr); outline: none;
}
.sinput-sm:focus { border-color: var(--pc); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

/* Search & controls in left panel */
.search-box { padding: 10px 12px; border-bottom: 1px solid var(--dc); }
.sinput {
  width: 100%; padding: 9px 14px; border: 1.5px solid var(--dc); border-radius: var(--radius-sm);
  background: var(--cbg); color: var(--tc); font-size: 13px;
  font-family: 'Inter', sans-serif; transition: var(--tr); outline: none;
}
.sinput:focus { border-color: var(--pc); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.sinput::placeholder, .sinput-sm::placeholder { color: var(--ts); opacity: 0.7; }
.ctrls { padding: 10px 12px; border-bottom: 1px solid var(--dc); display: flex; flex-direction: column; gap: 6px; }
.crow { display: flex; gap: 8px; align-items: center; font-size: 12px; }
.clbl { font-weight: 600; min-width: 55px; color: var(--ts); font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; }
.csel {
  flex: 1; padding: 6px 10px; border: 1.5px solid var(--dc); border-radius: var(--radius-xs);
  background: var(--cbg); color: var(--tc); font-size: 13px;
  font-family: 'Inter', sans-serif; transition: var(--tr); outline: none;
}
.csel:focus { border-color: var(--pc); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

/* List */
.list { flex: 1; overflow-y: auto; overflow-x: hidden; border: 1px solid var(--dc); border-radius: var(--radius-sm); margin: 0; }
.empty {
  display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  height: 100%; color: var(--ts); gap: 12px; font-size: 14px; padding: 48px 24px;
  font-family: 'Inter', sans-serif;
}
.empty-ico { font-size: 48px; opacity: 0.5; }
.pag {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 16px; font-size: 13px; color: var(--ts); border-bottom: 1px solid var(--dc);
}
.pag-btn {
  padding: 8px 14px; border: 1.5px solid var(--dc); border-radius: var(--radius-xs);
  background: var(--cbg); color: var(--tc); cursor: pointer; font-size: 13px;
  font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--tr);
}
.pag-btn:hover:not(:disabled) { background: var(--pc); color: white; border-color: var(--pc); }
.pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pag-info { font-size: 13px; color: var(--ts); font-weight: 500; padding: 0 8px; }
.pag-size {
  padding: 6px 10px; border: 1.5px solid var(--dc); border-radius: var(--radius-xs);
  background: var(--cbg); color: var(--tc); font-size: 13px; cursor: pointer;
  font-family: 'Inter', sans-serif;
}

/* Auto items */
.auto-item {
  padding: 12px 16px; border-bottom: 1px solid var(--dc); cursor: pointer;
  transition: var(--tr); display: flex; align-items: center; gap: 10px;
  font-family: 'Inter', sans-serif;
}
.auto-item:hover { background: rgba(59, 130, 246, 0.04); }
.auto-item.sel { background: rgba(59, 130, 246, 0.08); border-left: 3px solid var(--pc); padding-left: 13px; }
.auto-item.chk { background: rgba(59, 130, 246, 0.06); }
.auto-name { font-weight: 500; font-size: 13px; color: var(--tc); margin-bottom: 2px; line-height: 1.4; }
.auto-meta { display: flex; gap: 8px; font-size: 12px; color: var(--ts); align-items: center; }
.auto-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ts); display: inline-block; }
.auto-dot.s-running { background: var(--sc); color: var(--sc); }
.auto-dot.s-stopped { background: var(--ts); color: var(--ts); }
.auto-dot.s-error { background: var(--ec); color: var(--ec); }
.auto-count {
  background: var(--dc); padding: 2px 8px; border-radius: 10px; font-weight: 600;
  font-size: 11px; color: var(--ts); margin-left: auto;
}

/* Trace groups */
.tgroup { border: 1px solid var(--dc); border-radius: var(--radius-xs); margin-bottom: 8px; overflow: hidden; }
.tgroup-h {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  background: var(--bg); cursor: pointer; font-size: 13px; font-weight: 600;
  user-select: none; transition: var(--tr); font-family: 'Inter', sans-serif; color: var(--tc);
}
.tgroup-h:hover { background: rgba(59, 130, 246, 0.06); }
.tg-tog { font-size: 12px; transition: transform 0.2s; color: var(--ts); }
.tgroup.collapsed .tg-tog { transform: rotate(-90deg); }
.tgroup.collapsed .tgroup-items { display: none; }
.tg-name { flex: 1; font-weight: 600; font-size: 13px; color: var(--tc); }
.tg-cnt {
  font-size: 11px; color: var(--ts); margin-left: auto; background: var(--dc);
  padding: 2px 8px; border-radius: 10px;
}

/* Trace items */
.tr-item {
  padding: 10px 16px; border-bottom: 1px solid var(--dc); cursor: pointer;
  transition: var(--tr); display: flex; align-items: center; gap: 10px;
  font-family: 'Inter', sans-serif;
}
.tr-item:hover { background: rgba(59, 130, 246, 0.04); }
.tr-item.sel { background: rgba(59, 130, 246, 0.08); border-left: 3px solid var(--pc); padding-left: 13px; }
.tr-item.chk { background: rgba(59, 130, 246, 0.06); }
.tr-cb { font-size: 16px; cursor: pointer; user-select: none; }
.tr-ico { font-size: 14px; min-width: 18px; text-align: center; }
.tr-ico.s-success { color: var(--sc); }
.tr-ico.s-error { color: var(--ec); }
.tr-ico.s-running { color: var(--pc); }
.tr-ico.s-aborted { color: var(--wc); }
.tr-info { flex: 1; min-width: 0; }
.tr-auto { font-size: 12px; font-weight: 600; color: var(--pc); margin-bottom: 2px; }
.tr-time { font-size: 12px; font-weight: 500; color: var(--tc); }
.tr-trig { font-size: 11px; color: var(--ts); margin-top: 2px; }
.tr-dur { font-size: 11px; color: var(--ts); white-space: nowrap; font-weight: 600; }

/* Detail panel */
.det-head {
  padding: 16px 20px; border-bottom: 1px solid var(--dc); display: flex;
  justify-content: space-between; align-items: flex-start; gap: 12px; background: var(--cbg);
}
.det-info { flex: 1; min-width: 0; }
.det-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; color: var(--tc); letter-spacing: -0.01em; }
.det-time { font-size: 12px; color: var(--ts); }
.det-badge {
  display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px;
  border-radius: 20px; font-size: 11px; font-weight: 600; white-space: nowrap;
  letter-spacing: 0.02em; text-transform: uppercase;
}
.det-dur { margin-left: 4px; opacity: 0.8; }
.det-badge.s-success { background: rgba(16, 185, 129, 0.1); color: #059669; }
.det-badge.s-error { background: rgba(239, 68, 68, 0.1); color: #DC2626; }
.det-badge.s-running { background: rgba(59, 130, 246, 0.1); color: var(--pc); }
.det-badge.s-aborted { background: rgba(245, 158, 11, 0.1); color: #B45309; }

/* Flow graph */
.det-flow {
  padding: 16px 20px; border-bottom: 1px solid var(--dc); display: flex;
  justify-content: center; background: var(--bg); overflow-x: auto;
}
.flow-graph { display: block; }

/* Detail tabs */
.det-tabs {
  display: flex; gap: 4px; border-bottom: 2px solid var(--dc); padding: 0 16px;
  overflow-x: auto; margin-bottom: 0;
}
.dtab {
  padding: 10px 20px; background: transparent; border: none; border-bottom: 2px solid transparent;
  color: var(--ts); cursor: pointer; font-size: 14px; font-weight: 500;
  transition: var(--tr); margin-bottom: -2px; white-space: nowrap;
  border-radius: 8px 8px 0 0; font-family: 'Inter', sans-serif;
}
.dtab.act { color: var(--pc); border-bottom-color: var(--pc); background: rgba(59, 130, 246, 0.04); }
.dtab:hover { color: var(--pc); background: rgba(59, 130, 246, 0.04); }

/* Tab panes */
.det-body { flex: 1; overflow-y: auto; padding: 16px 20px; }
.tab-pane { display: none; animation: fadeSlideIn 0.3s ease-out; }
.tab-pane.act { display: block; }

/* Timeline steps */
.tl-step {
  margin-bottom: 10px; border-left: 3px solid var(--dc); padding: 12px 14px;
  background: var(--cbg); border-radius: 0 var(--radius-xs) var(--radius-xs) 0;
  transition: var(--tr);
}
.tl-step:hover { box-shadow: var(--shadow); }
.tl-step.s-success { border-left-color: var(--sc); }
.tl-step.s-error { border-left-color: var(--ec); }
.tl-step.s-skipped { border-left-color: var(--ts); opacity: 0.6; }
.tl-head { display: flex; gap: 10px; align-items: center; }
.tl-num {
  width: 24px; height: 24px; border-radius: 50%; color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0;
  font-weight: 600;
}
.tl-title { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.tl-cat { font-size: 10px; font-weight: 700; color: var(--pc); text-transform: uppercase; letter-spacing: 0.04em; }
.tl-desc { font-size: 13px; font-weight: 500; color: var(--tc); }
.tl-dur { font-size: 11px; color: var(--ts); white-space: nowrap; font-weight: 600; }
.tl-err {
  margin-top: 8px; padding: 8px 12px; background: rgba(239, 68, 68, 0.08);
  border-radius: var(--radius-xs); font-size: 12px; color: #DC2626;
}
.tl-dets { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px 14px; }
.tl-det { font-size: 11px; color: var(--ts); word-break: break-word; }
.tl-det b { color: var(--tc); font-weight: 600; }
.tl-ts { font-size: 10px; color: var(--ts); margin-top: 4px; opacity: 0.6; }

/* Related activity */
.rel-list { display: flex; flex-direction: column; gap: 8px; }
.rel-item {
  padding: 12px 14px; border: 1px solid var(--dc); border-radius: var(--radius-xs);
  display: flex; flex-direction: column; gap: 4px; transition: var(--tr);
  background: var(--cbg);
}
.rel-item:hover { border-color: var(--pc); box-shadow: var(--shadow); }
.rel-entity { font-size: 13px; font-weight: 600; color: var(--pc); }
.rel-action { font-size: 13px; color: var(--tc); }
.rel-time { font-size: 11px; color: var(--ts); }

/* Changed vars */
.cv-item {
  margin-bottom: 10px; border: 1px solid var(--dc); border-radius: var(--radius-xs);
  overflow: hidden; background: var(--cbg);
}
.cv-head {
  display: flex; gap: 8px; padding: 8px 12px; background: var(--bg);
  font-size: 12px; align-items: center; border-bottom: 1px solid var(--dc);
}
.cv-step { color: var(--pc); font-weight: 700; }
.cv-name { font-weight: 500; color: var(--tc); }
.cv-val {
  margin: 0; padding: 10px 12px; font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px; overflow-x: auto; color: var(--tc); line-height: 1.5;
  white-space: pre-wrap; word-break: break-word; background: var(--cbg);
}

/* Config */
.config-header {
  font-size: 12px; font-weight: 600; color: var(--ts); text-transform: uppercase;
  letter-spacing: 0.04em; margin-bottom: 10px;
}
.yaml-content {
  margin: 0; padding: 16px; background: var(--bg); border: 1px solid var(--dc);
  border-radius: var(--radius-sm); font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px; overflow-x: auto; color: var(--tc); line-height: 1.6;
  max-height: 600px; overflow-y: auto; white-space: pre-wrap; word-break: break-word;
}

/* JSON */
.json-bar { margin-bottom: 8px; display: flex; gap: 8px; }
.json-content {
  margin: 0; padding: 16px; background: var(--bg); border: 1px solid var(--dc);
  border-radius: var(--radius-sm); font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px; overflow-x: auto; color: var(--tc); line-height: 1.5;
  max-height: 600px; overflow-y: auto;
}

/* Loading spinner */
.spinner {
  width: 32px; height: 32px; border: 3px solid var(--dc);
  border-top: 3px solid var(--pc); border-radius: 50%;
  animation: spin 0.8s linear infinite; margin: 24px auto;
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--dc); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--ts); }

/* Responsive */
@media (max-width: 1200px) { .pan-right { display: none; } }
@media (max-width: 900px) { .pan-left { display: none !important; } .pan-center.expanded { min-width: 100%; } }
@media (max-width: 768px) { 
  .stats { grid-template-columns: repeat(2, 1fr); } 
  .panels { flex-direction: column; } 
  .pan-left { display: block !important; width: 100% !important; max-height: 200px; overflow-y: auto; border-right: none; border-bottom: 1px solid var(--dc); min-width: auto; }
  .pan-center { width: 100% !important; min-width: 0 !important; flex: 1; }
  .pan-right { display: none !important; }
}
</style>`;
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ LIFECYCLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  connectedCallback() { if (this._hass) this.updateAutomationData(); }
  disconnectedCallback() { if (this.relativeTimeUpdater) clearInterval(this.relativeTimeUpdater); }
  static getConfigElement() { return document.createElement('ha-trace-viewer-editor'); }
  static getStubConfig() { return { type: 'custom:ha-trace-viewer', title: 'Trace Viewer' }; }
}

customElements.define('ha-trace-viewer', HATraceViewer);

if (!customElements.get('ha-tools-panel')) {
  const _cs = document.currentScript?.src || '';
  const _bu = _cs.substring(0, _cs.lastIndexOf('/') + 1);
  if (_bu) { const s = document.createElement('script'); s.src = _bu + 'ha-tools-panel.js'; document.head.appendChild(s); }
}
