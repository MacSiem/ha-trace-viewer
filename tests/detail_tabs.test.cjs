const fs = require('node:fs');
const assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');
const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', url: 'http://qa.invalid/', virtualConsole: new VirtualConsole() });
dom.window.ResizeObserver = class { observe() {} disconnect() {} };
dom.window.eval(fs.readFileSync('ha-trace-viewer.js', 'utf8'));
const Viewer = dom.window.customElements.get('ha-trace-viewer');
const viewer = new Viewer();
viewer._hass = { language: 'en', user: { is_admin: true }, states: {} };
viewer.traceDetail = { trace: { automationName: 'QA trace', timestamp: new Date(), status: 'success', duration: 17 }, steps: [], changedVars: [{ step: 'trigger/0', variable: 'qa', value: 'safe' }], rawData: { example: 'safe' }, configYaml: 'alias: QA trace', relatedEntities: [] };
viewer.render();
const failures = [];
for (const [tab, expected] of [['json', '"example"'], ['related', 'No related'], ['changes', 'safe'], ['config', 'alias: QA trace'], ['timeline', '']]) {
  const button = viewer.shadowRoot.querySelector(`[data-dtab="${tab}"]`);
  button.click();
  const pane = viewer.shadowRoot.querySelector(`#tp-${tab}`);
  if (!pane || !pane.classList.contains('act') || !pane.textContent.includes(expected) || viewer.shadowRoot.querySelector(`[data-dtab="${tab}"]`).getAttribute('aria-selected') !== 'true') failures.push(tab);
}
assert.deepEqual(failures, [], 'each detail tab must build its selected content and expose its selected state');
console.log('Trace detail tabs passed');
dom.window.close();
