const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');
async function fixture(language = 'en') {
  const dom = new JSDOM('', { runScripts: 'outside-only', url: 'http://qa.invalid/', virtualConsole: new VirtualConsole() });
  dom.window.ResizeObserver = class { observe() {} disconnect() {} };
  dom.window.eval(fs.readFileSync('ha-trace-viewer.js', 'utf8'));
  const card = dom.window.document.createElement('ha-trace-viewer');
  card.setConfig({ title: 'Authored <title> {literal}', show_support: true }); dom.window.document.body.append(card);
  const requests = [];
  const hass = { language, user: { is_admin: true }, states: {}, themes: {}, callWS: async message => { requests.push(message); return []; } };
  card.hass = hass; await new Promise(resolve => setImmediate(resolve));
  return { dom, card, hass, requests };
}

test('initial Polish regional locale uses Polish search and empty-state guidance', async () => {
  const f = await fixture('pl-PL');
  try {
    assert.equal(f.card.shadowRoot.getElementById('autoSearch').placeholder, 'Wyszukaj automatyzacje...');
    assert.match(f.card.shadowRoot.textContent, /Nie znaleziono automatyzacji/);
    assert.equal(f.card.config.title, 'Authored <title> {literal}');
    assert.equal(f.requests.length, 1);
  } finally { f.card.remove(); f.dom.window.close(); }
});

test('ordinary EN/PL-region/EN keeps search draft, backward selection and trace-read count', async () => {
  const f = await fixture();
  try {
    let input = f.card.shadowRoot.getElementById('autoSearch');
    input.value = 'QA retained'; input.dispatchEvent(new f.dom.window.Event('input', { bubbles: true }));
    input = f.card.shadowRoot.getElementById('autoSearch'); input.focus(); input.setSelectionRange(0, input.value.length, 'backward');
    for (const language of ['pl-PL', 'en']) {
      f.card.hass = { ...f.hass, language };
      input = f.card.shadowRoot.getElementById('autoSearch');
      assert.equal(input.placeholder, language.startsWith('pl') ? 'Wyszukaj automatyzacje...' : 'Search automations...');
      assert.equal(input.value, 'QA retained'); assert.equal(f.card.shadowRoot.activeElement, input);
      assert.equal(input.selectionStart, 0); assert.equal(input.selectionEnd, input.value.length); assert.equal(input.selectionDirection, 'backward');
    }
    assert.equal(f.requests.length, 1);
  } finally { f.card.remove(); f.dom.window.close(); }
});

test('ordinary Polish update translates support caption and accessible dismissal while preserving link', async () => {
  const f = await fixture();
  try {
    f.card.hass = { ...f.hass, language: 'pl' };
    const root = f.card.shadowRoot;
    assert.match(root.querySelector('.donate-section a').textContent, /Dobrowolne wsparcie/);
    assert.equal(root.querySelector('.support-dismiss').getAttribute('aria-label'), 'Ukryj link wsparcia');
    assert.equal(root.querySelector('.donate-section a').href, 'https://buymeacoffee.com/macsiem');
    assert.equal(root.querySelector('.donate-section a').getAttribute('rel'), 'noopener noreferrer');
    assert.equal(f.requests.length, 1);
  } finally { f.card.remove(); f.dom.window.close(); }
});

test('dismissed support remains absent after language changes without extra trace reads', async () => {
  const f = await fixture();
  try {
    f.card.shadowRoot.querySelector('.support-dismiss').click();
    for (const language of ['pl-PL', 'en']) {
      f.card.hass = { ...f.hass, language };
      assert.equal(f.card.shadowRoot.querySelector('.donate-section[data-source="own-card"]'), null);
    }
    assert.equal(f.requests.length, 1);
  } finally { f.card.remove(); f.dom.window.close(); }
});
