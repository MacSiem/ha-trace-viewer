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
    this.selectMode = false;
    this.tracePage = 0;
    this.tracePageSize = this._loadPageSize();

    // Auto-refresh
    this.relativeTimeUpdater = null;
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
    try {
      this._allTraces = await this._hass.callWS({ type: 'trace/list', domain: 'automation' });
    } catch (e) {
      console.warn('[Trace Viewer] Could not fetch traces:', e);
      this._allTraces = [];
    }

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
      this.traceDetail = this._buildDetail(trace, detail);
    } catch (e) {
      this.traceDetail = {
        trace, steps: [], changedVars: [], rawData: { error: e.message },
        configYaml: '', relatedEntities: []
      };
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
      if (step.category === 'trigger') { fill = 'rgba(52,152,219,0.15)'; stroke = '#3498db'; textFill = '#3498db'; }
      else if (step.category === 'condition') {
        if (step.status === 'skipped') { fill = 'rgba(189,189,189,0.1)'; stroke = '#999'; textFill = '#999'; }
        else { fill = 'rgba(243,156,18,0.15)'; stroke = '#f39c12'; textFill = '#f39c12'; }
      }
      else if (step.category === 'result') { fill = step.status === 'success' ? 'rgba(39,174,96,0.15)' : 'rgba(231,76,60,0.15)'; stroke = step.status === 'success' ? '#27ae60' : '#e74c3c'; textFill = stroke; }
      else if (step.status === 'error') { fill = 'rgba(231,76,60,0.15)'; stroke = '#e74c3c'; textFill = '#e74c3c'; }
      else { fill = 'rgba(39,174,96,0.12)'; stroke = '#27ae60'; textFill = 'var(--text-color)'; }

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
    return `<div class="list">${this.automations.map(a => `
      <div class="auto-item ${this.selectedAutomation === a.entity ? 'sel' : ''} s-${a.status}" data-auto="${a.entity}">
        <div class="auto-name">${a.name}</div>
        <div class="auto-meta">
          <span class="auto-dot s-${a.status}">\u25CF</span>
          <span data-ts="${a.lastTriggered?.toISOString() || ''}">${a.lastTriggered ? this._relTime(a.lastTriggered) : 'Never'}</span>
          <span class="auto-count">${a.triggerCount}</span>
        </div>
      </div>
    `).join('')}</div>`;
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
                <div class="tl-num" style="background:${s.category === 'trigger' ? '#3498db' : s.category === 'condition' ? '#f39c12' : s.category === 'result' ? (s.status === 'success' ? '#27ae60' : '#e74c3c') : s.status === 'error' ? '#e74c3c' : '#27ae60'}">${s.icon}</div>
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
            <button class="btn-s" id="refreshBtn">\u21BB</button>
            <div class="dd" id="expDD">
              <button class="btn-s" id="expBtn">${this._t('export')} \u25BE</button>
              <div class="dd-menu">
                ${selN > 0 ? `<div class="dd-i" data-exp="sel-json">JSON (${selN} ${this._t('selected')})</div><div class="dd-i" data-exp="sel-csv">CSV (${selN} ${this._t('selected')})</div><div class="dd-div"></div>` : ''}
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
            ${this.selectMode ? `<button class="btn-s" id="selAllBtn">${this._t('selectAll')}</button>` : ''}
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
      $('#expDD').classList.remove('open');
    }));

    // Controls
    $('#viewSel')?.addEventListener('change', e => { this.viewMode = e.target.value; this.searchQuery = ''; this.selectedAutomation = null; this.selectedTrace = null; this.traceDetail = null; this.selectedTraceIds.clear(); this.selectMode = false;
    this.tracePage = 0;
    this.tracePageSize = this._loadPageSize(); this.render(); });
    $('#grpSel')?.addEventListener('change', e => { this.groupBy = e.target.value; this.render(); });
    $('#timeSel')?.addEventListener('change', e => { this.timeRange = e.target.value; this.tracePage = 0; this.selectedAutomation ? this._loadTraces(this.selectedAutomation) : this.render(); });
    $('#cfrom')?.addEventListener('change', e => { this.customTimeFrom = e.target.value; this.selectedAutomation ? this._loadTraces(this.selectedAutomation) : this.render(); });
    $('#cto')?.addEventListener('change', e => { this.customTimeTo = e.target.value; this.selectedAutomation ? this._loadTraces(this.selectedAutomation) : this.render(); });
    $('#resSel')?.addEventListener('change', e => { this.traceFilterResult = e.target.value; this.tracePage = 0; this.selectedAutomation ? this._loadTraces(this.selectedAutomation) : this.render(); });
    $('#selBtn')?.addEventListener('click', () => { this.selectMode = !this.selectMode; if (!this.selectMode) this.selectedTraceIds.clear(); this.render(); });
    $('#selAllBtn')?.addEventListener('click', () => {
      const t = this.viewMode === 'all-traces' ? this._filteredFlat() : this.traces;
      if (this.selectedTraceIds.size === t.length) this.selectedTraceIds.clear(); else t.forEach(x => this.selectedTraceIds.add(x.id));
      this.render();
    });
    // Pagination
    this.shadowRoot?.querySelectorAll('.pag-btn').forEach(b => b.addEventListener('click', () => {
      this.tracePage += parseInt(b.dataset.pdir); this.render();
    }));
    this.shadowRoot?.querySelector('#pagSize')?.addEventListener('change', e => {
      this.tracePageSize = parseInt(e.target.value); this.tracePage = 0; this._savePageSize(this.tracePageSize); this.render();
    });

    // Automations
    $('#autoSearch')?.addEventListener('input', e => { this.searchQuery = e.target.value; this.applyFiltersAndSort(); this.render(); });
    $('#trSearch')?.addEventListener('input', e => { this.searchQuery = e.target.value; this.render(); });
    $('#sortSel')?.addEventListener('change', e => { this.sortBy = e.target.value; this.applyFiltersAndSort(); this.render(); });
    $('#fltSel')?.addEventListener('change', e => { this.filterStatus = e.target.value; this.applyFiltersAndSort(); this.render(); });

    $$('.auto-item[data-auto]').forEach(el => el.addEventListener('click', () => this.onAutoClick(el.dataset.auto)));
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
