const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');

async function fixture(admin = true, language = 'en') {
  const dom = new JSDOM('', { runScripts: 'outside-only', url: 'http://qa.invalid/', virtualConsole: new VirtualConsole() });
  dom.window.ResizeObserver = class { observe() {} disconnect() {} };
  dom.window.eval(fs.readFileSync('ha-trace-viewer.js', 'utf8'));
  const card = dom.window.document.createElement('ha-trace-viewer');
  card.setConfig({ show_support: false }); dom.window.document.body.append(card);
  const requests = [];
  const hass = { language, user: { is_admin: admin }, states: {}, themes: {}, callWS: async message => { requests.push(message); return []; } };
  card.hass = hass; await new Promise(resolve => setImmediate(resolve));
  return { dom, card, hass, requests };
}

test('ordinary locale translates administrator controls without rereading trace history', async () => {
  const f = await fixture();
  try {
    assert.equal(f.card.shadowRoot.getElementById('goToSettingsBtn').title, 'Trace Viewer Settings');
    f.card.hass = { ...f.hass, language: 'pl' };
    assert.equal(f.card.shadowRoot.getElementById('goToSettingsBtn').title, 'Ustawienia Trace Viewer');
    assert.equal(f.requests.length, 1);
  } finally { f.card.remove(); f.dom.window.close(); }
});

test('ordinary locale updates household permission message and keeps independent card language', async () => {
  const a = await fixture(false), b = await fixture(false, 'pl');
  try {
    a.card.hass = { ...a.hass, language: 'pl' };
    assert.match(a.card.shadowRoot.textContent, /Ślady automatyzacji są dostępne/);
    b.card.hass = { ...b.hass, language: 'en' };
    assert.match(b.card.shadowRoot.textContent, /Automation traces are available/);
    assert.match(a.card.shadowRoot.textContent, /Ślady automatyzacji są dostępne/);
    assert.equal(a.requests.length + b.requests.length, 0);
  } finally { for (const f of [a, b]) { f.card.remove(); f.dom.window.close(); } }
});

test('ordinary locale preserves administrator search focus and backward selection', async () => {
  const f = await fixture();
  try {
    const input = f.card.shadowRoot.getElementById('autoSearch');
    input.value = 'QA retained'; input.dispatchEvent(new f.dom.window.Event('input', { bubbles: true }));
    const current = f.card.shadowRoot.getElementById('autoSearch'); current.focus(); current.setSelectionRange(2, 7, 'backward');
    f.card.hass = { ...f.hass, language: 'pl' };
    const translated = f.card.shadowRoot.getElementById('autoSearch');
    assert.equal(f.card.shadowRoot.getElementById('goToSettingsBtn').title, 'Ustawienia Trace Viewer');
    assert.equal(translated.value, 'QA retained'); assert.equal(f.card.shadowRoot.activeElement, translated);
    assert.equal(translated.selectionStart, 2); assert.equal(translated.selectionEnd, 7); assert.equal(translated.selectionDirection, 'backward');
    assert.equal(f.requests.length, 1);
  } finally { f.card.remove(); f.dom.window.close(); }
});

test('same locale and role state update retains form DOM without trace reads', async () => {
  const f = await fixture();
  try {
    const input = f.card.shadowRoot.getElementById('autoSearch'); input.focus();
    f.card.hass = { ...f.hass, states: { 'sensor.qa': { state: '2' } } };
    assert.equal(f.card.shadowRoot.getElementById('autoSearch'), input); assert.equal(f.card.shadowRoot.activeElement, input);
    assert.equal(f.requests.length, 1);
  } finally { f.card.remove(); f.dom.window.close(); }
});
