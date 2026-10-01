const fs = require('node:fs');
const assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');

(async () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'outside-only', url: 'http://qa.invalid/', virtualConsole: new VirtualConsole()
  });
  dom.window.ResizeObserver = class { observe() {} disconnect() {} };
  dom.window.eval(fs.readFileSync('ha-trace-viewer.js', 'utf8'));
  const Viewer = dom.window.customElements.get('ha-trace-viewer');
  const viewer = new Viewer();
  dom.window.document.body.append(viewer);
  viewer._hass = {
    language: 'en', user: { is_admin: true },
    states: {
      'automation.qa_alpha': { state: 'on', attributes: { id: 'qa-alpha', friendly_name: 'QA Alpha' } },
      'automation.qa_beta': { state: 'on', attributes: { id: 'qa-beta', friendly_name: 'QA Beta' } }
    },
    callWS: async () => []
  };
  await viewer.updateAutomationData();
  const failures = [];

  const search = viewer.shadowRoot.getElementById('autoSearch');
  search.value = 'Alpha';
  search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(viewer.shadowRoot.querySelectorAll('.auto-item[data-auto]').length, 1, 'initial search must actually filter the fixture');
  for (const mode of ['all-traces', 'automations']) {
    const select = viewer.shadowRoot.getElementById('viewSel');
    select.value = mode;
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  }
  assert.equal(viewer.shadowRoot.getElementById('autoSearch').value, '', 'changing views clears the query');
  if (viewer.shadowRoot.querySelectorAll('.auto-item[data-auto]').length !== 2) {
    failures.push('blank query after changing views must show both automations');
  }

  const rawTrace = (id, start) => ({
    item_id: 'qa-alpha', run_id: id, state: 'stopped', script_execution: 'finished',
    timestamp: { start, finish: start }
  });
  const old = rawTrace('old', '2026-01-01T10:00:00.000Z');
  const recent = rawTrace('recent', '2026-01-01T11:00:00.000Z');
  viewer._traceMap['qa-alpha'] = viewer._buildTraceBucket([old]);
  viewer._allFlatTraces = [viewer._traceSummary(old, viewer._rawAutomations[0], 'automation.qa_alpha', 'qa-alpha')];
  viewer.selectedAutomation = 'automation.qa_alpha';
  const calls = [];
  let deliver;
  const response = new Promise(resolve => { deliver = resolve; });
  viewer._hass.callWS = async command => { calls.push(command); return response; };
  const refresh = viewer._loadTraces('automation.qa_alpha');
  assert(viewer.traces.some(t => t.id === 'old'), 'cached history remains visible during the read request');
  deliver([recent]);
  await refresh;
  if (calls.length !== 1 || calls[0].type !== 'trace/list') failures.push('selecting a cached automation must request its current traces');
  if (viewer.traces[0]?.id !== 'recent') failures.push('the newly returned trace must become the first visible result');
  if (!viewer.traces.some(t => t.id === 'old')) failures.push('refresh must retain previously saved history');
  if (!viewer._allFlatTraces.some(t => t.id === 'recent')) failures.push('All Traces must include the newly returned trace too');

  viewer._hass.callWS = async () => { throw new Error('Trace not found'); };
  const expired = { id: 'expired', item_id: 'qa-alpha', automationName: 'QA Alpha', timestamp: new Date('2026-01-01T09:00:00Z'), status: 'success', duration: 20 };
  viewer.traces = [expired];
  await viewer.onTraceClick('expired');
  const unavailable = viewer.shadowRoot.querySelector('.det-body [role="status"]');
  if (!unavailable || !unavailable.textContent.includes('Trace details are unavailable')) {
    failures.push('an unavailable retained detail needs an explicit message instead of an empty Timeline');
  }

  // A full detail already saved locally still remains usable after HA purges it.
  const cached = { ...expired, id: 'cached' };
  viewer.traces = [cached];
  viewer._storedDetails['qa-alpha::cached'] = {
    trace: { 'trigger/0': [{ timestamp: '2026-01-01T09:00:00Z', changed_variables: { trigger: { platform: 'event', description: 'QA trigger' } } }] },
    config: { alias: 'QA Alpha' }
  };
  await viewer.onTraceClick('cached');
  assert(viewer.shadowRoot.querySelector('.tl-step'), 'saved full detail must still render its actual timeline');
  assert(!viewer.shadowRoot.querySelector('.det-body [role="status"]'), 'available cached detail must not be labelled unavailable');

  viewer.remove();
  dom.window.close();
  assert.deepEqual(failures, [], 'view changes and current trace reads must agree with visible saved history');
  console.log('Trace history refresh passed (view reset, fresh reads, retained cache and missing-detail guidance)');
})().catch(error => { console.error(error); process.exitCode = 1; });
