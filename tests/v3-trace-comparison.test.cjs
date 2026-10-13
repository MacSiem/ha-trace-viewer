const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
const stamp = ms => new Date(Date.UTC(2026, 0, 1) + ms).toISOString();
const full = (runId, itemId = 'a', entries = [['action/0', 100]], options = {}) => ({
  domain: 'automation', item_id: itemId, run_id: runId, state: 'stopped', script_execution: 'finished',
  timestamp: { start: stamp(0), finish: stamp(1000) },
  trace: Object.fromEntries(entries.map(([p, ms]) => [p, [{ path: p, timestamp: stamp(ms) }]])), ...options
});
const row = (id, item_id = 'a', ms = 0) => ({ id, item_id, timestamp: new Date(Date.UTC(2026, 0, 1) + ms),
  finishTime: new Date(Date.UTC(2026, 0, 1) + ms + 1000), automationName: `Synthetic ${item_id}`,
  automationEntity: `automation.${item_id}`, status: 'success', duration: 1000, lastStep: 'action/0', trigger: 'fixture', raw: {} });
function fixture(t, rows = [row('old'), row('new', 'a', 10000)], callWS = async req => full(req.run_id, req.item_id)) {
  const dom = new JSDOM('<!doctype html>', { runScripts: 'outside-only', url: 'http://qa.invalid/', virtualConsole: new VirtualConsole() });
  dom.window.ResizeObserver = class { observe() {} disconnect() {} };
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  dom.window.eval(fs.readFileSync(path.join(root, 'ha-trace-viewer.js'), 'utf8'));
  const viewer = new (dom.window.customElements.get('ha-trace-viewer'))();
  dom.window.document.body.append(viewer);
  viewer._hass = { user: { id: 'admin', is_admin: true }, connection: { connected: true }, states: {}, callWS };
  viewer._lang = 'en'; viewer.viewMode = 'all-traces'; viewer.groupBy = 'none';
  viewer._allFlatTraces = rows; viewer.traces = rows; viewer.render();
  t.after(() => { viewer.disconnectedCallback(); dom.window.close(); });
  return { viewer, dom, rows };
}
function select(viewer, row) { viewer._toggleComparisonRun(row); }

test('local pure factory and standalone inline payload preserve exact Analyzer snapshot', () => {
  const shared = fs.readFileSync(path.join(root, 'shared/ha-tools-trace-contract.js'), 'utf8');
  const card = fs.readFileSync(path.join(root, 'ha-trace-viewer.js'), 'utf8');
  const extract = text => text.split('// BEGIN ANALYZER TRACE SNAPSHOT\n')[1].split('// END ANALYZER TRACE SNAPSHOT')[0];
  const expected = '0f891270a1d1fc04636e1b8752b8a3856371068a3be98a67797639b566b237b3';
  assert.equal(crypto.createHash('sha256').update(extract(shared)).digest('hex'), expected);
  assert.equal(extract(card), extract(shared));
  const { createHAToolsTraceContract } = require(path.join(root, 'shared/ha-tools-trace-contract.js'));
  const contract = createHAToolsTraceContract();
  assert.equal(typeof contract.compare, 'function');
  assert.notEqual(contract, createHAToolsTraceContract());
  const before = contract.normalizeFull(full('old', 'a', [['z/0', 10], ['a/0', 100]]), { expectedItemId: 'a' });
  const after = contract.normalizeFull(full('new', 'a', [['z/0', 50], ['a/0', 100], ['added/0', 20]]), { expectedItemId: 'a' });
  const comparison = contract.compare(before.data, after.data);
  assert.equal(comparison.status, 'available');
  assert.equal(comparison.data.nodes.reached_later[0].path, 'z/0');
  assert.equal(comparison.data.nodes.added[0].path, 'added/0');
});

