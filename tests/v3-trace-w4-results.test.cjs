// Written before the W4 runtime patch; execution/RED-GREEN belongs to the owner.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const start = '2026-01-01T00:00:00.000Z';
const finish = '2026-01-01T00:00:01.000Z';
const raw = (id, extra = {}) => ({ domain: 'automation', item_id: 'a', run_id: id,
  state: 'stopped', script_execution: 'finished', timestamp: { start, finish }, ...extra });
const full = row => ({ ...row, trace: { 'action/0': [{ path: 'action/0', timestamp: start }] } });
function setup(t, language = 'en', rows = []) {
  const dom = new JSDOM('', { runScripts: 'outside-only', url: 'http://qa.invalid/', virtualConsole: new VirtualConsole() });
  dom.window.ResizeObserver = class { observe() {} disconnect() {} };
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  dom.window.eval(fs.readFileSync(path.join(__dirname, '../ha-trace-viewer.js'), 'utf8'));
  const card = dom.window.document.createElement('ha-trace-viewer');
  dom.window.document.body.append(card);
  card._hass = { language, user: { id: 'admin', is_admin: true }, connection: { connected: true },
    states: { 'automation.a': { state: 'on', attributes: { id: 'a', friendly_name: 'Synthetic A' } } },
    callWS: async request => request.type === 'trace/get' ? full(rows.find(row => row.run_id === request.run_id)) : rows };
  card._lang = language; card.viewMode = 'all-traces'; card.groupBy = 'none';
  t.after(() => { card.remove(); dom.window.close(); });
  return { card, dom };
}
const cases = [
  ['absent', undefined, 'stopped', 'unconfirmed', 'unconfirmed'],
  ['null', null, 'stopped', 'unconfirmed', 'unconfirmed'],
  ['unknown', 'future-outcome', 'stopped', 'unconfirmed', 'unconfirmed'],
  ['success', 'finished', 'stopped', 'success', 'success'],
  ['error', 'error', 'stopped', 'error', 'error'],
  ['any-error', 'any_error', 'stopped', 'error', 'error'],
  ['running', null, 'running', 'running', 'unconfirmed'],
  ['aborted', 'aborted', 'stopped', 'aborted', 'unconfirmed'],
  ['error-running', 'error', 'running', 'error', 'error'],
  ['finished-without-state', 'finished', undefined, 'unconfirmed', 'unconfirmed']
];
for (const language of ['en', 'pl']) {
  const labels = language === 'pl' ? { success: '✓ Sukces', error: '✕ Błąd', unconfirmed: '? Niepotwierdzony' }
    : { success: '✓ Success', error: '✕ Error', unconfirmed: '? Unconfirmed' };
  for (const [name, outcome, state, domainStatus, resultStatus] of cases) {
    test(`${language}: ${name} renders the confirmed result in list and detail`, async t => {
      const input = raw(name, { state, script_execution: outcome });
      if (outcome === undefined) delete input.script_execution;
      if (state === undefined) delete input.state;
      const { card } = setup(t, language, [input]);
      await card.updateAutomationData();
      const row = card._allFlatTraces[0];
      assert.equal(row.status, domainStatus);
      assert.equal(card._stats([row]).ok, resultStatus === 'success' ? 1 : 0);
      const item = card.shadowRoot.querySelector('.tr-item');
      const badge = item.querySelector('[data-result-state]');
      assert.equal(badge.dataset.resultState, resultStatus);
      assert.equal(badge.textContent.trim(), labels[resultStatus]);
      if (resultStatus !== 'success') assert.equal(item.querySelector('[data-result-state="success"]'), null);
      if (domainStatus === 'running' || domainStatus === 'aborted') assert.match(item.textContent, new RegExp(card._t(domainStatus)));
      card.selectedTrace = row.id; card.traceDetail = card._buildDetail(row, full(input)); card.render();
      assert.equal(card.shadowRoot.querySelector('.det-head [data-result-state]').textContent.trim(), labels[resultStatus]);
      const end = card.traceDetail.steps.find(step => step.key === 'finished');
      assert.equal(end.status, resultStatus);
      assert.equal(end.icon, labels[resultStatus][0]);
      if (resultStatus === 'unconfirmed') {
        assert.equal(card.shadowRoot.querySelector('.tl-step.s-error'), null);
        assert.match(card.shadowRoot.querySelector('.tl-step.s-unconfirmed').textContent, new RegExp(labels[resultStatus].slice(2)));
      }
    });
  }
  for (const view of ['all-traces', 'automations']) {
    for (const missingFinish of [undefined, null]) {
      test(`${language}/${view}: missing finish ${missingFinish} stays unmeasured through adapters and render`, async t => {
        const input = raw('running', { state: 'running', script_execution: null, timestamp: { start, finish: missingFinish } });
        const { card } = setup(t, language, [input]);
        await card.updateAutomationData();
        card.viewMode = view;
        if (view === 'automations') { card.selectedAutomation = 'automation.a'; await card._loadTraces('automation.a'); }
        card.render();
        const row = (view === 'all-traces' ? card._allFlatTraces : card.traces)[0];
        assert.equal(row.finishTime, null); assert.equal(row.duration, null);
        assert.equal(row.timestamp.toISOString(), start);
        assert.equal(card._stats([row]).avg, null);
        assert.doesNotMatch(card.shadowRoot.querySelector('.tr-dur').textContent, /0ms/);
        card.selectedTrace = row.id; card.traceDetail = card._buildDetail(row, full(input)); card.render();
        assert.equal(card.traceDetail.steps.some(step => step.key === 'finished'), false);
        assert.doesNotMatch(card.shadowRoot.querySelector('.det-head').textContent, /0ms/);
        assert.equal(card.shadowRoot.querySelector('.tl-step.s-error'), null);
      });
    }
    test(`${language}/${view}: measured zero and mixed/all-missing statistics`, async t => {
      const rows = [raw('zero', { timestamp: { start, finish: start } }), raw('measured'),
        raw('missing', { state: 'running', script_execution: null, timestamp: { start, finish: null } })];
      const { card } = setup(t, language, rows);
      await card.updateAutomationData(); card.viewMode = view;
      if (view === 'automations') { card.selectedAutomation = 'automation.a'; await card._loadTraces('automation.a'); }
      card.render();
      const list = view === 'all-traces' ? card._allFlatTraces : card.traces;
      const zero = list.find(row => row.id === 'zero');
      assert.equal(zero.duration, 0); assert.equal(card._fmtDur(0), '0ms');
      assert.equal(card._stats(list).avg, 500); assert.equal(card._stats(list).ok, 2);
      assert.equal(card._stats([]).avg, null);
      assert.equal(card._stats([{ duration: null }, { duration: NaN }, { duration: Infinity }, { duration: '20' }]).avg, null);
      assert.match(card.shadowRoot.querySelector('.stats').textContent, /500ms/);
      card.traceDetail = card._buildDetail(zero, full(rows[0])); card.render();
      assert.match(card.shadowRoot.querySelector('.det-dur').textContent, /0ms/);
      assert.match(card.traceDetail.steps.find(step => step.key === 'finished').description, /0ms/);
    });
  }
  test(`${language}: persisted raw unknown outcomes, result groups and filters keep history`, async t => {
    const rows = [raw('old', { script_execution: null }), raw('running', { state: 'running', script_execution: null, timestamp: { start, finish: null } }), raw('aborted', { script_execution: 'aborted' }), raw('ok')];
    const { card, dom } = setup(t, language, []);
    dom.window.localStorage.setItem('ha-tools-trace-viewer-stored', JSON.stringify(rows));
    dom.window.localStorage.setItem('ha-tools-settings', JSON.stringify({ 'trace-viewer.traceFilterResult': 'unknown' }));
    card._restoreSettings(); card.viewMode = 'all-traces';
    await card.updateAutomationData();
    assert.equal(card._allFlatTraces.length, rows.length);
    assert.equal(card._allFlatTraces.find(row => row.id === 'old').status, 'unconfirmed');
    assert.equal(card._filteredFlat().some(row => row.id === 'old'), true);
    assert.equal(card.shadowRoot.querySelector('#resSel').value, 'unknown');
    for (const status of ['success', 'unconfirmed', 'running', 'aborted']) {
      card.traceFilterResult = status; card.render();
      assert.equal(card.shadowRoot.querySelector('#resSel').value, status);
      const filtered = card._filteredFlat();
      assert(filtered.length > 0);
      if (status === 'unconfirmed') assert.equal(filtered.some(row => row.status === 'success'), false);
      else assert(filtered.every(row => row.status === status));
      card._applyTraceBucket(card._traceMap.a, card._rawAutomations[0], 'automation.a', 'a');
      assert.deepEqual(Array.from(card.traces, row => row.id), Array.from(filtered, row => row.id));
    }
    card.traceFilterResult = 'future-filter'; card.render();
    assert.equal(card.shadowRoot.querySelector('#resSel').value, 'future-filter');
    assert.equal(card._filteredFlat().length, 0);
    card.traceFilterResult = 'all'; card.groupBy = 'result'; card.render();
    assert.match(card.shadowRoot.querySelector('.list').textContent, new RegExp(labels.unconfirmed.slice(2)));
    assert.equal(JSON.parse(dom.window.localStorage.getItem('ha-tools-trace-viewer-stored')).length, rows.length);
    assert.equal(card._rawAutomations[0].status, 'running'); // enabled automation semantics
  });
}

