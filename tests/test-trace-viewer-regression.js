const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function loadViewerClass() {
  const registry = new Map();
  const storage = new Map();

  class HTMLElementStub {
    constructor() {
      this.shadowRoot = null;
      this.offsetWidth = 1000;
      this.clientWidth = 1000;
    }

    attachShadow() {
      this.shadowRoot = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => [],
      };
      return this.shadowRoot;
    }

    getRootNode() { return {}; }
    dispatchEvent() {}
    addEventListener() {}
  }

  const documentStub = {
    body: { querySelectorAll: () => [] },
    head: { appendChild: () => {} },
    currentScript: { src: '' },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
      appendChild: () => {},
      click: () => {},
      addEventListener: () => {},
      remove: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      style: {},
      firstElementChild: null,
      innerHTML: '',
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  const windowStub = {
    addEventListener: () => {},
    removeEventListener: () => {},
    customCards: [],
  };

  const context = {
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    navigator: { language: 'en-US' },
    localStorage: {
      getItem: key => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
    },
    window: windowStub,
    document: documentStub,
    customElements: {
      get: name => registry.get(name),
      define: (name, klass) => registry.set(name, klass),
    },
    HTMLElement: HTMLElementStub,
    CustomEvent: class CustomEvent {},
    Blob: class Blob {},
    URL: { createObjectURL: () => 'blob:test' },
    ResizeObserver: class ResizeObserver { observe() {} disconnect() {} },
    MutationObserver: class MutationObserver { observe() {} disconnect() {} },
  };

  windowStub.window = windowStub;
  windowStub.document = documentStub;
  windowStub.customElements = context.customElements;

  vm.runInNewContext(fs.readFileSync('ha-trace-viewer.js', 'utf8'), context, {
    filename: 'ha-trace-viewer.js',
  });

  return registry.get('ha-trace-viewer');
}

async function testYamlAutomationFetchesPerItemTracesAndClearsStaleState() {
  const HATraceViewer = loadViewerClass();
  const viewer = new HATraceViewer();
  const calls = [];
  const renderSnapshots = [];

  viewer._hass = {
    language: 'en',
    states: {
      'automation.domofon_sync_trybu': {
        state: 'on',
        attributes: { id: 'domofon_sync_trybu', friendly_name: 'Domofon Sync Trybu' },
      },
    },
    callWS: async msg => {
      calls.push(msg);
      assert.strictEqual(msg.type, 'trace/list');
      assert.strictEqual(msg.domain, 'automation');
      assert.strictEqual(msg.item_id, 'domofon_sync_trybu');
      return [{
        item_id: 'domofon_sync_trybu',
        run_id: 'run-yaml-1',
        timestamp: {
          start: '2026-05-18T10:00:00.000Z',
          finish: '2026-05-18T10:00:00.180Z',
        },
        state: 'stopped',
        script_execution: 'finished',
        last_step: 'action/0',
        trigger: 'state of sensor.domofon',
      }];
    },
  };
  viewer._rawAutomations = [{
    entity: 'automation.domofon_sync_trybu',
    name: 'Domofon Sync Trybu',
    automationId: 'domofon_sync_trybu',
  }];
  viewer.selectedAutomation = 'automation.domofon_sync_trybu';
  viewer._traceMap = {};
  viewer.traces = [{ id: 'stale-run', item_id: '1772654249135' }];
  viewer.selectedTrace = 'stale-run';
  viewer.traceDetail = { trace: { id: 'stale-run' } };
  viewer.render = () => {
    renderSnapshots.push({
      traceIds: viewer.traces.map(t => t.id),
      selectedTrace: viewer.selectedTrace,
      traceDetail: viewer.traceDetail,
    });
  };

  await viewer._loadTraces('automation.domofon_sync_trybu');

  assert.strictEqual(renderSnapshots[0].traceIds.length, 0);
  assert.strictEqual(renderSnapshots[0].selectedTrace, null);
  assert.strictEqual(renderSnapshots[0].traceDetail, null);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(viewer.traces.length, 1);
  assert.strictEqual(viewer.traces[0].id, 'run-yaml-1');
  assert.strictEqual(viewer.traces[0].item_id, 'domofon_sync_trybu');
  assert.strictEqual(viewer._traceMap.domofon_sync_trybu.count, 1);
}

async function testNumericAutomationUsesCachedTraceBucket() {
  const HATraceViewer = loadViewerClass();
  const viewer = new HATraceViewer();
  const calls = [];

  viewer._hass = {
    language: 'en',
    states: {},
    callWS: async msg => {
      calls.push(msg);
      return [];
    },
  };
  viewer._rawAutomations = [{
    entity: 'automation.ui_created',
    name: 'UI Created',
    automationId: 1772654249135,
  }];
  viewer.selectedAutomation = 'automation.ui_created';
  viewer._traceMap = {
    '1772654249135': {
      count: 1,
      lastRun: new Date('2026-05-18T10:00:00.000Z'),
      traces: [{
        item_id: '1772654249135',
        run_id: 'run-numeric-1',
        timestamp: {
          start: '2026-05-18T10:00:00.000Z',
          finish: '2026-05-18T10:00:00.180Z',
        },
        state: 'stopped',
        script_execution: 'finished',
      }],
    },
  };
  viewer.render = () => {};

  await viewer._loadTraces('automation.ui_created');

  assert.strictEqual(calls.length, 0);
  assert.strictEqual(viewer.traces.length, 1);
  assert.strictEqual(viewer.traces[0].id, 'run-numeric-1');
  assert.strictEqual(viewer.traces[0].item_id, '1772654249135');
}

function assertEscaped(html, payload, escapedFragment) {
  assert(!html.includes(payload), `raw payload leaked into HTML: ${payload}`);
  assert(html.includes(escapedFragment), `escaped payload missing from HTML: ${escapedFragment}`);
}

function testUserControlledValuesAreHtmlEscaped() {
  const HATraceViewer = loadViewerClass();
  const viewer = new HATraceViewer();
  const payload = '<img src=x onerror="alert(1)">';
  const escaped = '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;';

  viewer.automations = [{
    entity: 'automation.xss_probe',
    name: payload,
    status: 'running',
    lastTriggered: null,
    triggerCount: 1,
  }];
  assertEscaped(viewer._renderAutoList(), payload, escaped);

  viewer.viewMode = 'all-traces';
  viewer.groupBy = 'automation';
  viewer._allFlatTraces = [{
    id: 'run-xss-1',
    automationName: payload,
    timestamp: new Date('2026-08-20T07:00:00.000Z'),
    status: 'success',
    duration: 10,
    trigger: 'manual',
    lastStep: 'done',
    scriptExecution: 'finished',
  }];
  assertEscaped(viewer._renderTracesList(), payload, escaped);

  viewer._hass = { language: 'en', states: {} };
  viewer._fetchError = payload;
  viewer.render();
  assertEscaped(viewer.shadowRoot.innerHTML, payload, escaped);

  viewer._fetchError = null;
  viewer.config = { title: payload };
  viewer.render();
  assertEscaped(viewer.shadowRoot.innerHTML, payload, escaped);
}

(async () => {
  await testYamlAutomationFetchesPerItemTracesAndClearsStaleState();
  await testNumericAutomationUsesCachedTraceBucket();
  testUserControlledValuesAreHtmlEscaped();
  console.log('trace viewer regression tests passed');
})();