test('selection is bounded at two exact identities and survives filtering without fetching detail', t => {
  const requests = [];
  const { viewer, rows } = fixture(t, [row('same'), row('same', 'b', 10000), row('third')], async req => { requests.push(req); return full(req.run_id, req.item_id); });
  assert.equal(viewer.shadowRoot.querySelector('#compareRuns').disabled, true);
  select(viewer, rows[0]); select(viewer, rows[1]); select(viewer, rows[2]);
  assert.equal(viewer._comparisonRuns.size, 2);
  assert.equal(viewer.shadowRoot.querySelector('#compareRuns').disabled, false);
  viewer.searchQuery = 'hidden'; viewer.render();
  assert.equal(viewer._comparisonRuns.size, 2);
  assert.equal(viewer.shadowRoot.querySelectorAll('[data-remove-comparison]').length, 2);
  assert.equal(requests.length, 0);
});

test('same run ID from another automation is rejected explicitly before trace/get', async t => {
  const requests = [];
  const { viewer, rows } = fixture(t, [row('same'), row('same', 'b')], async req => { requests.push(req); return full(req.run_id, req.item_id); });
  rows.forEach(r => select(viewer, r)); await viewer._compareSelectedRuns();
  assert.equal(requests.length, 0);
  assert.match(viewer.shadowRoot.textContent, /same automation/);
});

test('Compare coalesces, orders oldest baseline, and fetches only selected exact runs', async t => {
  const requests = [], release = [];
  const { viewer, rows } = fixture(t, undefined, req => { requests.push(req); return new Promise(resolve => release.push(() => resolve(full(req.run_id, req.item_id)))); });
  select(viewer, rows[1]); select(viewer, rows[0]);
  const first = viewer._compareSelectedRuns(), second = viewer._compareSelectedRuns();
  assert.equal(first, second); assert.equal(requests.length, 2);
  assert.deepEqual(requests.map(r => [r.type, r.item_id, r.run_id]), [['trace/get', 'a', 'old'], ['trace/get', 'a', 'new']]);
  release.forEach(fn => fn()); await first;
  assert.equal(viewer._comparisonView.runs[0].id, 'old');
  assert.equal(viewer._comparisonView.result.status, 'available');
});

test('current detail is reused only for its exact item/run and no raw secrets appear', async t => {
  const requests = [];
  const { viewer, rows } = fixture(t, undefined, async req => { requests.push(req); return full(req.run_id, req.item_id); });
  viewer._comparisonDetailSourceEpoch = viewer._comparisonSourceEpoch;
  viewer.traceDetail = { trace: rows[0], rawData: full('old', 'a', [['action/0', 100]], { config: { password: 'SYNTHETIC_SECRET' } }), steps: [], changedVars: [], relatedEntities: [], configYaml: '' };
  rows.forEach(r => select(viewer, r)); await viewer._compareSelectedRuns();
  assert.equal(requests.length, 1); assert.equal(requests[0].run_id, 'new');
  assert.doesNotMatch(viewer.shadowRoot.querySelector('#traceComparison').textContent, /SYNTHETIC_SECRET|password/);
  assert.doesNotMatch(JSON.stringify(viewer._comparisonView), /SYNTHETIC_SECRET|password/);
});

test('response with wrong run ID and malformed payload never produce identical/available', async t => {
  const { viewer, rows } = fixture(t, undefined, async req => full('WRONG', req.item_id));
  rows.forEach(r => select(viewer, r)); await viewer._compareSelectedRuns();
  assert.equal(viewer._comparisonView.result.status, 'malformed');
  assert.match(viewer.shadowRoot.querySelector('#traceComparison').textContent, /Malformed/);
});

test('first difference follows recorded elapsed time rather than lexicographic path order', async t => {
  const { viewer, rows } = fixture(t, undefined, async req => full(req.run_id, req.item_id,
    req.run_id === 'old' ? [['z/0', 10], ['a/0', 100]] : [['z/0', 50], ['a/0', 200]]));
  rows.forEach(r => select(viewer, r)); await viewer._compareSelectedRuns();
  const first = viewer.shadowRoot.querySelector('#comparisonFirstDifference');
  assert.match(first.textContent, /z\/0/);
  viewer.shadowRoot.querySelector('#jumpComparisonDifference').click();
  assert.equal(viewer.shadowRoot.activeElement, first);
  assert.match(viewer.shadowRoot.querySelector('#traceComparison').textContent, /20 ms.*25%/);
});