test('missing or invalid timestamps do not fabricate dates, measurements or comparison identities', async t => {
  const rows = [raw('no-start', { timestamp: { finish } }), raw('bad-start', { timestamp: { start: 'invalid', finish } }), raw('good'),
    raw('no-finish', { timestamp: { start } }), raw('bad-finish', { timestamp: { start, finish: 'invalid' } }),
    raw('negative', { timestamp: { start: finish, finish: start } })];
  const { card } = setup(t, 'en', rows); await card.updateAutomationData();
  assert.equal(card._allFlatTraces.length, rows.length);
  for (const id of ['no-start', 'bad-start']) {
    const row = card._allFlatTraces.find(row => row.id === id);
    assert.equal(row.timestamp, null); assert.equal(row.duration, null);
    card._toggleComparisonRun(row); assert.equal(card._comparisonRuns.size, 0);
  }
  for (const id of ['no-finish', 'bad-finish', 'negative']) assert.equal(card._allFlatTraces.find(row => row.id === id).duration, null);
  assert.deepEqual(Array.from(card._allFlatTraces.slice(-2), row => row.id), ['no-start', 'bad-start']);
  card.timeRange = 'custom'; card.customTimeTo = finish;
  assert.equal(card._filteredFlat().some(row => row.timestamp === null), false);
  card.customTimeFrom = start;
  assert.equal(card._filteredFlat().some(row => row.id === 'good'), true);
});

