const fs = require('node:fs');
const assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');

(async () => {
  const failures = [];
  for (const [mode, id] of [['automations', 'autoSearch'], ['all-traces', 'trSearch']]) {
    const dom = new JSDOM('<!doctype html><body><button id="outside">Outside</button></body>', {
      runScripts: 'outside-only', url: 'http://qa.invalid/', virtualConsole: new VirtualConsole()
    });
    dom.window.ResizeObserver = class { observe() {} disconnect() {} };
    dom.window.eval(fs.readFileSync('ha-trace-viewer.js', 'utf8'));
    const Viewer = dom.window.customElements.get('ha-trace-viewer');
    const viewer = new Viewer();
    dom.window.document.body.append(viewer);
    viewer._hass = { language: 'en', user: { is_admin: true }, states: {}, callWS: async () => [] };
    viewer.viewMode = mode;
    viewer.searchQuery = 'ab';
    viewer.render();

    let input = viewer.shadowRoot.getElementById(id);
    input.focus();
    input.value = 'aXb';
    input.setSelectionRange(2, 2);
    input.dispatchEvent(new dom.window.InputEvent('input', { bubbles: true, data: 'X', inputType: 'insertText' }));
    input = viewer.shadowRoot.getElementById(id);
    if (viewer.shadowRoot.activeElement !== input || input.value !== 'aXb' || input.selectionStart !== 2 || input.selectionEnd !== 2) {
      failures.push(`${id}: typing must retain focus, query and caret`);
    }

    // The real asynchronous data refresh also replaces the rendered DOM.
    input.focus();
    input.setSelectionRange(1, 2);
    await viewer.updateAutomationData();
    input = viewer.shadowRoot.getElementById(id);
    if (viewer.shadowRoot.activeElement !== input || input.value !== 'aXb' || input.selectionStart !== 1 || input.selectionEnd !== 2) {
      failures.push(`${id}: background refresh must retain focus, query and selection`);
    }

    const outside = dom.window.document.getElementById('outside');
    outside.focus();
    viewer.render();
    assert.equal(dom.window.document.activeElement, outside, 'render must not steal focus from outside the card');
    viewer.remove();
    dom.window.close();
  }
  assert.deepEqual(failures, [], 'search must remain usable while its results and trace data change');
  console.log('Trace search focus passed (typing, background refresh and external focus in both modes)');
})().catch(error => { console.error(error); process.exitCode = 1; });