test('native selection controls support focus and Escape/close returns focus', async t => {
  const { viewer, dom } = fixture(t);
  const buttons = () => [...viewer.shadowRoot.querySelectorAll('[data-compare-run]')];
  assert.equal(buttons()[0].tagName, 'BUTTON'); buttons()[0].click();
  assert.equal(viewer.shadowRoot.activeElement.dataset.compareRun, buttons()[0].dataset.compareRun);
  buttons()[1].click(); await viewer._compareSelectedRuns();
  viewer.shadowRoot.querySelector('#traceComparison').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(viewer.shadowRoot.querySelector('#traceComparison'), null);
  assert.equal(viewer.shadowRoot.activeElement.id, 'compareRuns');
});

test('selection changes discard late data and abort old request', async t => {
  const release = [];
  const { viewer, rows } = fixture(t, undefined, req => new Promise(resolve => release.push(() => resolve(full(req.run_id, req.item_id)))));
  rows.forEach(r => select(viewer, r)); const pending = viewer._compareSelectedRuns();
  select(viewer, rows[0]); release.forEach(fn => fn()); await pending;
  assert.equal(viewer._comparisonView, null); assert.equal(viewer._comparisonRuns.size, 1);
});

for (const change of ['user', 'role', 'connection', 'offline', 'disconnect']) test(`${change} invalidates selection and late comparison`, async t => {
  const release = [];
  const { viewer, rows, dom } = fixture(t, undefined, req => new Promise(resolve => release.push(() => resolve(full(req.run_id, req.item_id)))));
  rows.forEach(r => select(viewer, r)); const pending = viewer._compareSelectedRuns();
  viewer.updateAutomationData = async () => {};
  if (change === 'disconnect') viewer.disconnectedCallback();
  else if (change === 'offline') dom.window.dispatchEvent(new dom.window.Event('offline'));
  else viewer.hass = { ...viewer._hass, ...(change === 'connection' ? { connection: { connected: true } } : { user: { id: change === 'user' ? 'other' : 'admin', is_admin: change !== 'role' } }) };
  release.forEach(fn => fn()); await pending;
  assert.equal(viewer._comparisonView, null); assert.equal(viewer._comparisonRuns.size, 0);
});

test('timeout settles without waiting for unresolved websocket data', async t => {
  const { viewer, rows, dom } = fixture(t, undefined, () => new Promise(() => {}));
  const original = dom.window.setTimeout;
  dom.window.setTimeout = (fn, ms, ...args) => original(fn, ms === 10000 ? 0 : ms, ...args);
  rows.forEach(r => select(viewer, r)); await viewer._compareSelectedRuns();
  assert.equal(viewer._comparisonView.result.status, 'unavailable');
  assert.equal(viewer._comparisonPending, null);
});

for (const [name, payload, status] of [
  ['empty recorded points', () => full('placeholder', 'a', []), 'no_data'],
  ['non execution', () => full('placeholder', 'a', [], { not_triggered: true }), 'no_data'],
  ['unknown source shape', () => ({ arbitrary: 'shape' }), 'malformed']
]) test(name, async t => {
  const { viewer, rows } = fixture(t, undefined, async req => ({ ...payload(), run_id: req.run_id }));
  rows.forEach(r => select(viewer, r)); await viewer._compareSelectedRuns();
  assert.equal(viewer._comparisonView.result.status, status);
});

test('running and missing duration are unconfirmed and never called identical', async t => {
  const { viewer, rows } = fixture(t, undefined, async req => full(req.run_id, req.item_id, [['action/0', 100]], { state: 'running', timestamp: { start: stamp(0), finish: null } }));
  rows.forEach(r => select(viewer, r)); await viewer._compareSelectedRuns();
  assert.equal(viewer._comparisonView.result.status, 'unconfirmed');
  assert.match(viewer.shadowRoot.querySelector('#traceComparison').textContent, /Unconfirmed/);
  assert.doesNotMatch(viewer.shadowRoot.querySelector('#traceComparison').textContent, /identical/i);
});