for (const format of ['json', 'csv']) test(`W6 ${format} keeps nulls, measurements, unknown outcomes and useful detail`, async t => {
  const rows = [raw('unknown', { script_execution: null }), raw('zero', { timestamp: { start, finish: start } }),
    raw('running', { state: 'running', script_execution: null, timestamp: { start, finish: null } })];
  const { card } = setup(t, 'en', rows); await card.updateAutomationData();
  card.traceDetail = card._buildDetail(card._allFlatTraces.find(row => row.id === 'unknown'), full(rows[0]));
  card._comparisonDetailSourceEpoch = card._comparisonSourceEpoch;
  card._exportIntent = { scope: 'all' };
  const result = card._buildExportPayload({ draft: { format, includePrivate: false }, signal: { aborted: false } });
  assert.equal(result.status, 'partial');
  if (format === 'json') {
    const doc = JSON.parse(result.serialized); assert.equal(doc.record_count, 3);
    const unknown = doc.records.find(row => row.status === 'unconfirmed');
    assert.equal(unknown.duration_ms, 1000); assert.equal(unknown.detail.step_count, 1);
    assert.equal(doc.records.find(row => row.status === 'running').duration_ms, null);
    assert.equal(doc.records.find(row => row.status === 'success').duration_ms, 0);
  } else {
    assert.match(result.serialized, /unconfirmed/); assert.match(result.serialized, /null/);
    assert.match(result.serialized, /partial/); assert.match(result.serialized, /1000/);
  }
  card._allFlatTraces = []; card.traces = [];
  const empty = card._buildExportPayload({ draft: { format, includePrivate: false }, signal: { aborted: false } });
  assert.equal(empty.status, 'no_data'); assert.equal(empty.serialized, '');
});

test('known error stays exportable as an error; confirmed success retains W6 success', async t => {
  for (const outcome of ['error', 'finished']) {
    const input = raw(outcome, { script_execution: outcome });
    const { card } = setup(t, 'en', [input]); await card.updateAutomationData();
    card.traceDetail = card._buildDetail(card._allFlatTraces[0], full(input));
    card._comparisonDetailSourceEpoch = card._comparisonSourceEpoch; card._exportIntent = { scope: 'all' };
    const result = card._buildExportPayload({ draft: { format: 'json', includePrivate: true }, signal: { aborted: false } });
    const report = JSON.parse(result.serialized);
    assert.equal(result.status, 'success'); // complete document, independently of the run outcome
    assert.equal(report.records[0].status, outcome === 'error' ? 'error' : 'success');
    assert.equal(report.records[0].timestamp, start); assert.equal(report.records[0].finish, finish);
  }
});

test('running comparison retains recorded differences and W6 partial export', async t => {
  const rows = [raw('old'), raw('new', { state: 'running', script_execution: null, timestamp: { start: finish, finish: null } })];
  const { card } = setup(t, 'en', rows);
  card._hass.callWS = async request => request.type === 'trace/get'
    ? { ...rows.find(row => row.run_id === request.run_id), trace: { 'action/0': [{ path: 'action/0', timestamp: request.run_id === 'old' ? start : finish }] } }
    : rows;
  await card.updateAutomationData(); card._allFlatTraces.forEach(row => card._toggleComparisonRun(row));
  await card._compareSelectedRuns();
  assert.equal(card._comparisonView.result.status, 'unconfirmed');
  assert(card._comparisonView.result.data); assert.equal(card._comparisonView.data.length, 2);
  assert.equal(card._comparisonExportable(), true);
  card._exportIntent = { scope: 'comparison' };
  const result = card._buildExportPayload({ draft: { format: 'json', includePrivate: false }, signal: { aborted: false } });
  const report = JSON.parse(result.serialized);
  assert.equal(report.status, 'partial'); assert.equal(report.record_count, 2);
  assert.equal(report.comparison.source_status, 'unconfirmed'); assert(report.comparison.points.length > 0);
});