for (const lang of ['pl', 'en']) test(`${lang} translated categories and unknown statuses`, async t => {
  const { viewer, rows } = fixture(t, undefined, async () => { throw { code: 'not_found' }; });
  viewer._lang = lang; rows.forEach(r => select(viewer, r)); await viewer._compareSelectedRuns();
  assert.match(viewer.shadowRoot.querySelector('#traceComparison').textContent, lang === 'pl' ? /Brak danych/ : /No data/);
  for (const key of ['added', 'removed', 'reached_later', 'reached_earlier', 'unchanged', 'malformed', 'unavailable']) assert.equal(typeof viewer._comparisonText(key), 'string');
});

test('strict allowlist rejects accessors, oversized strings, and unknown fields without exposing values', () => {
  const contract = require(path.join(root, 'shared/ha-tools-trace-contract.js')).createHAToolsTraceContract();
  let reads = 0;
  const accessor = full('r');
  Object.defineProperty(accessor, 'config', { enumerable: true, get() { reads++; return { password: 'SYNTHETIC' }; } });
  for (const payload of [accessor, full('r', 'a', [['action/0', 10]], { config: { value: 'x'.repeat(4097) } }), full('r', 'a', [['action/0', 10]], { unknown_field: true })]) {
    const capability = contract.normalizeFull(payload, { expectedItemId: 'a' });
    assert.equal(capability.status, 'malformed');
    assert.equal(capability.data, undefined);
  }
  assert.equal(reads, 0);
});

test('Analyzer categories remain unchanged and ignore variable values by contract', () => {
  const contract = require(path.join(root, 'shared/ha-tools-trace-contract.js')).createHAToolsTraceContract();
  const before = contract.normalizeFull(full('old', 'a', [['removed/0', 10], ['later/0', 100], ['earlier/0', 100], ['stable/0', 100]]), { expectedItemId: 'a' });
  const after = contract.normalizeFull(full('new', 'a', [['added/0', 10], ['later/0', 125], ['earlier/0', 80], ['stable/0', 110]]), { expectedItemId: 'a' });
  const diff = contract.compare(before.data, after.data);
  for (const [category, p] of Object.entries({ added: 'added/0', removed: 'removed/0', reached_later: 'later/0', reached_earlier: 'earlier/0', unchanged: 'stable/0' })) {
    assert.equal(diff.data.nodes[category][0].path, p);
  }
  const changedValue = full('new');
  changedValue.trace['action/0'][0].changed_variables = { password: 'SYNTHETIC_SECRET' };
  const normalized = contract.normalizeFull(changedValue, { expectedItemId: 'a' });
  assert.equal(normalized.status, 'available');
  assert.doesNotMatch(JSON.stringify(normalized), /SYNTHETIC_SECRET|password/);
});

test('connection events clear selections, even before connected property catches up', async t => {
  const requests = [], listeners = new Map();
  const { viewer, rows } = fixture(t, undefined, async req => { requests.push(req); return full(req.run_id, req.item_id); });
  viewer.updateAutomationData = async () => {};
  viewer.hass = { ...viewer._hass, connection: { connected: true,
    addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); } } };
  // Avoid trace/list from ordinary setter refresh while measuring compare-only traffic.
  viewer._allFlatTraces = rows; viewer.traces = rows;
  rows.forEach(r => select(viewer, r)); listeners.get('disconnected')();
  assert.equal(viewer._comparisonRuns.size, 0);
  rows.forEach(r => select(viewer, r)); requests.length = 0;
  await viewer._compareSelectedRuns(); assert.equal(requests.length, 0);
  assert.match(viewer.shadowRoot.querySelector('#traceComparison').textContent, /No connection/);
  listeners.get('ready')(); assert.equal(viewer._comparisonRuns.size, 0);
});

test('null hass removes the old source DOM and comparison state', async t => {
  const { viewer, rows } = fixture(t);
  rows.forEach(r => select(viewer, r)); await viewer._compareSelectedRuns();
  viewer.hass = null;
  assert.equal(viewer._comparisonRuns.size, 0);
  assert.equal(viewer.shadowRoot.querySelector('#traceComparison'), null);
});

test('long comparisons page all recorded points and jump directly to the first difference without refetch', async t => {
  let reads = 0;
  const { viewer, rows } = fixture(t, undefined, async req => {
    reads++;
    return full(req.run_id, req.item_id,
      Array.from({length:120}, (_,i) => [`action/${i}`, req.run_id === 'new' && i === 119 ? 4500 : i*30]),
      {timestamp:{start:stamp(0),finish:stamp(5000)}});
  });
  rows.forEach(r => select(viewer,r));await viewer._compareSelectedRuns();
  const points=()=>viewer.shadowRoot.querySelectorAll('.comparison-points li');
  assert.equal(points().length,50);assert.match(viewer.shadowRoot.querySelector('#comparisonPageStatus').textContent,/1.*3/);
  viewer.shadowRoot.querySelector('#comparisonNext').click();assert.equal(points().length,50);
  assert.equal(viewer.shadowRoot.activeElement.id,'comparisonNext');
  viewer.shadowRoot.querySelector('#jumpComparisonDifference').click();
  assert.equal(points().length,20);assert.match(viewer.shadowRoot.querySelector('#comparisonPageStatus').textContent,/3.*3/);
  assert.match(viewer.shadowRoot.activeElement.textContent,/action\/119/);
  assert.equal(viewer.shadowRoot.querySelector('#comparisonNext').disabled,true);
  viewer.shadowRoot.querySelector('#comparisonPrevious').click();assert.equal(points().length,50);
  assert.equal(viewer.shadowRoot.activeElement.id,'comparisonPrevious');assert.equal(reads,2);
});

// W6 comparison export consumes only the currently normalized pair, never trace/get.
test('comparison W6 exports exact first difference/current pair without fetching and aliases paths',async t=>{
 let reads=0;const {viewer,rows,dom}=fixture(t,undefined,async req=>{reads++;return full(req.run_id,req.item_id,[['private_path/0',req.run_id==='new'?200:100]]);});
 dom.window.Blob=Blob;let blob;dom.window.URL.createObjectURL=b=>{blob=b;return 'blob:qa';};dom.window.URL.revokeObjectURL=()=>{};dom.window.HTMLAnchorElement.prototype.click=function(){};
 rows.forEach(r=>select(viewer,r));await viewer._compareSelectedRuns();const original=viewer._comparisonPoints(viewer._comparisonView).find(p=>p.category!=='unchanged');
 viewer.shadowRoot.querySelector('#exportComparison').click();await new Promise(r=>setImmediate(r));
 const root=viewer.shadowRoot.querySelector('[data-ha-tools-export]').shadowRoot;const get=k=>root.querySelector(`[data-export="${k}"]`);
 const preview=get('preview').textContent,data=JSON.parse(preview);assert.equal(data.scope,'comparison');assert.equal(data.records.length,2);assert.equal(data.comparison.first_difference.category,original.category);assert.equal(data.comparison.first_difference.delta_ms,original.delta_ms);
 assert.doesNotMatch(preview,/private_path|Synthetic|2026-01-01|"old"|"new"/);assert.equal(reads,2);assert.equal(blob,undefined);get('save').click();await new Promise(r=>setImmediate(r));assert.equal(await blob.text(),preview);assert.equal(reads,2);
});
test('comparison W6 clears an open preview when pair changes and refuses unconfirmed source',async t=>{
 const {viewer,rows}=fixture(t);rows.forEach(r=>select(viewer,r));await viewer._compareSelectedRuns();viewer._exportComparison();await new Promise(r=>setImmediate(r));
 const root=viewer.shadowRoot.querySelector('[data-ha-tools-export]').shadowRoot;select(viewer,rows[0]);assert.equal(root.querySelector('[data-export="preview"]').textContent,'');assert.equal(root.querySelector('[data-export="save"]').disabled,true);
 root.querySelector('[data-export="cancel"]').click();viewer._comparisonView={runs:rows,result:{status:'available',data:{}},data:null};viewer._exportComparison();assert.equal(viewer.shadowRoot.querySelector('[data-ha-tools-export]'),null);
});
