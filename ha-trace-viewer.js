/* HA Tools split — ha-trace-viewer v4.2.0 (2026-10-15) — single-tool standalone repo */
(function() {
'use strict';

// BEGIN HA TOOLS UI V3 source-sha256=029c06206e55abad9aa09dfcf65bb13027ec24ce6a0bfacc45a938891b27254e
// HA Tools v3: vendored inside each consumer's own closure, never a window API.
function createUiV3({ language = 'en' } = {}) {
  const pl = String(language).startsWith('pl');
  const states = {
    success: ['Success', 'Sukces', '✓'],
    partial: ['Partial', 'Częściowo', '½'],
    unconfirmed: ['Unconfirmed', 'Niepotwierdzony', '?'],
    error: ['Error', 'Błąd', '✕'],
    not_checked: ['Not checked', 'Nie sprawdzono', '–'],
    no_data: ['No data', 'Brak danych', '∅'],
  };
  const status = (value) => {
    const code = typeof value === 'string' && Object.hasOwn(states, value) ? value : 'not_checked';
    const row = states[code];
    return { code, label: row[pl ? 1 : 0], icon: row[2], countsAsSuccess: code === 'success' };
  };
  const statusHtml = (value) => {
    const result = status(value);
    return `<span class="ht-result-state ht-result-state--${result.code}" data-result-state="${result.code}"><span aria-hidden="true">${result.icon}</span> ${result.label}</span>`;
  };
  const css = `
.ht-result-state { display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border:1px solid currentColor;border-radius:6px;font-size:12px;line-height:1.4;white-space:normal; }
.ht-result-state--success { color:#237b3d;background:rgba(35,123,61,.10); }
.ht-result-state--partial { color:#966400;background:rgba(150,100,0,.10); }
.ht-result-state--unconfirmed { color:#ad5200;background:rgba(173,82,0,.10); }
.ht-result-state--error { color:#c32b2b;background:rgba(195,43,43,.10); }
.ht-result-state--not_checked,.ht-result-state--no_data { color:var(--secondary-text-color,#666);background:transparent; }
.ht-result-state--no_data { border-style:dashed; }
:host(.bento-dark) .ht-result-state--success { color:#81cf99; }
:host(.bento-dark) .ht-result-state--partial { color:#efd080; }
:host(.bento-dark) .ht-result-state--unconfirmed { color:#ffb97b; }
:host(.bento-dark) .ht-result-state--error { color:#ff9999; }
`;
  return { status, statusHtml, css };
}
// END HA TOOLS UI V3

// BEGIN HA TOOLS EXPORT V3 source-sha256=bae4197cb254a7e24affbf90f029833127c5ba09b5b96f876a6fd8112f816a3d
/**
 * W6 export dialog. Pure ES module; vendor this factory INSIDE each consumer's
 * own IIFE (remove only the `export` keyword). Never attach it to window.
 * Construction is inert. open() appends only its own container to root.
 *
 * Required dependency injection:
 * root: Element/ShadowRoot; getLanguage(): 'pl'|'en'; createUiV3: existing W4 factory.
 * getContext(): {role,userId,connectionId,datasetId,revision,connected,canExport,
 *                sourceConfirmed}. Identities/revision are nonempty scalar values;
 * bump revision monotonically for source/filter/selection/identity changes,
 * including a restored source; never reuse an old revision. Never return tokens or data.
 * policy: {id,allowlistedFields:string[],neverInclude:[tokens,users,addresses,raw_config]}.
 * formats: explicit subset of ['json','csv','txt']; defaults must be explicit valid choices.
 * buildPayload({context,draft,policy,signal}): read-only, Promise or sync result:
 * {serialized:string,confirmed:true,sourceConfirmed:true,status:'success'|'partial',
 *  included:string[],excluded:string[],sourceLimit:string}.
 * Included/Excluded/sourceLimit describe the REVIEWED CONSUMER policy and actual
 * source limitations in the current language. The consumer MUST explicitly select
 * allowed fields, exclude tokens/users/addresses/raw configuration under EVERY
 * private opt-in, and sanitize CSV formula cells where applicable. A generic
 * recursive export/redactor of arbitrary raw state/config is NOT a valid consumer.
 * This factory cannot inspect or truthfully sanitize an unknown arbitrary schema.
 * For partial reports the consumer also encodes the partial status, inclusion
 * scope and source limitations IN its allowlisted file schema, not only UI text.
 * performDownload({serialized,blob,filename,format,context,signal}): explicit Save
 * only. Return {outcome:'initiated'|'saved'|'unknown'}; 'saved' requires actual
 * adapter confirmation, never infer disk persistence from an anchor click.
 * Optional clock(): monotonic milliseconds; setTimer(fn,ms), clearTimer(handle).
 *
 * Returned API: open({opener}), cancel(), contextChanged(), destroy(). Every open
 * resets private consent. contextChanged() discards bytes/consent immediately;
 * owner also calls cancel/destroy on disconnect. Save ALWAYS rechecks context.
 * One preview on open, explicit Refresh thereafter; bounded 10s, no automatic
 * retries/downloads/persistence. AbortSignal is advisory; late results are ignored.
 */
function createExportDialog(options) {
  const { root, getContext, getLanguage, createUiV3, buildPayload, performDownload,
    clock = () => globalThis.performance.now(), setTimer = (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimer = id => globalThis.clearTimeout(id), defaultFormat, defaultFilename } = options || {};
  const allowedFormats = ['json', 'csv', 'txt', 'yaml'];
  const excludedCategories = ['tokens', 'users', 'addresses', 'raw_config'];
  const strings = value => Array.isArray(value) && value.length > 0 && value.every(v => typeof v === 'string' && v.trim());
  if (!root?.append || !root.ownerDocument || [getContext, getLanguage, createUiV3, buildPayload, performDownload, clock, setTimer, clearTimer].some(fn => typeof fn !== 'function')) {
    throw new TypeError('root and injected getContext/getLanguage/createUiV3/buildPayload/performDownload/clock/timers are required');
  }
  const suppliedPolicy = options.policy;
  if (!suppliedPolicy || typeof suppliedPolicy.id !== 'string' || !suppliedPolicy.id.trim() || !strings(suppliedPolicy.allowlistedFields) || !strings(suppliedPolicy.neverInclude) || excludedCategories.some(key => !suppliedPolicy.neverInclude.includes(key))) {
    throw new TypeError('Explicit reviewed consumer policy with allowlistedFields and neverInclude is required');
  }
  const policy = Object.freeze({ id: suppliedPolicy.id, allowlistedFields: Object.freeze([...suppliedPolicy.allowlistedFields]), neverInclude: Object.freeze([...suppliedPolicy.neverInclude]) });
  if (!strings(options.formats) || options.formats.some(f => !allowedFormats.includes(f)) || new Set(options.formats).size !== options.formats.length || !options.formats.includes(defaultFormat) || typeof defaultFilename !== 'string') {
    throw new TypeError('Explicit formats/defaultFormat/defaultFilename are required');
  }
  const formats = Object.freeze([...options.formats]);
  const doc = root.ownerDocument;
  const mime = { json: 'application/json;charset=utf-8', csv: 'text/csv;charset=utf-8', txt: 'text/plain;charset=utf-8', yaml: 'application/yaml;charset=utf-8' };
  const copy = {
    en: { title: 'Export', filename: 'Filename', format: 'Format', private: 'Include reviewed private fields (this export only)', included: 'Included in the file', excluded: 'Excluded from the file', source: 'Source and limits', preview: 'Exact file content', save: 'Save', refresh: 'Refresh preview', cancel: 'Cancel', busy: 'Building preview… Save waits for confirmed bytes.', changed: 'Choices changed. Refresh preview before Save.', context: 'Source or access changed. Review the source and refresh preview.', unavailable: 'Source unavailable or unconfirmed. Reconnect or confirm the source, then refresh.', invalidFormat: 'Choose an allowed format: JSON, CSV, TXT or YAML as offered.', invalidName: 'Use a basename of 1–128 characters: no paths, control characters, reserved names or leading/trailing spaces.', extension: 'Filename must end with the selected extension. Edit the filename, then refresh.', timeout: 'Preview exceeded 10 seconds. Check the source and explicitly refresh.', buildError: 'Could not build a confirmed preview. Check the source and refresh.', unconfirmed: 'Bytes or source metadata are unconfirmed. Confirm the source and refresh.', noData: 'No confirmed file content. Select available data and refresh.', saving: 'Handing off the confirmed preview… Wait for the adapter result.', initiated: 'Download initiated. Saving to the filesystem is not confirmed. Refresh only for a new export intent.', saved: 'Save confirmed by the download adapter.', unknown: 'Download result unconfirmed. Check the previous attempt before explicitly refreshing for a new export intent.' },
    pl: { title: 'Eksport', filename: 'Nazwa pliku', format: 'Format', private: 'Dołącz sprawdzone pola prywatne (tylko ten eksport)', included: 'W pliku jest', excluded: 'W pliku nie ma', source: 'Źródło i ograniczenia', preview: 'Dokładna zawartość pliku', save: 'Zapisz', refresh: 'Odśwież podgląd', cancel: 'Anuluj', busy: 'Przygotowywanie podglądu… Zapis wymaga potwierdzonej zawartości.', changed: 'Wybór zmieniony. Odśwież podgląd przed zapisem.', context: 'Źródło lub uprawnienia zmienione. Sprawdź źródło i odśwież podgląd.', unavailable: 'Źródło niedostępne lub niepotwierdzone. Połącz lub potwierdź źródło i odśwież.', invalidFormat: 'Wybierz dostępny format: JSON, CSV, TXT lub YAML z listy.', invalidName: 'Użyj nazwy pliku o długości 1–128 znaków: bez ścieżek, znaków sterujących, nazw zastrzeżonych i skrajnych spacji.', extension: 'Nazwa pliku musi mieć rozszerzenie wybranego formatu. Popraw nazwę i odśwież.', timeout: 'Podgląd przekroczył 10 sekund. Sprawdź źródło i jawnie odśwież.', buildError: 'Nie udało się przygotować potwierdzonego podglądu. Sprawdź źródło i odśwież.', unconfirmed: 'Zawartość lub opis źródła niepotwierdzony. Potwierdź źródło i odśwież.', noData: 'Brak potwierdzonej zawartości pliku. Wybierz dostępne dane i odśwież.', saving: 'Przekazywanie potwierdzonego podglądu… Poczekaj na wynik zapisu.', initiated: 'Pobieranie rozpoczęte. Zapis na dysku nie jest potwierdzony. Odśwież tylko dla nowej próby eksportu.', saved: 'Adapter pobierania potwierdził zapis.', unknown: 'Wynik pobierania niepotwierdzony. Sprawdź poprzednią próbę przed jawnym odświeżeniem dla nowego eksportu.' },
  };
  const css = `
[data-ha-tools-export] { min-width:0;max-width:100%;color:var(--primary-text-color,#1e293b);font:inherit; }
[data-ha-tools-export] * { box-sizing:border-box; }
[data-ha-tools-export] dialog { width:min(520px,calc(100vw - 32px));max-width:none;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);min-width:0;margin:auto;padding:0;border:1px solid var(--divider-color,#e2e8f0);border-radius:18px;background:var(--card-background-color,#fff);color:inherit;font:inherit;box-shadow:0 24px 64px #0f172a33;overflow:hidden; }
[data-ha-tools-export] dialog[open] { display:flex;flex-direction:column; }
[data-ha-tools-export] dialog::backdrop { background:#0f172a66; }
[data-ha-tools-export] .ht-export-body { min-height:0;overflow:auto;overscroll-behavior:contain;padding:24px; }
[data-ha-tools-export] h2,[data-ha-tools-export] h3,[data-ha-tools-export] p,[data-ha-tools-export] li { overflow-wrap:anywhere;white-space:normal; }
[data-ha-tools-export] h2 { margin:0 0 16px;font-size:1.25em;line-height:1.4; }
[data-ha-tools-export] h3 { margin:16px 0 6px;font-size:1em;line-height:1.5; }
[data-ha-tools-export] p { line-height:1.5; }
[data-ha-tools-export] .ht-export-fields { display:grid;grid-template-columns:minmax(0,1fr);gap:12px; }
[data-ha-tools-export] label { display:flex;flex-direction:column;gap:6px;min-width:0;overflow-wrap:anywhere; }
[data-ha-tools-export] .ht-export-format { margin-top:16px; }
[data-ha-tools-export] .ht-export-private { flex-direction:row;align-items:center;min-height:44px;margin-top:12px; }
[data-ha-tools-export] input:not([type=checkbox]),[data-ha-tools-export] select,[data-ha-tools-export] button { font:inherit;min-width:44px;min-height:44px;max-width:100%; }
[data-ha-tools-export] input:not([type=checkbox]),[data-ha-tools-export] select { width:100%;color:inherit;background:var(--ht-export-field-bg,#f8fafc);border:1px solid var(--divider-color,#cbd5e1);border-radius:8px;padding:8px 12px; }
[data-ha-tools-export] input[type=checkbox] { width:24px;height:24px;flex:none;margin:10px; }
[data-ha-tools-export] [data-export-scope] { padding:12px 14px;border-radius:10px;margin-top:14px; }
[data-ha-tools-export] [data-export-scope] h3 { margin:0 0 6px; }
[data-ha-tools-export] [data-export-scope=included] { background:var(--ht-export-included-bg,#ecfdf3);color:var(--ht-export-included-text,#166534); }
[data-ha-tools-export] [data-export-scope=excluded] { background:var(--ht-export-excluded-bg,#fff1f2);color:var(--ht-export-excluded-text,#9f1239); }
[data-ha-tools-export] ul { padding:0;margin:0;list-style:none; }
[data-ha-tools-export] li { display:flex;gap:6px;line-height:1.5; }
[data-ha-tools-export] li + li { margin-top:4px; }
[data-ha-tools-export] [data-export-scope=included] li::before { content:'✓';flex:none; }
[data-ha-tools-export] [data-export-scope=excluded] li::before { content:'×';flex:none; }
[data-ha-tools-export] button { padding:8px 12px;white-space:normal;overflow-wrap:anywhere;cursor:pointer;border:1px solid transparent;border-radius:8px;color:var(--ht-export-accent,#0369a1);background:transparent; }
[data-ha-tools-export] [data-export=save] { color:var(--ht-export-save-text,#fff);background:var(--ht-export-accent,#0369a1); }
[data-ha-tools-export] :focus-visible { outline:3px solid var(--ht-export-accent,#0369a1);outline-offset:2px; }
[data-ha-tools-export] button:disabled { cursor:default;opacity:.6; }
[data-ha-tools-export] .ht-export-actions { display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;flex:none;padding:12px 24px;border-top:1px solid var(--divider-color,#e2e8f0);background:var(--card-background-color,#fff); }
[data-ha-tools-export] pre { max-width:100%;min-width:0;max-height:260px;overflow:auto;white-space:pre;margin:0;padding:12px;border:1px solid var(--divider-color,#cbd5e1);border-radius:8px;background:var(--ht-export-field-bg,#f8fafc); }
:host(.bento-dark) { --ht-export-field-bg:#0f172a;--ht-export-included-bg:#103827;--ht-export-included-text:#bbf7d0;--ht-export-excluded-bg:#43212a;--ht-export-excluded-text:#fda4af;--ht-export-accent:#7dd3fc;--ht-export-save-text:#0f172a; }
@media (max-width:399px) { [data-ha-tools-export] .ht-export-body { padding:16px; } [data-ha-tools-export] .ht-export-actions { padding:12px 16px;gap:6px; } }
@media (max-width:319px) { [data-ha-tools-export] dialog { width:calc(100vw - 16px); } [data-ha-tools-export] .ht-export-actions button { flex:1 1 auto; } }
`;  let container, nodes, L, ui, opener, alive = false, destroyed = false, serial = 0;
  let pending = null, handoff = null, ready = null, observed = null;
  const listeners = [];
  const on = (target, event, handler, capture = false) => {
    target.addEventListener(event, handler, capture);
    listeners.push(() => target.removeEventListener(event, handler, capture));
  };
  const contextKeys = ['role', 'userId', 'connectionId', 'datasetId', 'revision'];
  function readContext() {
    try {
      const value = getContext();
      if (!value || contextKeys.some(k => !['string', 'number'].includes(typeof value[k]) || String(value[k]).trim() === '' || (typeof value[k] === 'number' && !Number.isFinite(value[k])))) return null;
      return Object.freeze(Object.fromEntries([...contextKeys, 'connected', 'canExport', 'sourceConfirmed'].map(k => [k, value[k]])));
    } catch { return null; }
  }
  const same = (a, b) => !!a && !!b && [...contextKeys, 'connected', 'canExport', 'sourceConfirmed'].every(k => a[k] === b[k]);
  const available = c => !!c && c.connected === true && c.canExport === true && c.sourceConfirmed === true;
  const draft = () => Object.freeze({ filename: nodes.filename.value, format: nodes.format.value, includePrivate: nodes.private.checked });
  const sameDraft = (a, b) => a.filename === b.filename && a.format === b.format && a.includePrivate === b.includePrivate;
  function validation(value) {
    if (!formats.includes(value.format)) return 'invalidFormat';
    const name = value.filename;
    if (!name || [...name].length > 128 || name !== name.trim() || /[\p{Cc}\p{Cf}/\\<>:"|?*]/u.test(name) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/i.test(name)) return 'invalidName';
    if (!name.endsWith(`.${value.format}`) || name.length <= value.format.length + 1) return 'extension';
    return null;
  }
  function status(code, message) {
    if (!alive) return;
    const result = ui.status(code); // exact existing W4 labels/icons/codes
    nodes.status.className = `ht-result-state ht-result-state--${result.code}`;
    nodes.status.dataset.resultState = result.code;
    nodes.status.replaceChildren();
    const icon = doc.createElement('span'); icon.setAttribute('aria-hidden', 'true'); icon.textContent = result.icon;
    nodes.status.append(icon, doc.createTextNode(` ${result.label}`));
    nodes.message.textContent = ` ${L[message]}`;
    nodes.save.disabled = !ready || !!pending || !!handoff;
    nodes.refresh.disabled = !!pending || !!handoff;
  }
  function stop(job) {
    if (!job) return;
    if (job.timer !== null) clearTimer(job.timer);
    job.timer = null; job.controller.abort();
  }
  function discard(resetPrivate = false) {
    serial++; stop(pending); pending = null; ready = null;
    if (alive) {
      nodes.preview.textContent = ''; nodes.included.replaceChildren(); nodes.excluded.replaceChildren(); nodes['source-limit'].textContent = '';
      if (resetPrivate) nodes.private.checked = false;
    }
  }
  function contextChanged() {
    if (!alive) return;
    observed = readContext(); discard(true);
    // Once a handoff began we cannot retract a browser download. Ignore its late
    // callback and retain the prohibition on a second write until it settles.
    if (handoff) handoff.controller.abort();
    status(root.isConnected && available(observed) ? 'unconfirmed' : 'no_data', 'context');
  }
  function validContext(original) {
    const current = readContext();
    if (!root.isConnected || !same(original, current) || !available(current)) { contextChanged(); return false; }
    return true;
  }
  function changeDraft() {
    if (!alive) return;
    if (!same(observed, readContext())) { contextChanged(); return; }
    discard();
    const error = validation(draft()); status(error ? 'error' : 'not_checked', error || 'changed');
  }
  function fillList(node, items) {
    node.replaceChildren(...items.map(text => { const li = doc.createElement('li'); li.textContent = text; return li; }));
  }
  async function refresh() {
    if (!alive || pending || handoff) return;
    const current = readContext();
    if (!same(observed, current)) { observed = current; discard(true); }
    const value = draft(), error = validation(value);
    discard();
    if (error) { status('error', error); return; }
    if (!root.isConnected || !available(current)) { status(!root.isConnected || current?.connected === false ? 'no_data' : 'unconfirmed', 'unavailable'); return; }
    observed = current;
    const job = { id: serial, context: current, draft: value, started: clock(), controller: new globalThis.AbortController(), timer: null };
    pending = job; status('not_checked', 'busy');
    const timeout = () => {
      if (!alive || pending !== job) return;
      discard(); status('unconfirmed', 'timeout');
    };
    job.timer = setTimer(timeout, 10000);
    try {
      const payload = await buildPayload(Object.freeze({ context: current, draft: value, policy, signal: job.controller.signal }));
      if (!alive || pending !== job || job.id !== serial) return;
      if (clock() - job.started >= 10000) { timeout(); return; }
      if (!validContext(current)) return;
      clearTimer(job.timer); job.timer = null;
      if (!sameDraft(value, draft())) { changeDraft(); return; }
      const { serialized, confirmed, sourceConfirmed, status: resultState, included, excluded, sourceLimit } = payload || {};
      if (resultState === 'no_data' || serialized === '') { pending = null; status('no_data', 'noData'); return; }
      if (confirmed !== true || sourceConfirmed !== true || !['success', 'partial'].includes(resultState) || typeof serialized !== 'string' || !strings(included) || !strings(excluded) || typeof sourceLimit !== 'string' || !sourceLimit.trim()) {
        pending = null; status('unconfirmed', 'unconfirmed'); return;
      }
      // Freeze the only serialized bytes and build the only Blob NOW; Save never
      // re-runs serialization or builds a second payload from potentially newer data.
      ready = Object.freeze({ serialized, blob: new globalThis.Blob([serialized], { type: mime[value.format] }), context: current, draft: value });
      nodes.preview.textContent = ready.serialized;
      fillList(nodes.included, [...included]); fillList(nodes.excluded, [...excluded]);
      nodes['source-limit'].textContent = sourceLimit;
      pending = null; status(resultState, 'changed'); nodes.message.textContent = '';
    } catch {
      if (!alive || pending !== job || job.id !== serial) return;
      if (clock() - job.started >= 10000) { timeout(); return; }
      if (!validContext(current)) return;
      discard(); status('error', 'buildError');
    }
  }
  async function save() {
    if (!alive || !ready || pending || handoff) return;
    if (!validContext(ready.context)) return;
    const value = draft(), error = validation(value);
    if (error || !sameDraft(value, ready.draft) || nodes.preview.textContent !== ready.serialized) {
      discard(); status(error ? 'error' : 'unconfirmed', error || 'changed'); return;
    }
    const snapshot = ready; ready = null; // consume intent BEFORE invoking adapter
    const job = { id: serial, context: snapshot.context, controller: new globalThis.AbortController() };
    handoff = job; status('unconfirmed', 'saving');
    // choices cannot initiate another preview while the adapter result is unknown
    for (const key of ['filename', 'format', 'private']) nodes[key].disabled = true;
    try {
      const result = await performDownload(Object.freeze({ serialized: snapshot.serialized, blob: snapshot.blob, filename: snapshot.draft.filename, format: snapshot.draft.format, context: snapshot.context, signal: job.controller.signal }));
      if (!alive || handoff !== job || job.id !== serial || !validContext(job.context)) return;
      status(result?.outcome === 'saved' ? 'success' : 'unconfirmed', result?.outcome === 'saved' ? 'saved' : result?.outcome === 'initiated' ? 'initiated' : 'unknown');
    } catch {
      if (alive && handoff === job && job.id === serial && validContext(job.context)) status('unconfirmed', 'unknown');
    } finally {
      if (handoff === job) {
        handoff = null;
        if (alive) {
          for (const key of ['filename', 'format', 'private']) nodes[key].disabled = false;
          nodes.refresh.disabled = false; nodes.save.disabled = true;
          if (job.id !== serial) status('unconfirmed', 'unknown');
        }
      }
    }
  }
  function focusable() {
    return Array.from(nodes.dialog.querySelectorAll('input,select,button,[tabindex="0"]')).filter(el => !el.disabled);
  }
  function keydown(event) {
    if (!alive) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); }
    if (event.key === 'Tab') {
      const items = focusable(), first = items[0], last = items.at(-1);
      const active = nodes.dialog.getRootNode().activeElement || root.activeElement || doc.activeElement;
      if (event.shiftKey && (active === first || !nodes.dialog.contains(active))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (active === last || !nodes.dialog.contains(active))) { event.preventDefault(); first?.focus(); }
    }
  }
  function cancel() {
    if (!alive) return;
    discard(true); if (handoff) handoff.controller.abort();
    alive = false; listeners.splice(0).forEach(off => off());
    if (nodes.dialog.open) nodes.dialog.close();
    container.remove();
    container = null; nodes = null; observed = null;
    // A pending handoff remains latched until settled: reopening never repeats it.
    if (opener?.isConnected && typeof opener.focus === 'function') opener.focus();
    opener = null;
  }
  function open({ opener: target } = {}) {
    if (destroyed) throw new Error('Export dialog destroyed');
    if (alive) return;
    const language = String(getLanguage());
    L = copy[language.startsWith('pl') ? 'pl' : 'en'];
    ui = createUiV3({ language });
    opener = target || root.activeElement || doc.activeElement;
    container = doc.createElement('div'); container.setAttribute('data-ha-tools-export', '');
    // The own shadow boundary contains CSS and local IDs; adjacent W4 status
    // elements retain their existing styling. Consumers can query this open root.
    const shadow = container.attachShadow({ mode: 'open' });
    if (root.host?.classList.contains('bento-dark')) container.classList.add('bento-dark');
    const style = doc.createElement('style'); style.textContent = ':host{display:block;min-width:0;max-width:100%;}' + css + '\n' + ui.css;
    shadow.append(style);
    const shell = doc.createElement('div'); shell.setAttribute('data-ha-tools-export', ''); shadow.append(shell);
    nodes = {};
    const make = (tag, key, parent, text) => { const node = doc.createElement(tag); if (key) { node.dataset.export = key; nodes[key] = node; } if (text) node.textContent = text; parent.append(node); return node; };
    const dialog = make('dialog', 'dialog', shell); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
    const body = make('div', null, dialog); body.className = 'ht-export-body';
    const title = make('h2', 'title', body, L.title);
    // Locally unique IDs, no random or global counters/persistent state.
    const prefix = `ht-export-${String(clock()).replace(/\W/g, '')}`;
    title.id = prefix + '-title'; dialog.setAttribute('aria-labelledby', title.id);
    const fields = make('div', null, body); fields.className = 'ht-export-fields';
    const filenameLabel = make('label', null, fields); make('span', null, filenameLabel, L.filename);
    const filename = make('input', 'filename', filenameLabel); filename.type = 'text'; filename.value = defaultFilename; filename.autocomplete = 'off';
    for (const key of ['included', 'excluded']) {
      const scope = make('section', null, body); scope.dataset.exportScope = key;
      make('h3', null, scope, L[key]); make('ul', key, scope);
    }
    const formatLabel = make('label', null, body); formatLabel.className = 'ht-export-format'; make('span', null, formatLabel, L.format);
    const format = make('select', 'format', formatLabel);
    formats.forEach(value => { const option = make('option', null, format, value.toUpperCase()); option.value = value; }); format.value = defaultFormat;
    const privateLabel = make('label', null, body); privateLabel.className = 'ht-export-private';
    const privateInput = make('input', 'private', privateLabel); privateInput.type = 'checkbox'; privateInput.checked = false; make('span', null, privateLabel, L.private);
    const statusLine = make('p', null, body); statusLine.setAttribute('role', 'status'); statusLine.setAttribute('aria-live', 'polite');
    make('span', 'status', statusLine); make('span', 'message', statusLine);
    make('h3', null, body, L.source); make('p', 'source-limit', body);
    const previewHeading = make('h3', null, body, L.preview); previewHeading.id = prefix + '-preview';
    const preview = make('pre', 'preview', body); preview.tabIndex = 0; preview.setAttribute('aria-labelledby', previewHeading.id);
    const actions = make('div', null, dialog); actions.className = 'ht-export-actions';
    for (const key of ['refresh', 'save', 'cancel']) { const button = make('button', key, actions, L[key]); button.type = 'button'; }
    root.append(container); alive = true; observed = readContext();
    for (const [key, event] of [['filename', 'input'], ['format', 'change'], ['private', 'change']]) on(nodes[key], event, changeDraft);
    on(nodes.refresh, 'click', refresh); on(nodes.save, 'click', save); on(nodes.cancel, 'click', cancel);
    on(dialog, 'keydown', keydown);
    on(dialog, 'cancel', event => { event.preventDefault(); cancel(); });
    on(dialog, 'close', () => { if (alive && nodes?.dialog === dialog) cancel(); });
    try {
      if (typeof dialog.showModal !== 'function') throw new Error('Native export dialog is unavailable');
      dialog.showModal();
    } catch (error) {
      cancel();
      throw error;
    }
    // The consumer supplies exact opener even when its shadow DOM hides activeElement.
    filename.focus();
    if (handoff) {
      for (const key of ['filename', 'format', 'private']) nodes[key].disabled = true;
      preview.focus();
      status('unconfirmed', 'saving');
    } else { status('not_checked', 'changed'); void refresh(); }
  }
  function destroy() { cancel(); destroyed = true; }
  return Object.freeze({ open, cancel, contextChanged, destroy });
}
// END HA TOOLS EXPORT V3

/* BEGIN INLINE shared/ha-tools-trace-contract.js */
// Vendored from ha-automation-analyzer 14e297fd841ba6838e6ea31e3346d7cf3d887156.
// Input SHA256: 0f891270a1d1fc04636e1b8752b8a3856371068a3be98a67797639b566b237b3.
// Local factory: unchanged Analyzer snapshot; no global registration or second diff engine.
function createHAToolsTraceContract() {
// BEGIN ANALYZER TRACE SNAPSHOT
const AA_TRACE_SOURCE = 'home_assistant.trace_ws_v1';
const AA_TRACE_MAX_BYTES = 2 * 1024 * 1024;
const AA_TRACE_MAX_DEPTH = 16;
const AA_TRACE_MAX_STRING_BYTES = 4096;
const AA_TRACE_MAX_OBJECT_FIELDS = 128;
const AA_TRACE_MAX_ARRAY = 4096;
const AA_TRACE_MAX_PATHS = 512;
const AA_TRACE_MAX_ELEMENTS = 4096;
const AA_TRACE_MAX_SELECTED_RUNS = 100;
const AA_TRACE_MAX_GLOBAL_RUNS = 5000;
const AA_TRACE_BANNED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const AA_TRACE_LIST_FIELDS = new Set([
  'last_step', 'run_id', 'state', 'script_execution', 'timestamp', 'domain',
  'item_id', 'not_triggered', 'error', 'trigger'
]);
const AA_TRACE_FULL_FIELDS = new Set([
  ...AA_TRACE_LIST_FIELDS, 'trace', 'config', 'blueprint_inputs', 'context'
]);
const AA_TRACE_LEGACY_FIELDS = new Set([
  'last_step', 'run_id', 'state', 'script_execution', 'timestamp', 'domain',
  'item_id', 'not_triggered', 'error', 'trigger', 'path'
]);
const AA_TRACE_ELEMENT_FIELDS = new Set([
  'path', 'timestamp', 'child_id', 'changed_variables', 'error',
  'template_errors', 'result'
]);
const AA_TRACE_PATH_PATTERN = /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/;
const AA_TRACE_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

function _aaTraceObservedAt(value) {
  if (_aaParseTimestamp(value) !== null) return value;
  return new Date().toISOString();
}

function _aaTraceCapability(status, observedAt, evidence, data) {
  const result = {
    status,
    source: AA_TRACE_SOURCE,
    observed_at: _aaTraceObservedAt(observedAt),
    evidence: evidence || {}
  };
  if (data !== undefined) result.data = data;
  return result;
}

function _aaUtf8Bytes(value, maxBytes = Infinity) {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x7f) bytes += 1;
    else if (codeUnit <= 0x7ff) bytes += 2;
    else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const low = value.charCodeAt(index + 1);
      if (!(low >= 0xdc00 && low <= 0xdfff)) return Infinity;
      bytes += 4;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return Infinity;
    } else bytes += 3;
    if (bytes > maxBytes) return Infinity;
  }
  return bytes;
}

function _aaIsPlainObject(value) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const proto = Reflect.getPrototypeOf(value);
    if (proto === null) return true;
    if (Reflect.getPrototypeOf(proto) !== null) return false;
    const constructorDescriptor = Reflect.getOwnPropertyDescriptor(proto, 'constructor');
    return Boolean(
      constructorDescriptor && 'value' in constructorDescriptor
      && typeof constructorDescriptor.value === 'function'
      && constructorDescriptor.value.name === 'Object'
    );
  } catch (_error) {
    return false;
  }
}

function _aaInspectTracePayload(value, options = {}) {
  const maxBytes = options.maxBytes || AA_TRACE_MAX_BYTES;
  const maxRootArray = options.maxRootArray || AA_TRACE_MAX_ARRAY;
  const wideObject = options.wideObject || null;
  const wideObjectMaxFields = options.wideObjectMaxFields || AA_TRACE_MAX_OBJECT_FIELDS;
  let bytes = 0;
  const seen = new WeakSet();

  const addBytes = amount => {
    bytes += amount;
    if (!Number.isFinite(bytes) || bytes > maxBytes) throw new Error('trace_payload_limit');
  };

  const visit = (current, depth) => {
    if (depth > AA_TRACE_MAX_DEPTH) throw new Error('trace_depth_limit');
    if (current === null) { addBytes(4); return; }
    if (typeof current === 'string') {
      const length = _aaUtf8Bytes(current, AA_TRACE_MAX_STRING_BYTES);
      if (length > AA_TRACE_MAX_STRING_BYTES) throw new Error('trace_string_limit');
      addBytes(length + 2);
      return;
    }
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw new Error('trace_non_finite_number');
      addBytes(16);
      return;
    }
    if (typeof current === 'boolean') { addBytes(5); return; }
    if (typeof current !== 'object') throw new Error('trace_invalid_type');
    if (seen.has(current)) throw new Error('trace_cycle');
    seen.add(current);

    if (Array.isArray(current)) {
      const arrayLimit = depth === 0 ? maxRootArray : AA_TRACE_MAX_ARRAY;
      if (current.length > arrayLimit) throw new Error('trace_array_limit');
      const ownKeys = Reflect.ownKeys(current);
      for (const key of ownKeys) {
        if (key === 'length') continue;
        if (typeof key !== 'string' || !/^\d+$/.test(key)) throw new Error('trace_array_property');
        const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) throw new Error('trace_accessor');
      }
      addBytes(2);
      for (let index = 0; index < current.length; index += 1) {
        const descriptor = Reflect.getOwnPropertyDescriptor(current, String(index));
        if (!descriptor || !('value' in descriptor)) throw new Error('trace_sparse_array');
        visit(descriptor.value, depth + 1);
      }
      seen.delete(current);
      return;
    }

    if (!_aaIsPlainObject(current)) throw new Error('trace_non_plain_object');
    const ownKeys = Reflect.ownKeys(current);
    const objectLimit = current === wideObject ? wideObjectMaxFields : AA_TRACE_MAX_OBJECT_FIELDS;
    if (ownKeys.length > objectLimit) throw new Error('trace_object_fields_limit');
    addBytes(2);
    for (const key of ownKeys) {
      if (typeof key !== 'string' || AA_TRACE_BANNED_KEYS.has(key)) throw new Error('trace_banned_key');
      const keyBytes = _aaUtf8Bytes(key, AA_TRACE_MAX_STRING_BYTES);
      if (keyBytes > AA_TRACE_MAX_STRING_BYTES) throw new Error('trace_key_limit');
      addBytes(keyBytes + 2);
      const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) throw new Error('trace_accessor');
      visit(descriptor.value, depth + 1);
    }
    seen.delete(current);
  };

  try {
    visit(value, 0);
    return { ok: true, bytes };
  } catch (_error) {
    return { ok: false, bytes };
  }
}

function _aaHasOnlyFields(value, allowed) {
  return Reflect.ownKeys(value).every(key => typeof key === 'string' && allowed.has(key));
}

function _aaParseTimestamp(value) {
  if (typeof value !== 'string' || !AA_TRACE_TIMESTAMP_PATTERN.test(value)) return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function _aaCompareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function _aaValidateRunTimestamp(timestamp, state) {
  if (!_aaIsPlainObject(timestamp) || !_aaHasOnlyFields(timestamp, new Set(['start', 'finish']))) return null;
  const start = _aaParseTimestamp(timestamp.start);
  const finish = timestamp.finish === null ? null : _aaParseTimestamp(timestamp.finish);
  if (start === null || (timestamp.finish !== null && finish === null)) return null;
  if (state === 'stopped' && finish === null) return null;
  if (finish !== null && finish < start) return null;
  return { start, finish };
}

function _aaValidateRunIdentity(value, expectedItemId, global = false) {
  if (typeof value.run_id !== 'string' || !value.run_id) return null;
  if (value.domain !== 'automation') return null;
  if (typeof value.item_id !== 'string' || !value.item_id) return null;
  if (!global && value.item_id !== expectedItemId) return null;
  if (value.state !== 'running' && value.state !== 'stopped') return null;
  if (value.script_execution !== null && typeof value.script_execution !== 'string') return null;
  const timestamp = _aaValidateRunTimestamp(value.timestamp, value.state);
  return timestamp ? { timestamp } : null;
}

function _aaNormalizeListChecked(payload, options = {}) {
  const observedAt = options.observedAt;
  const expectedItemId = options.expectedItemId;
  const global = options.global === true;
  const maxRuns = global ? AA_TRACE_MAX_GLOBAL_RUNS : AA_TRACE_MAX_SELECTED_RUNS;
  const inspection = _aaInspectTracePayload(payload, { maxRootArray: maxRuns });
  if (!inspection.ok || !Array.isArray(payload) || payload.length > maxRuns
    || (!global && typeof expectedItemId !== 'string')) {
    return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/list', error_code: 'malformed' });
  }
  const runs = [];
  for (const value of payload) {
    if (!_aaIsPlainObject(value) || !_aaHasOnlyFields(value, AA_TRACE_LIST_FIELDS)) {
      return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/list', error_code: 'malformed' });
    }
    const identity = _aaValidateRunIdentity(value, expectedItemId, global);
    if (!identity) return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/list', error_code: 'malformed' });
    if (value.not_triggered !== undefined && typeof value.not_triggered !== 'boolean') {
      return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/list', error_code: 'malformed' });
    }
    runs.push({
      run_id: value.run_id,
      item_id: value.item_id,
      run_state: value.state,
      script_execution: value.script_execution,
      kind: value.not_triggered === true ? 'non_execution' : 'execution',
      started_at: value.timestamp.start,
      finished_at: value.timestamp.finish,
      run_duration_ms: identity.timestamp.finish === null
        ? null : identity.timestamp.finish - identity.timestamp.start
    });
  }
  runs.sort((left, right) => {
    const timeDelta = _aaParseTimestamp(right.started_at) - _aaParseTimestamp(left.started_at);
    return timeDelta || _aaCompareText(left.run_id, right.run_id);
  });
  const status = runs.length ? 'available' : 'no_data';
  return _aaTraceCapability(status, observedAt, {
    endpoint: 'trace/list',
    schema: 'ha-trace-list-v1',
    run_count: runs.length
  }, { runs });
}

function _aaNormalizeList(payload, options = {}) {
  try {
    return _aaNormalizeListChecked(payload, options);
  } catch (_error) {
    return _aaTraceCapability('malformed', options.observedAt, {
      endpoint: 'trace/list', error_code: 'malformed'
    });
  }
}

function _aaTraceElementStatus(value) {
  if (Object.hasOwn(value, 'error') || (Array.isArray(value.template_errors) && value.template_errors.length)) return 'error';
  if (_aaIsPlainObject(value.changed_variables) && Reflect.ownKeys(value.changed_variables).length) return 'changed';
  if (value.result === false) return 'skipped';
  return 'pass';
}

function _aaNormalizeFullChecked(payload, options = {}) {
  const observedAt = options.observedAt;
  const expectedItemId = options.expectedItemId;
  if (!_aaIsPlainObject(payload) || typeof expectedItemId !== 'string') {
    return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/get', error_code: 'malformed' });
  }
  const isV1 = Object.hasOwn(payload, 'trace');
  const isLegacy = Object.hasOwn(payload, 'path');
  if (isV1 === isLegacy) return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/get', error_code: 'malformed' });
  const traceDescriptor = isV1 ? Reflect.getOwnPropertyDescriptor(payload, 'trace') : null;
  const wideObject = traceDescriptor && 'value' in traceDescriptor ? traceDescriptor.value : null;
  const inspection = _aaInspectTracePayload(payload, {
    wideObject,
    wideObjectMaxFields: AA_TRACE_MAX_PATHS
  });
  if (!inspection.ok) {
    return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/get', error_code: 'malformed' });
  }
  const allowed = isV1 ? AA_TRACE_FULL_FIELDS : AA_TRACE_LEGACY_FIELDS;
  if (!_aaHasOnlyFields(payload, allowed)) {
    return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/get', error_code: 'malformed' });
  }
  const identity = _aaValidateRunIdentity(payload, expectedItemId);
  if (!identity) return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/get', error_code: 'malformed' });
  if (payload.not_triggered !== undefined && typeof payload.not_triggered !== 'boolean') {
    return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/get', error_code: 'malformed' });
  }

  const rawNodes = [];
  if (isV1) {
    if (!_aaIsPlainObject(payload.trace)) return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/get', error_code: 'malformed' });
    const paths = Reflect.ownKeys(payload.trace);
    if (paths.length > AA_TRACE_MAX_PATHS) return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/get', error_code: 'malformed' });
    for (const path of paths) {
      if (typeof path !== 'string' || !AA_TRACE_PATH_PATTERN.test(path)) {
        return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/get', error_code: 'malformed' });
      }
      const values = payload.trace[path];
      if (!Array.isArray(values)) return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/get', error_code: 'malformed' });
      for (let ordinal = 0; ordinal < values.length; ordinal += 1) {
        if (rawNodes.length >= AA_TRACE_MAX_ELEMENTS) {
          return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/get', error_code: 'malformed' });
        }
        rawNodes.push({ value: values[ordinal], path, ordinal });
      }
    }
  } else {
    if (!Array.isArray(payload.path)) return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/get', error_code: 'malformed' });
    const ordinalByPath = new Map();
    for (const value of payload.path) {
      if (rawNodes.length >= AA_TRACE_MAX_ELEMENTS) {
        return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/get', error_code: 'malformed' });
      }
      const path = value?.path;
      const ordinal = ordinalByPath.get(path) || 0;
      ordinalByPath.set(path, ordinal + 1);
      rawNodes.push({ value, path, ordinal });
    }
  }
  if (rawNodes.length > AA_TRACE_MAX_ELEMENTS) return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/get', error_code: 'malformed' });

  const nodes = [];
  for (const raw of rawNodes) {
    const value = raw.value;
    if (!_aaIsPlainObject(value) || !_aaHasOnlyFields(value, AA_TRACE_ELEMENT_FIELDS)) {
      return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/get', error_code: 'malformed' });
    }
    if (value.path !== raw.path || !AA_TRACE_PATH_PATTERN.test(raw.path)) {
      return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/get', error_code: 'malformed' });
    }
    const timestamp = _aaParseTimestamp(value.timestamp);
    if (timestamp === null || timestamp < identity.timestamp.start
      || (identity.timestamp.finish !== null && timestamp > identity.timestamp.finish)) {
      return _aaTraceCapability('malformed', observedAt, { endpoint: 'trace/get', error_code: 'malformed' });
    }
    nodes.push({
      path: raw.path,
      ordinal: raw.ordinal,
      status: _aaTraceElementStatus(value),
      offset_ms: timestamp - identity.timestamp.start,
      _timestamp: timestamp
    });
  }
  nodes.sort((left, right) => left._timestamp - right._timestamp
    || _aaCompareText(left.path, right.path) || left.ordinal - right.ordinal);
  for (const node of nodes) delete node._timestamp;
  const schema = isV1 ? 'ha-trace-v1' : 'ha-trace-legacy-path-v0';
  return _aaTraceCapability('available', observedAt, {
    endpoint: 'trace/get',
    schema,
    node_count: nodes.length,
    run_state: payload.state
  }, {
    run_id: payload.run_id,
    item_id: payload.item_id,
    run_state: payload.state,
    kind: payload.not_triggered === true ? 'non_execution' : 'execution',
    run_duration_ms: identity.timestamp.finish === null
      ? null : identity.timestamp.finish - identity.timestamp.start,
    nodes
  });
}

function _aaNormalizeFull(payload, options = {}) {
  try {
    return _aaNormalizeFullChecked(payload, options);
  } catch (_error) {
    return _aaTraceCapability('malformed', options.observedAt, {
      endpoint: 'trace/get', error_code: 'malformed'
    });
  }
}

function _aaClassifyTraceError(error, options = {}) {
  let code = null;
  if (_aaIsPlainObject(error)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(error, 'code');
    if (descriptor && 'value' in descriptor && typeof descriptor.value === 'string') code = descriptor.value;
  }
  const status = code === 'unauthorized' ? 'permission_denied'
    : code === 'not_found' ? 'no_data' : 'unavailable';
  return _aaTraceCapability(status, options.observedAt, {
    endpoint: options.endpoint || 'trace',
    error_code: code === 'unauthorized' || code === 'not_found' ? code : 'unavailable'
  });
}

function _aaAbortedCapability(endpoint, observedAt) {
  return _aaTraceCapability('aborted', observedAt, { endpoint, error_code: 'aborted' });
}

function _aaIsAbortMarker(error) {
  if (!_aaIsPlainObject(error)) return false;
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(error, '__aaTraceAborted');
    return Boolean(descriptor && 'value' in descriptor && descriptor.value === true);
  } catch (_ignored) {
    return false;
  }
}

function _aaAbortRace(promise, signal) {
  if (!signal) return Promise.resolve(promise);
  if (signal.aborted) return Promise.reject({ __aaTraceAborted: true });
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = callback => value => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      callback(value);
    };
    const onAbort = finish(reject);
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(finish(resolve), finish(reject));
  }).catch(error => {
    if (signal.aborted) throw { __aaTraceAborted: true };
    throw error;
  });
}

function _aaRoleCapability(hass, endpoint, observedAt) {
  if (!hass || !hass.user || typeof hass.user.is_admin !== 'boolean') {
    return _aaTraceCapability('unknown_role', observedAt, { endpoint, error_code: 'unknown_role' });
  }
  if (hass.user.is_admin !== true) {
    return _aaTraceCapability('permission_denied', observedAt, { endpoint, error_code: 'admin_required' });
  }
  return null;
}

async function _aaRequestTraceList(options = {}) {
  const endpoint = 'trace/list';
  const denied = _aaRoleCapability(options.hass, endpoint, options.observedAt);
  if (denied) return denied;
  if (options.signal?.aborted) return _aaAbortedCapability(endpoint, options.observedAt);
  try {
    const request = { type: 'trace/list', domain: 'automation' };
    if (options.global !== true) request.item_id = options.itemId;
    const payload = await _aaAbortRace(options.hass.callWS(request), options.signal);
    if (options.signal?.aborted) return _aaAbortedCapability(endpoint, options.observedAt);
    return _aaNormalizeList(payload, {
      expectedItemId: options.itemId,
      observedAt: options.observedAt,
      global: options.global === true
    });
  } catch (error) {
    if (options.signal?.aborted || _aaIsAbortMarker(error)) {
      return _aaAbortedCapability(endpoint, options.observedAt);
    }
    return _aaClassifyTraceError(error, { endpoint, observedAt: options.observedAt });
  }
}

async function _aaRequestServerSummary(options = {}) {
  const endpoint = 'ha_automation_analyzer/summary';
  const denied = _aaRoleCapability(options.hass, endpoint, options.observedAt);
  if (denied) return denied;
  if (options.signal?.aborted) return _aaAbortedCapability(endpoint, options.observedAt);
  try {
    const result = await _aaAbortRace(options.hass.callWS({ type: endpoint }), options.signal);
    if (options.signal?.aborted) return _aaAbortedCapability(endpoint, options.observedAt);
    const count = value => Number.isInteger(value) && value >= 0 && value <= AA_TRACE_MAX_GLOBAL_RUNS;
    const byAutomation = result?.by_automation;
    const daily = result?.daily_counts;
    const durations = result?.durations_ms;
    if (result?.schema !== 'aa-trace-summary-v1' || !count(result.run_count)
      || !count(result.execution_count) || result.execution_count > result.run_count
      || !_aaIsPlainObject(byAutomation) || Object.keys(byAutomation).length > AA_TRACE_MAX_GLOBAL_RUNS
      || !Array.isArray(daily) || daily.length !== 14
      || !Array.isArray(durations) || durations.length > AA_TRACE_MAX_GLOBAL_RUNS
      || !durations.every(value => Number.isInteger(value) && value >= 0 && value < 300000)
      || !daily.every(row => _aaIsPlainObject(row) && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && count(row.count))
      || !Object.entries(byAutomation).every(([id, row]) => typeof id === 'string' && id.length > 0 && id.length <= 255
        && _aaIsPlainObject(row) && count(row.trace_count) && count(row.today_count) && count(row.error_count)
        && row.today_count <= row.trace_count && row.error_count <= row.trace_count
        && (row.avg_execution_ms === null || Number.isInteger(row.avg_execution_ms) && row.avg_execution_ms >= 0 && row.avg_execution_ms < 300000))) {
      return _aaTraceCapability('malformed', options.observedAt, { endpoint, error_code: 'malformed' });
    }
    return {
      status: result.execution_count ? 'available' : 'no_data',
      source: 'home_assistant.aa_trace_summary_v1',
      observed_at: _aaTraceObservedAt(options.observedAt),
      evidence: { endpoint, schema: result.schema, run_count: result.run_count },
      data: { summary: result }
    };
  } catch (error) {
    if (options.signal?.aborted || _aaIsAbortMarker(error)) return _aaAbortedCapability(endpoint, options.observedAt);
    return _aaClassifyTraceError(error, { endpoint, observedAt: options.observedAt });
  }
}

async function _aaRequestFullTrace(options = {}) {
  const endpoint = 'trace/get';
  const denied = _aaRoleCapability(options.hass, endpoint, options.observedAt);
  if (denied) return denied;
  if (options.signal?.aborted) return _aaAbortedCapability(endpoint, options.observedAt);
  try {
    const payload = await _aaAbortRace(options.hass.callWS({
      type: 'trace/get', domain: 'automation', item_id: options.itemId, run_id: options.runId
    }), options.signal);
    if (options.signal?.aborted) return _aaAbortedCapability(endpoint, options.observedAt);
    return _aaNormalizeFull(payload, {
      expectedItemId: options.itemId,
      observedAt: options.observedAt
    });
  } catch (error) {
    if (options.signal?.aborted || _aaIsAbortMarker(error)) {
      return _aaAbortedCapability(endpoint, options.observedAt);
    }
    return _aaClassifyTraceError(error, { endpoint, observedAt: options.observedAt });
  }
}

async function _aaRequestLatestTrace(options = {}) {
  const listed = await _aaRequestTraceList(options);
  if (listed.status !== 'available') return listed;
  const latest = listed.data.runs.find(run => run.kind === 'execution');
  if (!latest) return _aaTraceCapability('no_data', options.observedAt, {
    endpoint: 'trace/get', error_code: 'no_execution_trace'
  });
  if (options.signal?.aborted) return _aaAbortedCapability('trace/get', options.observedAt);
  return _aaRequestFullTrace({ ...options, runId: latest.run_id });
}

function _aaIsNormalizedRunSummary(run) {
  return _aaIsPlainObject(run)
    && _aaHasOnlyFields(run, new Set([
      'run_id', 'item_id', 'run_state', 'script_execution', 'kind',
      'started_at', 'finished_at', 'run_duration_ms'
    ]))
    && typeof run.run_id === 'string' && Boolean(run.run_id)
    && typeof run.item_id === 'string' && Boolean(run.item_id)
    && (run.run_state === 'running' || run.run_state === 'stopped')
    && (run.script_execution === null || typeof run.script_execution === 'string')
    && (run.kind === 'execution' || run.kind === 'non_execution')
    && _aaParseTimestamp(run.started_at) !== null
    && (run.finished_at === null || _aaParseTimestamp(run.finished_at) !== null)
    && (run.run_duration_ms === null
      || (Number.isFinite(run.run_duration_ms) && run.run_duration_ms >= 0));
}

function _aaPaginateTraceRuns(runs, options = {}) {
  const observedAt = options.observedAt;
  let validRuns = false;
  try {
    validRuns = _aaInspectTracePayload(runs, { maxRootArray: AA_TRACE_MAX_GLOBAL_RUNS }).ok
      && Array.isArray(runs) && runs.length <= AA_TRACE_MAX_GLOBAL_RUNS
      && runs.every(_aaIsNormalizedRunSummary);
  } catch (_error) {}
  if (!validRuns || !Number.isInteger(options.limit)
    || options.limit < 1 || options.limit > 50) {
    return _aaTraceCapability('malformed', observedAt, { endpoint: 'local/page', error_code: 'malformed' });
  }
  let offset = 0;
  if (options.cursor !== null && options.cursor !== undefined) {
    const match = /^aatc1\.(0|[1-9]\d*)$/.exec(options.cursor);
    if (!match) return _aaTraceCapability('malformed', observedAt, { endpoint: 'local/page', error_code: 'invalid_cursor' });
    offset = Number(match[1]);
    if (!Number.isSafeInteger(offset) || offset >= runs.length) {
      return _aaTraceCapability('malformed', observedAt, { endpoint: 'local/page', error_code: 'invalid_cursor' });
    }
  }
  const items = runs.slice(offset, offset + options.limit);
  const nextOffset = offset + items.length;
  const nextCursor = nextOffset < runs.length ? `aatc1.${nextOffset}` : null;
  return _aaTraceCapability('available', observedAt, {
    endpoint: 'local/page', schema: 'aatc1', item_count: items.length
  }, { items, next_cursor: nextCursor });
}

function _aaIsComparableTraceData(data) {
  if (!_aaIsPlainObject(data) || !_aaInspectTracePayload(data).ok
    || !_aaHasOnlyFields(data, new Set([
      'run_id', 'item_id', 'run_state', 'kind', 'run_duration_ms', 'nodes'
    ]))
    || typeof data.run_id !== 'string' || !data.run_id
    || typeof data.item_id !== 'string' || !data.item_id
    || (data.run_state !== 'running' && data.run_state !== 'stopped')
    || (data.kind !== 'execution' && data.kind !== 'non_execution')
    || !(data.run_duration_ms === null
      || (Number.isFinite(data.run_duration_ms) && data.run_duration_ms >= 0))
    || !Array.isArray(data.nodes)) return false;
  return data.nodes.every(node => _aaIsPlainObject(node)
    && _aaHasOnlyFields(node, new Set(['path', 'ordinal', 'status', 'offset_ms']))
    && typeof node.path === 'string' && AA_TRACE_PATH_PATTERN.test(node.path)
    && Number.isInteger(node.ordinal) && node.ordinal >= 0
    && ['pass', 'error', 'changed', 'skipped'].includes(node.status)
    && Number.isFinite(node.offset_ms) && node.offset_ms >= 0);
}

function _aaCompareTraceRuns(baseline, current, options = {}) {
  const observedAt = options.observedAt;
  if (!_aaIsComparableTraceData(baseline) || !_aaIsComparableTraceData(current)) {
    return _aaTraceCapability('malformed', observedAt, { endpoint: 'local/compare', error_code: 'malformed' });
  }
  if (baseline.kind !== 'execution' || current.kind !== 'execution') {
    return _aaTraceCapability('no_data', observedAt, {
      endpoint: 'local/compare', error_code: 'non_execution_trace'
    });
  }
  const minimumDelta = Number.isFinite(options.minimumDeltaMs) ? Math.max(0, options.minimumDeltaMs) : 20;
  const minimumRatio = Number.isFinite(options.minimumRatio) ? Math.max(1, options.minimumRatio) : 1.25;
  const baselineByKey = new Map(baseline.nodes.map(node => [`${node.path}#${node.ordinal}`, node]));
  const currentByKey = new Map(current.nodes.map(node => [`${node.path}#${node.ordinal}`, node]));
  const categories = { added: [], removed: [], reached_later: [], reached_earlier: [], unchanged: [] };
  const allKeys = [...new Set([...baselineByKey.keys(), ...currentByKey.keys()])].sort((leftKey, rightKey) => {
    const left = baselineByKey.get(leftKey) || currentByKey.get(leftKey);
    const right = baselineByKey.get(rightKey) || currentByKey.get(rightKey);
    return _aaCompareText(left.path, right.path) || left.ordinal - right.ordinal;
  });
  for (const key of allKeys) {
    const before = baselineByKey.get(key);
    const after = currentByKey.get(key);
    if (!before) { categories.added.push({ path: after.path, ordinal: after.ordinal }); continue; }
    if (!after) { categories.removed.push({ path: before.path, ordinal: before.ordinal }); continue; }
    const delta = after.offset_ms - before.offset_ms;
    const ratio = before.offset_ms === 0 ? (after.offset_ms === 0 ? 1 : Infinity) : after.offset_ms / before.offset_ms;
    const item = { path: after.path, ordinal: after.ordinal, delta_ms: delta };
    if (delta >= minimumDelta && ratio >= minimumRatio) categories.reached_later.push(item);
    else if (delta <= -minimumDelta && (ratio <= 1 / minimumRatio || after.offset_ms === 0)) categories.reached_earlier.push(item);
    else categories.unchanged.push(item);
  }
  let runClassification = 'unchanged';
  let runDelta = null;
  if (baseline.run_duration_ms !== null && current.run_duration_ms !== null) {
    runDelta = current.run_duration_ms - baseline.run_duration_ms;
    const ratio = baseline.run_duration_ms === 0
      ? (current.run_duration_ms === 0 ? 1 : Infinity)
      : current.run_duration_ms / baseline.run_duration_ms;
    if (runDelta >= minimumDelta && ratio >= minimumRatio) runClassification = 'slower';
    else if (runDelta <= -minimumDelta && (ratio <= 1 / minimumRatio || current.run_duration_ms === 0)) runClassification = 'faster';
  }
  return _aaTraceCapability('available', observedAt, {
    endpoint: 'local/compare', schema: 'ha-trace-comparison-v1', node_count: allKeys.length
  }, {
    run: { classification: runClassification, delta_ms: runDelta },
    nodes: categories
  });
}

function _aaIsDiagnosticTraceCapability(capability) {
  if (!_aaIsPlainObject(capability) || !_aaInspectTracePayload(capability).ok
    || !_aaHasOnlyFields(capability, new Set(['status', 'source', 'observed_at', 'evidence', 'data']))
    || capability.status !== 'available' || capability.source !== AA_TRACE_SOURCE
    || !_aaIsPlainObject(capability.evidence)
    || !_aaHasOnlyFields(capability.evidence, new Set(['endpoint', 'schema', 'node_count', 'run_state']))
    || capability.evidence.endpoint !== 'trace/get'
    || (capability.evidence.schema !== 'ha-trace-v1'
      && capability.evidence.schema !== 'ha-trace-legacy-path-v0')
    || !_aaIsPlainObject(capability.data)
    || !_aaHasOnlyFields(capability.data, new Set([
      'run_id', 'item_id', 'run_state', 'kind', 'run_duration_ms', 'nodes'
    ]))
    || typeof capability.data.run_id !== 'string' || !capability.data.run_id
    || typeof capability.data.item_id !== 'string' || !capability.data.item_id
    || (capability.data.run_state !== 'running' && capability.data.run_state !== 'stopped')
    || (capability.data.kind !== 'execution' && capability.data.kind !== 'non_execution')
    || !(capability.data.run_duration_ms === null
      || (Number.isFinite(capability.data.run_duration_ms) && capability.data.run_duration_ms >= 0))
    || !Array.isArray(capability.data.nodes)) return false;
  return capability.data.nodes.every(node => _aaIsPlainObject(node)
    && _aaHasOnlyFields(node, new Set(['path', 'ordinal', 'status', 'offset_ms']))
    && typeof node.path === 'string' && AA_TRACE_PATH_PATTERN.test(node.path)
    && Number.isInteger(node.ordinal) && node.ordinal >= 0
    && ['pass', 'error', 'changed', 'skipped'].includes(node.status)
    && Number.isFinite(node.offset_ms) && node.offset_ms >= 0);
}

function _aaIsDiagnosticComparison(comparison) {
  if (comparison === null || comparison === undefined) return true;
  if (!_aaIsPlainObject(comparison) || !_aaInspectTracePayload(comparison).ok
    || !_aaHasOnlyFields(comparison, new Set(['status', 'source', 'observed_at', 'evidence', 'data']))
    || comparison.status !== 'available' || comparison.source !== AA_TRACE_SOURCE
    || !_aaIsPlainObject(comparison.evidence)
    || !_aaHasOnlyFields(comparison.evidence, new Set(['endpoint', 'schema', 'node_count']))
    || comparison.evidence.endpoint !== 'local/compare'
    || comparison.evidence.schema !== 'ha-trace-comparison-v1'
    || !_aaIsPlainObject(comparison.data)
    || !_aaHasOnlyFields(comparison.data, new Set(['run', 'nodes']))
    || !_aaIsPlainObject(comparison.data.run)
    || !_aaHasOnlyFields(comparison.data.run, new Set(['classification', 'delta_ms']))
    || !['slower', 'faster', 'unchanged'].includes(comparison.data.run.classification)
    || !(comparison.data.run.delta_ms === null || Number.isFinite(comparison.data.run.delta_ms))
    || !_aaIsPlainObject(comparison.data.nodes)
    || !_aaHasOnlyFields(comparison.data.nodes, new Set([
      'added', 'removed', 'reached_later', 'reached_earlier', 'unchanged'
    ]))) return false;
  return ['added', 'removed', 'reached_later', 'reached_earlier', 'unchanged'].every(category => {
    const values = comparison.data.nodes[category];
    return Array.isArray(values) && values.every(node => _aaIsPlainObject(node)
      && _aaHasOnlyFields(node, new Set(['path', 'ordinal', 'delta_ms']))
      && typeof node.path === 'string' && AA_TRACE_PATH_PATTERN.test(node.path)
      && Number.isInteger(node.ordinal) && node.ordinal >= 0
      && (!Object.hasOwn(node, 'delta_ms') || Number.isFinite(node.delta_ms)));
  });
}

function _aaBuildDiagnostic(options = {}) {
  const capability = options.capability;
  const comparison = options.comparison;
  let valid = false;
  try {
    valid = _aaIsDiagnosticTraceCapability(capability) && _aaIsDiagnosticComparison(comparison);
  } catch (_error) {
    valid = false;
  }
  const data = valid ? capability.data : null;
  if (!data) {
    return { schema: 'ha-automation-analyzer-diagnostic-v1', generated_at: _aaTraceObservedAt(options.generatedAt), status: 'unavailable' };
  }
  const diagnostic = {
    schema: 'ha-automation-analyzer-diagnostic-v1',
    generated_at: _aaTraceObservedAt(options.generatedAt),
    capability: {
      status: capability.status,
      source: capability.source,
      schema: capability.evidence?.schema || null
    },
    run: {
      alias: 'run_001',
      state: data.run_state,
      kind: data.kind,
      duration_ms: data.run_duration_ms,
      nodes: data.nodes.map(node => ({
        path: node.path,
        ordinal: node.ordinal,
        status: node.status,
        offset_ms: node.offset_ms
      }))
    }
  };
  if (comparison?.status === 'available') {
    diagnostic.comparison = {
      run: {
        classification: comparison.data.run.classification,
        delta_ms: comparison.data.run.delta_ms
      },
      nodes: Object.fromEntries(
        ['added', 'removed', 'reached_later', 'reached_earlier', 'unchanged'].map(category => [
          category,
          comparison.data.nodes[category].map(node => ({
            path: node.path,
            ordinal: node.ordinal,
            ...(Object.hasOwn(node, 'delta_ms') ? { delta_ms: node.delta_ms } : {})
          }))
        ])
      )
    };
  }
  return diagnostic;
}

function _aaDownloadDiagnostic(diagnostic, adapters = {}) {
  const windowAdapter = adapters.window || window;
  const documentAdapter = adapters.document || document;
  const payload = JSON.stringify(diagnostic, null, 2) + '\n';
  const blob = new windowAdapter.Blob([payload], { type: 'application/json' });
  const url = windowAdapter.URL.createObjectURL(blob);
  try {
    const anchor = documentAdapter.createElement('a');
    anchor.href = url;
    anchor.download = 'ha-automation-analyzer-diagnostic.json';
    anchor.rel = 'noopener';
    anchor.click();
  } finally {
    windowAdapter.URL.revokeObjectURL(url);
  }
}

const AA_TRACE_CONTRACT = Object.freeze({
  normalizeList: _aaNormalizeList,
  normalizeFull: _aaNormalizeFull,
  paginate: _aaPaginateTraceRuns,
  compare: _aaCompareTraceRuns,
  classifyError: _aaClassifyTraceError,
  requestList: _aaRequestTraceList,
  requestFull: _aaRequestFullTrace,
  requestLatest: _aaRequestLatestTrace,
  buildDiagnostic: _aaBuildDiagnostic,
  downloadDiagnostic: _aaDownloadDiagnostic
});
// END ANALYZER TRACE SNAPSHOT
return AA_TRACE_CONTRACT;
}
/* END INLINE shared/ha-tools-trace-contract.js */
const tvTraceContract = createHAToolsTraceContract();

// Component-local persistence retains this card's existing localStorage keys.
const haToolsPersistence = { _cache: {}, _hass: null, setHass(h) { this._hass = h; }, async save(k, d) { try { localStorage.setItem('ha-trace-viewer-' + k, JSON.stringify(d)); } catch(e) { console.debug('[ha-trace-viewer] caught:', e); } }, async load(k) { try { const r = localStorage.getItem('ha-trace-viewer-' + k); return r ? JSON.parse(r) : null; } catch(e) { return null; } }, loadSync(k) { try { const r = localStorage.getItem('ha-trace-viewer-' + k); return r ? JSON.parse(r) : null; } catch(e) { return null; } } };

// -- HA Tools Escape helper (fallback) --
const _esc = ((s) => String(s == null ? '' : s).replace(/[&<>"\']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));

/* ===== HA Tools split — inline shared infrastructure ===== */
// Bento Design System CSS (inline copy — keeps tool standalone)
const haToolsBentoCSS = `
/* ═══════════════════════════════════════════════
   HA Tools — Bento Design System v2.0 (Premium)
   ═══════════════════════════════════════════════ */

/* keyboard a11y */
:focus-visible { outline: 2px solid var(--bento-primary, #6366f1); outline-offset: 2px; border-radius: 3px; }

:host {
  /* Brand palette — diamond top, gradient-friendly */
  --bento-primary: #6366f1;
  --bento-primary-2: #8b5cf6;
  --bento-primary-3: #ec4899;
  --bento-primary-hover: #4f46e5;
  --bento-primary-light: rgba(99, 102, 241, 0.08);
  --bento-primary-glow: rgba(99, 102, 241, 0.35);
  --bento-success: #10B981;
  --bento-success-light: rgba(16, 185, 129, 0.10);
  --bento-success-border: rgba(16, 185, 129, 0.25);
  --bento-error: #EF4444;
  --bento-error-light: rgba(239, 68, 68, 0.10);
  --bento-error-border: rgba(239, 68, 68, 0.25);
  --bento-warning: #F59E0B;
  --bento-warning-light: rgba(245, 158, 11, 0.10);
  --bento-warning-border: rgba(245, 158, 11, 0.25);
  --bento-info: #06b6d4;
  --bento-info-light: rgba(6, 182, 212, 0.10);
  --bento-info-border: rgba(6, 182, 212, 0.25);

  /* Theme */
  --bento-bg:     var(--primary-background-color, #fafaf9);
  --bento-bg-2:   var(--card-background-color, #f5f5f4);
  --bento-card:   var(--card-background-color, #ffffff);
  --bento-glass:  rgba(255, 255, 255, 0.7);
  --bento-border: var(--divider-color, #e7e5e4);
  --bento-border-strong: rgba(0, 0, 0, 0.08);
  --bento-text:           var(--primary-text-color,   #0c0a09);
  --bento-text-secondary: var(--secondary-text-color, #57534e);
  --bento-text-muted:     var(--disabled-text-color,  #a8a29e);

  /* Radii */
  --bento-radius-xs: 8px;
  --bento-radius-sm: 12px;
  --bento-radius-md: 18px;
  --bento-radius-lg: 24px;
  --bento-radius-pill: 999px;

  /* Shadows — modern, layered */
  --bento-shadow-sm: 0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02);
  --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.03);
  --bento-shadow-lg: 0 24px 48px -12px rgba(0,0,0,0.10), 0 12px 24px -8px rgba(0,0,0,0.05);
  --bento-shadow-glow: 0 0 0 1px rgba(99,102,241,0.15), 0 8px 32px -8px rgba(99,102,241,0.25);

  /* Gradients */
  --bento-grad-primary: linear-gradient(135deg, #6366f1, #8b5cf6);
  --bento-grad-rainbow: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  --bento-grad-success: linear-gradient(135deg, #10b981, #34d399);
  --bento-grad-error:   linear-gradient(135deg, #ef4444, #f87171);
  --bento-grad-warning: linear-gradient(135deg, #f59e0b, #fbbf24);

  /* Motion */
  --bento-trans-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --bento-trans:      0.25s cubic-bezier(0.4, 0, 0.2, 1);
  --bento-trans-slow: 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  /* Typography */
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif;
  font-feature-settings: "cv11" 1, "ss01" 1;
  letter-spacing: -0.01em;
  display: block;
  color: var(--bento-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── Dark mode ───────────────────────────────── */
:host(.bento-dark) {
    --bento-bg:     var(--primary-background-color, #0a0a0f);
    --bento-bg-2:   var(--card-background-color,    #111119);
    --bento-card:   var(--card-background-color,    #16161f);
    --bento-glass:  rgba(22, 22, 31, 0.7);
    --bento-border: var(--divider-color,            #27272f);
    --bento-border-strong: rgba(255, 255, 255, 0.08);
    --bento-text:           var(--primary-text-color,   #fafaf9);
    --bento-text-secondary: var(--secondary-text-color, #d6d3d1);
    --bento-text-muted:     var(--disabled-text-color,  #78716c);
    --bento-primary:        #818cf8;
    --bento-primary-2:      #a78bfa;
    --bento-primary-3:      #f472b6;
    --bento-primary-light:  rgba(129, 140, 248, 0.12);
    --bento-primary-glow:   rgba(129, 140, 248, 0.45);
    --bento-success: #34d399;
    --bento-success-light:  rgba(52, 211, 153, 0.12);
    --bento-success-border: rgba(52, 211, 153, 0.30);
    --bento-error:   #f87171;
    --bento-error-light:    rgba(248, 113, 113, 0.12);
    --bento-error-border:   rgba(248, 113, 113, 0.30);
    --bento-warning: #fbbf24;
    --bento-warning-light:  rgba(251, 191, 36, 0.12);
    --bento-warning-border: rgba(251, 191, 36, 0.30);
    --bento-info:    #22d3ee;
    --bento-info-light:     rgba(34, 211, 238, 0.12);
    --bento-info-border:    rgba(34, 211, 238, 0.30);
    --bento-shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
    --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.2);
    --bento-shadow-lg: 0 24px 48px -12px rgba(0,0,0,0.6), 0 12px 24px -8px rgba(0,0,0,0.3);
    --bento-shadow-glow: 0 0 0 1px rgba(129,140,248,0.2), 0 8px 32px -8px rgba(129,140,248,0.5);
    --bento-grad-primary: linear-gradient(135deg, #818cf8, #a78bfa);
    --bento-grad-rainbow: linear-gradient(135deg, #818cf8, #a78bfa 50%, #f472b6);
    color-scheme: dark !important;
  }
:host(.bento-dark) .card, :host(.bento-dark) .card-container, :host(.bento-dark) .main-card, :host(.bento-dark) .panel-card {
    background: var(--bento-card) !important; color: var(--bento-text) !important; border-color: var(--bento-border) !important;
  }
:host(.bento-dark) input, :host(.bento-dark) select, :host(.bento-dark) textarea { background: var(--bento-bg-2); color: var(--bento-text); border-color: var(--bento-border); }
:host(.bento-dark) table th { background: var(--bento-bg-2); color: var(--bento-text-secondary); border-color: var(--bento-border); }
:host(.bento-dark) table td { color: var(--bento-text); border-color: var(--bento-border); }
:host(.bento-dark) pre, :host(.bento-dark) code { background: #1e1e2e !important; color: #e2e8f0 !important; }

/* ── Reset & motion preferences ──────────────── */
* { box-sizing: border-box; }
@media (prefers-reduced-motion: reduce) { * { animation-duration: 0s !important; transition-duration: 0s !important; } }

/* ── Main Card Wrapper ───────────────────────── */
.card {
  background: var(--bento-card);
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-md);
  box-shadow: var(--bento-shadow-md);
  color: var(--bento-text);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
  position: relative;
  transition: box-shadow var(--bento-trans), border-color var(--bento-trans);
}

/* ── Header ──────────────────────────────────── */
.header {
  padding: 20px 24px 0;
  display: flex; align-items: center; gap: 12px;
}
.header-icon { font-size: 24px; }
.header-title {
  font-size: 18px; font-weight: 700; letter-spacing: -0.02em;
  color: var(--bento-text);
}
.header-badge {
  margin-left: auto;
  background: var(--bento-grad-primary); color: #fff;
  font-size: 11px; padding: 4px 10px; border-radius: var(--bento-radius-pill);
  font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
  box-shadow: 0 4px 14px -2px var(--bento-primary-glow);
}
.content { padding: 20px 24px 24px; }

/* ── Tabs (modern pill style) ────────────────── */
.tabs, .tab-bar, .tab-nav, .tab-header {
  display: flex !important; gap: 4px !important;
  padding: 4px !important;
  background: var(--bento-bg-2) !important;
  border-radius: var(--bento-radius-pill) !important;
  margin-bottom: 20px !important;
  overflow: visible !important;
  -webkit-overflow-scrolling: touch !important;
  flex-wrap: wrap !important; border-bottom: 0 !important;
  width: 100%; max-width: 100%; box-sizing: border-box;
}
.tab, .tab-btn, .tab-button, .dtab {
  padding: 8px 16px !important;
  border: none !important; background: transparent !important; cursor: pointer !important;
  font-size: 13px !important; font-weight: 600 !important;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif !important;
  color: var(--bento-text-secondary) !important;
  border-radius: var(--bento-radius-pill) !important;
  margin-bottom: 0 !important;
  transition: all var(--bento-trans) !important;
  white-space: nowrap !important; flex: 1 1 auto !important; text-align: center !important; min-height: 40px !important;
  letter-spacing: -0.005em !important;
}
.tab:hover, .tab-btn:hover, .tab-button:hover, .dtab:hover {
  color: var(--bento-text) !important;
  background: var(--bento-card) !important;
}
.tab.active, .tab-btn.active, .tab-button.active, .dtab.active {
  background: var(--bento-card) !important;
  color: var(--bento-primary) !important;
  box-shadow: var(--bento-shadow-sm) !important;
  font-weight: 700 !important;
}
.tab-content { display: block; }
.tab-content.active { animation: bentoFadeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
@keyframes bentoFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Stat / KPI cards (premium) ──────────────── */
.stat-card, .stat-item, .metric-card, .kpi-card {
  background: var(--bento-bg-2) !important;
  border: 1px solid var(--bento-border) !important;
  border-radius: var(--bento-radius-sm) !important;
  padding: 18px !important;
  text-align: left !important;
  transition: transform var(--bento-trans), box-shadow var(--bento-trans), border-color var(--bento-trans);
  position: relative; overflow: hidden;
}
.stat-card::before, .metric-card::before, .kpi-card::before {
  content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--bento-grad-primary);
  opacity: 0; transition: opacity var(--bento-trans);
}
.stat-card:hover, .stat-item:hover, .metric-card:hover, .kpi-card:hover {
  transform: translateY(-2px); box-shadow: var(--bento-shadow-lg); border-color: var(--bento-primary-light);
}
.stat-card:hover::before, .metric-card:hover::before, .kpi-card:hover::before { opacity: 1; }
.stat-icon { font-size: 22px; margin-bottom: 6px; opacity: 0.85; }
.stat-value, .stat-val, .metric-value, .kpi-val {
  font-size: 26px; font-weight: 800; line-height: 1.1;
  letter-spacing: -0.02em; color: var(--bento-text);
  font-feature-settings: "tnum" 1;
}
.stat-label, .stat-lbl, .metric-label, .kpi-lbl {
  font-size: 11px; color: var(--bento-text-secondary);
  margin-top: 4px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;
}
.stat-num {
  font-size: 24px; font-weight: 800; color: var(--bento-primary);
  font-feature-settings: "tnum" 1; letter-spacing: -0.02em;
}
.stat-sub { font-size: 12px; color: var(--bento-text-muted); font-weight: 500; }

/* ── Overview grid ───────────────────────────── */
.overview-grid, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px; margin-bottom: 20px;
}

/* ── Section headers ─────────────────────────── */
.section-header, .section-title {
  display: flex; align-items: center; justify-content: space-between;
  position: relative; padding-left: 12px;
  font-size: 12px; font-weight: 700; color: var(--bento-text-secondary);
  text-transform: uppercase; letter-spacing: 0.08em;
  margin: 16px 0 10px;
}
.section-header::before, .section-title::before {
  content: ""; width: 4px; height: 4px; border-radius: 50%; background: var(--bento-primary);
  position: absolute; left: 0; top: 50%; transform: translateY(-50%); flex-shrink: 0;
}

/* ── Loading / Empty / Info ──────────────────── */
.loading-bar {
  height: 3px; border-radius: var(--bento-radius-pill);
  background: linear-gradient(90deg, var(--bento-primary), var(--bento-primary-2), transparent);
  background-size: 200% 100%;
  animation: bentoLoad 1.5s linear infinite; margin-bottom: 12px;
}
@keyframes bentoLoad { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.empty-state, .no-data, .no-results {
  text-align: center; color: var(--bento-text-secondary);
  padding: 40px 20px; font-size: 14px;
  background: var(--bento-bg-2); border-radius: var(--bento-radius-md);
  border: 1px dashed var(--bento-border);
}
.info-note, .tip-box {
  font-size: 13px; color: var(--bento-text-secondary);
  background: var(--bento-primary-light);
  border-radius: var(--bento-radius-sm); padding: 12px 14px;
  border-left: 3px solid var(--bento-primary); margin-top: 12px;
  line-height: 1.55;
}
.last-updated {
  font-size: 11px; color: var(--bento-text-muted);
  text-align: right; margin-top: 12px; font-feature-settings: "tnum" 1;
}

/* ── Buttons (premium) ───────────────────────── */
.refresh-btn {
  background: var(--bento-bg-2); border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-pill); padding: 6px 14px;
  font-size: 12px; color: var(--bento-text-secondary);
  cursor: pointer; font-weight: 600; transition: all var(--bento-trans);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif;
}
.refresh-btn:hover {
  background: var(--bento-card); color: var(--bento-primary);
  border-color: var(--bento-primary); transform: translateY(-1px);
  box-shadow: var(--bento-shadow-sm);
}
.toggle-btn, .action-btn {
  background: var(--bento-grad-primary); border: none;
  border-radius: var(--bento-radius-xs); padding: 8px 16px;
  font-size: 13px; color: #fff; cursor: pointer; font-weight: 600;
  transition: all var(--bento-trans); font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif;
  letter-spacing: -0.005em;
  box-shadow: 0 4px 12px -2px var(--bento-primary-glow);
}
.toggle-btn:hover, .action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px -4px var(--bento-primary-glow);
}
.send-btn, .btn-primary {
  width: 100%;
  background: var(--bento-grad-primary); color: #fff;
  border: none; border-radius: var(--bento-radius-sm);
  padding: 12px 20px; font-size: 14px; font-weight: 700;
  cursor: pointer; font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif;
  letter-spacing: -0.01em;
  transition: all var(--bento-trans);
  box-shadow: 0 4px 14px -2px var(--bento-primary-glow);
}
.send-btn:hover, .btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px -6px var(--bento-primary-glow);
}
.send-btn:active, .btn-primary:active { transform: translateY(0); }
.send-btn:disabled, .btn-primary:disabled {
  opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none;
}

/* ── Badges / Status (modern pill) ───────────── */
.badge, .status-badge, .tag, .chip {
  padding: 4px 12px; border-radius: var(--bento-radius-pill);
  font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;
  letter-spacing: 0.04em; text-transform: uppercase;
  border: 1px solid;
}
.badge-ok, .badge-success { background: var(--bento-success-light); color: var(--bento-success); border-color: var(--bento-success-border); }
.badge-er, .badge-error   { background: var(--bento-error-light);   color: var(--bento-error);   border-color: var(--bento-error-border); }
.badge-warn, .badge-warning { background: var(--bento-warning-light); color: var(--bento-warning); border-color: var(--bento-warning-border); }
.badge-info { background: var(--bento-info-light); color: var(--bento-info); border-color: var(--bento-info-border); }

.count-badge {
  font-size: 11px; font-weight: 700; padding: 3px 10px;
  border-radius: var(--bento-radius-pill); display: inline-flex; align-items: center;
  font-feature-settings: "tnum" 1;
}
.error-badge { background: var(--bento-error-light); color: var(--bento-error); border: 1px solid var(--bento-error-border); }
.warn-badge  { background: var(--bento-warning-light); color: var(--bento-warning); border: 1px solid var(--bento-warning-border); }
.info-badge  { background: var(--bento-primary-light); color: var(--bento-primary); border: 1px solid var(--bento-border); }
.ok-badge    { background: var(--bento-success-light); color: var(--bento-success); border: 1px solid var(--bento-success-border); }

/* ── Tables (modern) ─────────────────────────── */
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th {
  background: var(--bento-bg-2); color: var(--bento-text-secondary);
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  padding: 12px 16px; text-align: left;
  border-bottom: 1px solid var(--bento-border);
}
th:first-child { border-top-left-radius: var(--bento-radius-sm); }
th:last-child  { border-top-right-radius: var(--bento-radius-sm); }
td {
  padding: 14px 16px; border-bottom: 1px solid var(--bento-border);
  color: var(--bento-text); font-size: 13px;
}
tr { transition: background var(--bento-trans-fast); }
tr:hover td { background: var(--bento-primary-light); }
tr:last-child td { border-bottom: 0; }

/* ── Forms / Inputs ──────────────────────────── */
input, select, textarea {
  padding: 10px 14px; border: 1.5px solid var(--bento-border);
  border-radius: var(--bento-radius-xs);
  background: var(--bento-card); color: var(--bento-text);
  font-size: 14px; font-family: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif;
  transition: all var(--bento-trans); outline: none;
  letter-spacing: -0.005em;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--bento-primary);
  box-shadow: 0 0 0 4px var(--bento-primary-light);
}
input::placeholder, textarea::placeholder { color: var(--bento-text-muted); }

/* ── Code blocks ─────────────────────────────── */
code {
  background: var(--bento-bg-2); padding: 2px 6px;
  border-radius: 4px; font-size: 12px;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  border: 1px solid var(--bento-border);
}
pre {
  background: #1e1e2e; color: #e2e8f0;
  padding: 16px; border-radius: var(--bento-radius-sm);
  font-size: 12.5px; overflow-x: auto; line-height: 1.65;
  white-space: pre-wrap; word-break: break-word;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  box-shadow: var(--bento-shadow-md);
}

/* ── Grid layouts ────────────────────────────── */
.schedule-grid, .send-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}
.schedule-card, .send-card, .info-card {
  background: var(--bento-bg-2); border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-sm); padding: 16px;
  transition: all var(--bento-trans);
}
.schedule-card:hover, .send-card:hover, .info-card:hover {
  border-color: var(--bento-primary-light); transform: translateY(-1px);
  box-shadow: var(--bento-shadow-md);
}

/* ── Log entries ─────────────────────────────── */
.log-entry {
  display: flex; flex-wrap: wrap; align-items: flex-start;
  gap: 4px 8px; padding: 10px 12px;
  border-radius: var(--bento-radius-sm); margin-bottom: 6px;
  font-size: 12.5px; min-width: 0; overflow: hidden;
  border: 1px solid transparent; transition: all var(--bento-trans-fast);
}
.error-entry { background: var(--bento-error-light); border-color: var(--bento-error-border); }
.warn-entry  { background: var(--bento-warning-light); border-color: var(--bento-warning-border); }
.log-time { color: var(--bento-text-muted); font-feature-settings: "tnum" 1; flex-shrink: 0; font-family: "JetBrains Mono", monospace; }
.log-domain {
  font-weight: 700; flex-shrink: 1; min-width: 0; max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; word-break: break-all;
}
.error-domain { color: var(--bento-error); }
.warn-domain  { color: var(--bento-warning); }
.log-msg {
  color: var(--bento-text-secondary); flex-basis: 100%;
  word-break: break-word; overflow-wrap: anywhere;
  white-space: pre-wrap; min-width: 0; line-height: 1.55;
}

/* ── Send status ─────────────────────────────── */
.send-status {
  padding: 12px 16px; border-radius: var(--bento-radius-sm);
  margin-top: 14px; font-size: 13px; font-weight: 600;
  text-align: center; letter-spacing: -0.005em;
  border: 1px solid;
}
.send-status.sending { background: var(--bento-primary-light); color: var(--bento-primary); border-color: var(--bento-border); }
.send-status.success { background: var(--bento-success-light); color: var(--bento-success); border-color: var(--bento-success-border); }
.send-status.error   { background: var(--bento-error-light);   color: var(--bento-error);   border-color: var(--bento-error-border); }

/* ── Scrollbar ───────────────────────────────── */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: var(--bento-radius-pill); border: 2px solid transparent; background-clip: content-box; }
::-webkit-scrollbar-thumb:hover { background: var(--bento-text-muted); background-clip: content-box; }

/* ── Animations ──────────────────────────────── */
@keyframes bentoSpin  { to { transform: rotate(360deg); } }
@keyframes bentoPulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
@keyframes bentoSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes bentoStaggerIn { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

/* Apply stagger to grids of stat-cards */
.stats-grid > *, .overview-grid > *, .summary-grid > * {
  animation: bentoStaggerIn 0.35s cubic-bezier(0.4, 0, 0.2, 1) both;
}
.stats-grid > *:nth-child(1)  { animation-delay: 0.02s; }
.stats-grid > *:nth-child(2)  { animation-delay: 0.06s; }
.stats-grid > *:nth-child(3)  { animation-delay: 0.10s; }
.stats-grid > *:nth-child(4)  { animation-delay: 0.14s; }
.stats-grid > *:nth-child(5)  { animation-delay: 0.18s; }
.stats-grid > *:nth-child(6)  { animation-delay: 0.22s; }

/* ── Mobile — 768 px ─────────────────────────── */
@media (max-width: 768px) {
  .content { padding: 16px; }
  .header { padding: 16px 16px 0; }
  .tabs { gap: 2px !important; padding: 3px !important; }
  .tab, .tab-button, .tab-btn { padding: 6px 12px !important; font-size: 12px !important; }
  .overview-grid, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid {
    grid-template-columns: repeat(2, 1fr); gap: 10px;
  }
  .stat-value, .stat-val, .kpi-val, .metric-val { font-size: 22px; }
  .stat-label, .stat-lbl, .kpi-lbl, .metric-lbl { font-size: 10px; }
  .send-grid, .schedule-grid { grid-template-columns: 1fr; }
  .log-entry { flex-wrap: wrap; gap: 2px 6px; padding: 8px 10px; }
  .log-domain { max-width: 60%; font-size: 11.5px; }
  .log-msg { flex-basis: 100%; max-width: 100%; font-size: 11.5px; }
  pre { padding: 12px; font-size: 11.5px; }
  h2 { font-size: 18px; }
  h3 { font-size: 15px; }
  table { font-size: 12.5px; }
  th, td { padding: 10px 12px; }
}
@media (max-width: 480px) {
  .tabs { gap: 1px !important; padding: 2px !important; }
  .tab, .tab-button, .tab-btn { padding: 5px 10px !important; font-size: 11px !important; }
  .overview-grid, .stats-grid, .summary-grid { grid-template-columns: 1fr 1fr; }
  .stat-value, .stat-val, .kpi-val { font-size: 18px; }
}
`;


const FAMILY_NAV='.det-tabs',FAMILY_ATTR='data-dtab',FAMILY_ACTIVE='act';

// Adapted from Config/YAML family15: options come only from current native buttons.
// Observe the actual navigation parent's content box, not the global viewport.
function _rememberFamilyFocus(card) {
  const active = card.shadowRoot?.activeElement;
  const nav = card.shadowRoot?.querySelector(FAMILY_NAV);
  if (active?.id === 'ha-tools-tab-picker') return { picker:true };
  if (nav?.contains(active)) return { tab:active.getAttribute(FAMILY_ATTR) };
  return null;
}
function _disconnectFamilyNavigation(card) {
  card._familyNavObserver?.disconnect();card._familyNavObserver=null;card._familyNavTarget=null;
}
function _bindFamilyNavigation(card, restoreFocus=null) {
  const root=card.shadowRoot, nav=root?.querySelector(FAMILY_NAV);
  if (!nav) { _disconnectFamilyNavigation(card);return; }
  let label=root.querySelector('.ht-tab-picker');
  if (!label) {
    label=card.ownerDocument.createElement('div');label.className='ht-tab-picker';
    const text=card.ownerDocument.createElement('label');text.htmlFor='ha-tools-tab-picker';label.append(text);
    const select=card.ownerDocument.createElement('select');select.id='ha-tools-tab-picker';label.append(select);nav.before(label);
    select.addEventListener('change',()=>{
      const button=Array.from(root.querySelectorAll(FAMILY_NAV+' button['+FAMILY_ATTR+']')).find(item=>item.getAttribute(FAMILY_ATTR)===select.value&&!item.disabled&&!item.hidden);
      if(button)button.click(); // The original handler owns navigation, history and guards.
      _bindFamilyNavigation(card);
    });
  }
  label.firstElementChild.textContent=card._lang==='pl'?'Zakładka':'Tab';
  const select=label.querySelector('select');
  const buttons=Array.from(nav.querySelectorAll('button['+FAMILY_ATTR+']')).filter(button=>!button.hidden&&!button.disabled);
  const options=Array.from(select.options);
  if(options.length!==buttons.length||buttons.some((button,index)=>options[index]?.value!==button.getAttribute(FAMILY_ATTR))) {
    select.replaceChildren(...buttons.map(button=>{const option=card.ownerDocument.createElement('option');option.value=button.getAttribute(FAMILY_ATTR);return option;}));
  }
  buttons.forEach((button,index)=>{select.options[index].textContent=button.getAttribute('aria-label')||button.textContent.trim();});
  const selected=buttons.find(button=>button.classList.contains(FAMILY_ACTIVE));select.value=selected?.getAttribute(FAMILY_ATTR)||'';
  const target=nav.parentElement;
  const applyWidth=width=>{
    const currentNav=root.querySelector(FAMILY_NAV),currentLabel=root.querySelector('.ht-tab-picker');if(!currentNav||!currentLabel)return;
    const input=currentLabel.querySelector('select'),active=root.activeElement;
    const style=getComputedStyle(currentNav);
    const available=width-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0);
    const narrow=available>0&&available<280,fromTab=currentNav.contains(active),fromPicker=active===input;
    currentNav.hidden=narrow;currentLabel.hidden=!narrow;
    if(narrow&&fromTab)input.focus({preventScroll:true});
    else if(!narrow&&fromPicker)currentNav.querySelector('button.'+FAMILY_ACTIVE)?.focus({preventScroll:true});
  };
  if(card._familyNavTarget!==target) {
    _disconnectFamilyNavigation(card);
    const style=getComputedStyle(target);
    const measured=target.getBoundingClientRect().width-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0)-(parseFloat(style.borderLeftWidth)||0)-(parseFloat(style.borderRightWidth)||0);
    if(measured>0)card._familyNavWidth=measured;
    if(typeof ResizeObserver==='function'&&card.isConnected) {
      card._familyNavTarget=target;
      card._familyNavObserver=new ResizeObserver(entries=>{
        if(!card.isConnected||card._familyNavTarget!==target)return;
        const entry=entries.find(item=>item.target===target);if(!entry)return;
        card._familyNavWidth=entry.contentRect.width;applyWidth(card._familyNavWidth);
      });
      card._familyNavObserver.observe(target);
    }
  }
  applyWidth(card._familyNavWidth||900);
  // If ResizeObserver is unavailable, all native tabs and the complete picker stay usable.
  if(typeof ResizeObserver!=='function') { nav.hidden=false;label.hidden=false; }
  if(restoreFocus) {
    const button=buttons.find(item=>item.getAttribute(FAMILY_ATTR)===restoreFocus.tab)||selected;
    if(nav.hidden)select.focus({preventScroll:true});else button?.focus({preventScroll:true});
  }
}

function _rememberFamilyDrafts(card) {
  const root=card.shadowRoot, active=root?.activeElement;
  return Array.from(root?.querySelectorAll('input[id]:not([type=checkbox]):not([type=radio]),textarea[id]')||[],field=>({
    id:field.id,context:field.getAttribute('data-family-draft-context'),value:field.value,focused:field===active,start:field.selectionStart,end:field.selectionEnd,direction:field.selectionDirection,scrollTop:field.scrollTop,
  }));
}
function _restoreFamilyDrafts(card, fields) {
  for(const saved of fields) {
    const field=card.shadowRoot.getElementById(saved.id);if(!field||field.disabled||field.getAttribute('data-family-draft-context')!==saved.context)continue;
    field.value=saved.value;field.scrollTop=saved.scrollTop;
    if(saved.focused){field.focus({preventScroll:true});if(typeof saved.start==='number'&&typeof field.setSelectionRange==='function')field.setSelectionRange(saved.start,saved.end,saved.direction||'none');}
  }
}

const _FAMILY_CONTROL_CSS = `
/* Family15: native touch targets; checkbox indicators remain small inside labels. */
:host button,:host summary,:host a[href],:host [role=button],
:host input:not([type=checkbox]):not([type=radio]),:host select,:host textarea {
  box-sizing:border-box;min-height:44px !important;min-width:44px !important;max-width:100%;
}
:host button,:host summary,:host a[href] { white-space:normal !important;overflow-wrap:anywhere; }
:host a[href] { display:inline-flex;align-items:center; }
:host label:has(input[type=checkbox]) { min-height:44px !important;min-width:44px;display:flex;align-items:center;gap:8px;cursor:pointer; }
:host input[type=checkbox] { width:18px;height:18px;flex:none; }
:host button:focus-visible,:host summary:focus-visible,:host a:focus-visible,:host input:focus-visible,:host select:focus-visible,:host textarea:focus-visible,:host [role=button]:focus-visible {
  outline:3px solid var(--primary-color,#1769aa) !important;outline-offset:2px;
}
.intro-banner { padding-right:64px !important; }
.ht-tab-picker { min-width:0;display:flex;flex-direction:column;gap:6px;padding:8px;margin:0 0 8px; }
.ht-tab-picker select { width:100%;font:inherit;color:var(--primary-text-color,inherit);background:var(--card-background-color,transparent);padding:8px;border:1px solid var(--divider-color,#aaa);border-radius:8px; }
.ht-tab-picker[hidden],.tabs[hidden],.det-tabs[hidden] { display:none !important; }
.tabs,.det-tabs { display:flex;flex-wrap:wrap !important;overflow:visible !important;min-width:0;max-width:100%; }
:host .tabs button,:host .det-tabs button { min-height:44px !important;min-width:44px !important;white-space:normal !important;overflow-wrap:anywhere; }
.family-row-action { flex:1 1 auto; min-width:0; border:0; background:transparent; color:inherit; font:inherit; text-align:left; padding:0; }
.family-trace-action { display:flex; align-items:center; gap:10px; }
.tgroup-h { width:100%; border:0; color:inherit; font:inherit; text-align:left; }
`;


// Forward native key activation to the original action, without repeat or shortcut clicks.
function _bindFamilyRowKeys(root, selector) {
  root.querySelectorAll(selector).forEach(row => row.addEventListener('keydown', event => {
    if (event.target !== row || !['Enter', ' '].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (!event.repeat) row.click();
  }));
}
function _rememberFamilyRowFocus(card, kinds) {
  const active = card.shadowRoot.activeElement;
  const kind = active && kinds.find(([selector]) => active.matches(selector));
  return kind ? { selector:kind[0], attr:kind[1], key:active.getAttribute(kind[1]) } : null;
}
function _restoreFamilyRowFocus(card, saved) {
  if (!saved) return;
  Array.from(card.shadowRoot.querySelectorAll(saved.selector))
    .find(row => row.getAttribute(saved.attr) === saved.key)?.focus({preventScroll:true});
}

class HATraceViewer extends HTMLElement {
  constructor() {
    super();
    this._lang = (navigator.language || '').startsWith('pl') ? 'pl' : 'en';
    this.attachShadow({ mode: 'open' });
    // The export dialog is a stable sibling; ordinary render never detaches it.
    this._cardSurface = document.createElement('div');
    this._cardSurface.style.display = 'contents';
    this.shadowRoot.append(this._cardSurface);
    this._exportRevision = 0;
    this._exportSignature = null;
    this._exportObjectIds = new WeakMap();
    this._exportObjectSerial = 0;
    this._exportIntent = null;
    this._exportDialog = null;
    this._exportHandoff = null;
    this._exportLanguage = this._lang;
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

    // Comparison uses exact source identities, independently of export selection/filters.
    this._comparisonRuns = new Map();
    this._comparisonEpoch = 0;
    this._comparisonSourceEpoch = 0;
    this._comparisonDetailSourceEpoch = null;
    this._comparisonView = null;
    this._comparisonPending = null;
    this._comparisonController = null;
    this._comparisonOffline = navigator.onLine === false;
    this._comparisonTransportOffline = false;
    this._comparisonMessage = null;
    this._comparisonPage = 0;

    // Multi-select for export
    this.selectedTraceIds = new Set();
    this.selectedAutoIds = new Set();
    this.selectMode = false;
    this.tracePage = 0;
    this.tracePageSize = this._loadPageSize();

    // Automation list pagination
    this.autoPage = 0;
    this.autoPageSize = this._loadSetting('autoPageSize', 15);

    // Trace persistence
    this._storedTraces = {};
    this._storedDetails = {};
    this._adminStorageLoaded = false;
    this._accessEpoch = 0;

    // Auto-refresh
    this.relativeTimeUpdater = null;

    // Restore user settings
    this._restoreSettings();
  }

  _loadPageSize() {
    try {
      const s = localStorage.getItem('ha-tools-settings');
      if (s) { const p = JSON.parse(s); if (p['trace-viewer.pageSize']) return parseInt(p['trace-viewer.pageSize']); }
      const tv = localStorage.getItem('ha-tools-trace-viewer-pageSize');
      if (tv) return parseInt(tv);
    } catch {}
    return 15;
  }

  _savePageSize(size) {
    try { localStorage.setItem('ha-tools-trace-viewer-pageSize', String(size)); } catch {}
    try {
      const s = localStorage.getItem('ha-tools-settings');
      const settings = s ? JSON.parse(s) : {};
      settings['trace-viewer.pageSize'] = size;
      localStorage.setItem('ha-tools-settings', JSON.stringify(settings));
    } catch {}
  }

  _sanitize(s) { try { return decodeURIComponent(escape(s)); } catch(e) { return s; } }

  // ============================================================

  _loadSetting(key, fallback) {
    try {
      const s = localStorage.getItem('ha-tools-settings');
      if (s) { const p = JSON.parse(s); if (p['trace-viewer.' + key] !== undefined) return p['trace-viewer.' + key]; }
      const v = localStorage.getItem('ha-tools-trace-viewer-' + key);
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

  // ============================================================

  _loadStoredTraces() {
    try {
      const d = localStorage.getItem('ha-tools-trace-viewer-stored');
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
      localStorage.setItem('ha-tools-trace-viewer-stored', JSON.stringify(trimmed));
    } catch (e) {
      console.warn('[Trace Viewer] Could not save traces:', e);
    }
  }

  _loadStoredDetails() {
    try {
      const d = localStorage.getItem('ha-tools-trace-viewer-details');
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
      localStorage.setItem('ha-tools-trace-viewer-details', JSON.stringify(this._storedDetails));
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

  _traceKey(id) {
    return id === null || id === undefined ? null : String(id);
  }

  _buildTraceBucket(traces) {
    const bucket = { count: 0, lastRun: null, traces: [] };
    for (const t of traces) {
      bucket.count++;
      bucket.traces.push(t);
      const st = t.timestamp?.start ? new Date(t.timestamp.start) : null;
      if (st && (!bucket.lastRun || st > bucket.lastRun)) bucket.lastRun = st;
    }
    return bucket;
  }

  _cacheItemTraces(itemId, traces) {
    const key = this._traceKey(itemId);
    if (!key) return null;
    const normalized = traces.map(t => ({ ...t, item_id: t.item_id ?? itemId }));
    const merged = new Map((this._traceMap[key]?.traces || []).map(t => [t.run_id, t]));
    for (const t of normalized) merged.set(t.run_id, t);
    this._traceMap[key] = this._buildTraceBucket([...merged.values()]);
    for (const t of normalized) {
      this._storedTraces[t.item_id + '::' + t.run_id] = t;
    }
    this._saveStoredTraces();
    return this._traceMap[key];
  }

  _getStoredTraceCount() {
    // The live cache can exceed retention, or a storage write can fail.
    // Count the persisted snapshot that is available after reloading.
    return Object.keys(this._loadStoredTraces()).length;
  }

  // ============================================================

  static get _translations() {
    return {
      en: {
        traceViewer: 'Trace Viewer', automations: 'Automations', allTraces: 'All Traces',
        traces: 'Traces', traceDetail: 'Trace Detail', timeline: 'Timeline', json: 'JSON',
        changes: 'Changes', config: 'Config', related: 'Related', flowGraph: 'Flow',
        search: 'Search automations...', searchTraces: 'Search traces...',
        unavailableDetail: 'Trace details are unavailable. Choose a recent trace or refresh the view.',
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
        previousPage: 'Previous page', nextPage: 'Next page',
      },
            pl: {
        traceViewer: 'Przegl\u0105darka \u015alad\u00f3w', automations: 'Automatyzacje', allTraces: 'Wszystkie',
        traces: '\u015alady', traceDetail: 'Szczeg\u00f3\u0142y', timeline: 'O\u015b Czasowa', json: 'JSON',
        changes: 'Zmiany', config: 'Konfiguracja', related: 'Powi\u0105zane', flowGraph: 'Graf',
        search: 'Wyszukaj automatyzacje...', searchTraces: 'Wyszukaj \u015blady...',
        unavailableDetail: 'Szczegóły śladu są niedostępne. Wybierz nowszy ślad lub odśwież widok.',
        noTraces: 'Nie znaleziono \u015blad\u00f3w', noAutomations: 'Nie znaleziono automatyzacji',
        clickAutomationToView: 'Wybierz automatyzacj\u0119', clickTraceToView: 'Wybierz \u015blad',
        trigger: 'Wyzwalacz', conditions: 'Warunki', actions: 'Akcje',
        status: 'Status', duration: 'Czas', ms: 'ms',
        loading: '\u0141adowanie...', error: 'B\u0142\u0105d', success: 'Sukces',
        running: 'Uruchomione', aborted: 'Przerwane', stopped: 'Zatrzymane',
        sortBy: 'Sortuj:', sortName: 'Nazwa (A-Z)', sortLastTriggered: 'Ostatnie',
        sortTriggerCount: 'Liczba \u015alad\u00f3w',
        filterByStatus: 'Status:', allStatuses: 'Wszystkie', statusRunning: 'W\u0142.',
        statusStopped: 'Wy\u0142.', statusError: 'B\u0142\u0105d',
        justNow: 'Teraz', minutesAgo: 'm temu', hoursAgo: 'h temu', daysAgo: 'd temu',
        groupBy: 'Grupuj:', groupAutomation: 'Automatyzacja', groupResult: 'Rezultat', groupTrigger: 'Wyzwalacz',
        timeRange: 'Czas:', timeAll: 'Ca\u0142y', time1h: '1h', time6h: '6h',
        time24h: '24h', time7d: '7d', time30d: '30d', timeCustom: 'W\u0142asny...',
        export: 'Eksport', exportJson: 'JSON', exportCsv: 'CSV',
        selectAll: 'Wszystkie', selected: 'wybranych', refresh: 'Od\u015bwie\u017c',
        totalTraces: '\u0142\u0105cznie', successRate: 'sukces', avgDuration: '\u015brednio',
        changedVariables: 'Zmienione Zmienne', noChanges: 'Brak zmian zmiennych',
        viewMode: 'Widok:', byAutomation: 'Wg Automatyzacji', flatList: 'Wszystkie',
        executedAt: 'Wykonano:', finishedAt: 'Zako\u0144czono o', runtime: 'czas wykonania',
        triggeredBy: 'Wyzwolone przez', testCondition: 'Warunek',
        performAction: 'Wykonaj akcj\u0119', automationConfig: 'Konfiguracja Automatyzacji',
        relatedActivity: 'Powi\u0105zana Aktywno\u015b\u0107', noRelatedActivity: 'Brak powi\u0105zanej aktywno\u015bci',
        entityChanged: 'zmieniono na', triggeredByAction: 'wyzwolone przez akcj\u0119',
        copyJson: 'Kopiuj', copied: 'Skopiowano!',
        selectMode: 'Zaznacz', cancel: 'Anuluj',
        previousPage: 'Poprzednia strona', nextPage: 'Nast\u0119pna strona',
      },
    };
  }

  _t(key) {
    const lang = (this._hass?.language || 'en').startsWith('pl') ? 'pl' : 'en';
    const T = HATraceViewer._translations;
    return (T[lang] || T['en'])[key] || T['en'][key] || key;
  }

  setConfig(config) { this.config = { title: 'Trace Viewer', ...config }; if (this._hass) this.render(); }

  set hass(hass) {
    const previousLanguage = this._lang;
    try {
      var _bg = (getComputedStyle(this).getPropertyValue('--card-background-color') || getComputedStyle(this).getPropertyValue('--primary-background-color') || '').trim();
      var _d = false;
      if (_bg) {
        var _h, _r, _g, _b, _m;
        if (_bg.charAt(0) === '#') { _h = _bg.slice(1); if (_h.length === 3) _h = _h.replace(/(.)/g, '$1$1'); _r = parseInt(_h.slice(0,2),16); _g = parseInt(_h.slice(2,4),16); _b = parseInt(_h.slice(4,6),16); }
        else { _m = _bg.match(/[\d.]+/g); if (_m) { _r = +_m[0]; _g = +_m[1]; _b = +_m[2]; } }
        if (_r != null) _d = (0.2126*_r + 0.7152*_g + 0.0722*_b) / 255 < 0.5;
      } else if (hass && hass.themes) { _d = !!hass.themes.darkMode; }
      this.classList.toggle('bento-dark', _d);
    } catch (e) {}

    if (hass?.language) this._lang = hass.language.startsWith('pl') ? 'pl' : 'en';
    const firstLoad = !this._hass;
    const roleChanged = !firstLoad && (this._hass?.user?.id !== hass?.user?.id || !!this._hass?.user?.is_admin !== !!hass?.user?.is_admin);
    const sourceChanged = !firstLoad && (this._hass?.connection !== hass?.connection
      || this._comparisonConnectionState !== hass?.connection?.connected);
    if (firstLoad || roleChanged || sourceChanged) {
      this._invalidateComparison(true);
      this._accessEpoch++; this._traceLoadToken = null; this._detailLoadToken = null;
      this._loadingSelected = false; this._traceListError = null; this.traceDetail = null;
      this.selectedAutomation = null; this.selectedTrace = null;
      this.selectedTraceIds.clear(); this.selectedAutoIds.clear();
    }
    this._hass = hass;
    this._comparisonConnectionState = hass?.connection?.connected;
    this._ensureComparisonLifecycle();
    this._syncExportContext();
    if (!hass) { this._cardSurface.innerHTML = this._css(); return; }
    if (firstLoad || roleChanged || sourceChanged) {
      this._allTraces = [];
      this._traceMap = {};
      this.updateAutomationData();
    } else if (hass && previousLanguage !== this._lang) {
      // Detail descriptions are localized when built. Reuse the same source;
      // switching language must not fetch, select another run or invent a result.
      if (this.traceDetail && !this.traceDetail.unavailable) {
        this.traceDetail = this._buildDetail(this.traceDetail.trace, this.traceDetail.rawData);
      }
      this.render();
    }
  }

  // ============================================================

  _isAdminSession(epoch) { return epoch === this._accessEpoch && !!this._hass?.user?.is_admin; }

  async updateAutomationData() {
    const access = this._accessEpoch;
    if (!this._hass) return;
    if (!this._hass.user?.is_admin) {
      this._allTraces = [];
      this._traceMap = {};
      this._allFlatTraces = [];
      this._rawAutomations = [];
      this.automations = [];
      this.traces = [];
      this.traceDetail = null;
      this._storedTraces = {};
      this._storedDetails = {};
      this._adminStorageLoaded = false;
      this._fetchError = null;
      this.render();
      return;
    }
    if (!this._adminStorageLoaded) {
      this._storedTraces = this._loadStoredTraces();
      this._storedDetails = this._loadStoredDetails();
      this._adminStorageLoaded = true;
    }
    // Global and selected refreshes share one source ordering boundary.
    const listToken = {};
    this._listRequestToken = listToken;
    this._traceLoadToken = null;
    this._loadingSelected = false; this._traceListError = null;
    let liveTraces = [];
    this._loadingTraces = true; this.render();
    try {
      liveTraces = await this._hass.callWS({ type: 'trace/list', domain: 'automation' });
      if (!this._isAdminSession(access) || this._listRequestToken !== listToken) return;
      this._fetchError = null;
    } catch (e) {
      if (!this._isAdminSession(access) || this._listRequestToken !== listToken) return;
      this._fetchError = this._lang === 'pl' ? 'Nie można wczytać śladów.' : 'Could not load traces.';
      console.warn('[Trace Viewer] Could not fetch traces:', e);
    }

    this._loadingTraces = false;
    // Merge live traces with stored (persisted) traces
    this._allTraces = this._mergeAndStoreTraces(liveTraces);

    this._traceMap = {};
    this._allTraces.forEach(t => {
      const key = this._traceKey(t.item_id);
      if (!key) return;
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
        const automationKey = this._traceKey(automationId);
        const lastTriggered = state.attributes?.last_triggered ? new Date(state.attributes.last_triggered) : null;
        const traceInfo = automationKey ? this._traceMap[automationKey] : null;
        return {
          entity, name, automationId,
          isActive: state.state === 'on', lastTriggered,
          triggerCount: traceInfo ? traceInfo.count : 0,
          status: state.state === 'on' ? 'running' : state.state === 'off' ? 'stopped' : 'error'
        };
      });

    this._allFlatTraces = [];
    for (const t of this._allTraces) {
      const traceKey = this._traceKey(t.item_id);
      const auto = this._rawAutomations.find(a => this._traceKey(a.automationId) === traceKey);
      this._allFlatTraces.push(this._traceSummary(t, auto, auto?.entity || t.item_id, t.item_id));
    }
    this._allFlatTraces.sort((a, b) => this._traceTimeOrder(a, b));

    if (this.selectedAutomation) {
      const auto = this._rawAutomations.find(a => a.entity === this.selectedAutomation);
      const bucket = this._traceMap[this._traceKey(auto?.automationId)];
      if (bucket) this._applyTraceBucket(bucket, auto, auto.entity, auto.automationId);
      else this.traces = [];
    }
    this.applyFiltersAndSort();
    this.render();
    this._startTimer();
  }

  _traceStatus(t) {
    if (t.script_execution === 'error' || t.script_execution === 'any_error') return 'error';
    if (t.state === 'stopped' && t.script_execution === 'finished') return 'success';
    if (t.state === 'running') return 'running';
    if (t.script_execution === 'aborted') return 'aborted';
    return 'unconfirmed';
  }

  _traceResult(status) {
    return createUiV3({ language: this._lang }).status(
      status === 'success' || status === 'error' ? status : 'unconfirmed');
  }

  _traceResultHtml(status) {
    return createUiV3({ language: this._lang }).statusHtml(this._traceResult(status).code);
  }

  _traceStatusLabel(status) {
    const result = this._traceResult(status);
    const domain = status === 'running' || status === 'aborted' ? ` · ${this._t(status)}` : '';
    return `${result.icon} ${result.label}${domain}`;
  }

  _matchesTraceResult(trace) {
    const filter = this.traceFilterResult;
    if (filter === 'all') return true;
    if (filter === 'unconfirmed' || filter === 'unknown') return this._traceResult(trace.status).code === 'unconfirmed';
    return trace.status === filter;
  }

  _traceResultOptions() {
    const values = ['all', 'success', 'error', 'unconfirmed', 'running', 'aborted'];
    // Keep a restored legacy/unknown selection visible instead of silently selecting All.
    if (!values.includes(this.traceFilterResult)) values.push(this.traceFilterResult);
    return values.map(value => {
      const label = value === 'all' ? this._t('allStatuses')
        : values.indexOf(value) < 6 || value === 'unknown' ? this._traceStatusLabel(value) : String(value);
      return `<option value="${_esc(value)}" ${this.traceFilterResult === value ? 'selected' : ''}>${_esc(label)}</option>`;
    }).join('');
  }

  _traceDate(value) {
    if (typeof value !== 'string' || !value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  _traceTimeOrder(a, b) {
    if (a.timestamp === null) return b.timestamp === null ? 0 : 1;
    if (b.timestamp === null) return -1;
    return b.timestamp - a.timestamp;
  }

  // ============================================================

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
    return traces.filter(t => t.timestamp !== null && Number.isFinite(+t.timestamp) && (!c || t.timestamp >= c) && (!e || t.timestamp <= e));
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
    t = t.filter(x => this._matchesTraceResult(x));
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      t = t.filter(x => x.automationName.toLowerCase().includes(q) || x.trigger.toLowerCase().includes(q));
    }
    return t;
  }

  _groupTraces(traces) {
    const g = Object.create(null);
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
    const measured = traces.filter(t => Number.isFinite(t.duration) && t.duration >= 0);
    const avg = measured.length ? Math.round(measured.reduce((sum, t) => sum + t.duration, 0) / measured.length) : null;
    return { n, ok, err, avg, rate: n ? Math.round((ok / n) * 100) : 0 };
  }

  // ============================================================

  _startTimer() {
    if (this.relativeTimeUpdater) clearInterval(this.relativeTimeUpdater);
    this.relativeTimeUpdater = setInterval(() => {
      this.shadowRoot?.querySelectorAll('[data-ts]').forEach(el => {
        if (!el.dataset.ts) return;
        const timestamp = new Date(el.dataset.ts);
        if (!Number.isFinite(timestamp.getTime())) return;
        const relative = this._relTime(timestamp);
        el.textContent = el.classList.contains('tr-time')
          ? `${this._fmtTimeShort(timestamp)} · ${relative}`
          : relative;
      });
    }, 30000);
  }

  _relTime(d) {
    if (!d || !Number.isFinite(+d)) return this._lang === 'pl' ? 'Brak daty' : 'Date unavailable';
    const m = Math.floor((Date.now() - d) / 60000);
    if (m < 1) return this._t('justNow');
    if (m < 60) return `${m}${this._t('minutesAgo')}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}${this._t('hoursAgo')}`;
    return `${Math.floor(h / 24)}${this._t('daysAgo')}`;
  }

  _fmtDur(ms) {
    if (!Number.isFinite(ms) || ms < 0) return this._lang === 'pl' ? 'Brak pomiaru' : 'Not measured';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  _fmtTime(d) {
    if (!d || !Number.isFinite(+d)) return this._lang === 'pl' ? 'Brak daty' : 'Date unavailable';
    return d.toLocaleString(this._lang === 'pl' ? 'pl-PL' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  _fmtTimeShort(d) {
    if (!d || !Number.isFinite(+d)) return this._lang === 'pl' ? 'Brak daty' : 'Date unavailable';
    return d.toLocaleTimeString(this._lang === 'pl' ? 'pl-PL' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // ============================================================

  onAutoClick(entity) {
    this._detailLoadToken = null;
    this.selectedAutomation = entity;
    this.selectedTrace = null;
    this.traceDetail = null;
    this.selectedTraceIds.clear();
    this.selectMode = false;
    this.tracePage = 0;
    this._loadTraces(entity);
  }

  _traceSummary(t, auto, entity, fallbackItemId) {
    const st = this._traceDate(t.timestamp?.start);
    const ft = this._traceDate(t.timestamp?.finish);
    return {
      id: t.run_id, item_id: t.item_id ?? fallbackItemId, automationEntity: entity,
      automationName: auto?.name || entity,
      timestamp: st, finishTime: ft,
      status: this._traceStatus(t), duration: st && ft && ft >= st ? ft - st : null,
      lastStep: t.last_step || '', scriptExecution: t.script_execution || '',
      trigger: t.trigger || 'unknown', raw: t
    };
  }

  _applyTraceBucket(bucket, auto, entity, aid) {
    let list = bucket.traces.map(t => this._traceSummary(t, auto, entity, aid))
      .sort((a, b) => this._traceTimeOrder(a, b));
    this.traces = this._filterByTime(list);
    this.traces = this.traces.filter(x => this._matchesTraceResult(x));
  }

  async _loadTraces(entity) {
    const access = this._accessEpoch;
    if (!this._isAdminSession(access)) return;
    this._detailLoadToken = null; this._traceListError = null; this._loadingSelected = true;
    const loadToken = {};
    this._traceLoadToken = loadToken;
    this._listRequestToken = loadToken;
    this._loadingTraces = false; this._fetchError = null;
    this.traces = [];
    this.selectedTrace = null;
    this.traceDetail = null;
    this.tracePage = 0;
    this.render();

    const auto = this._rawAutomations.find(a => a.entity === entity);
    const aid = auto?.automationId;
    const aidKey = this._traceKey(aid);
    if (!aidKey) { this._loadingSelected = false; this.render(); return; }

    if (this._traceMap[aidKey]) {
      this._applyTraceBucket(this._traceMap[aidKey], auto, entity, aid);
      this.render();
    }

    try {
      const liveTraces = await this._hass.callWS({ type: 'trace/list', domain: 'automation', item_id: aid });
      if (!this._isAdminSession(access) || this._traceLoadToken !== loadToken || this._listRequestToken !== loadToken || this.selectedAutomation !== entity) return;
      const bucket = this._cacheItemTraces(aid, Array.isArray(liveTraces) ? liveTraces : []);
      if (bucket) {
        auto.triggerCount = bucket.count;
        if (bucket.lastRun && (!auto.lastTriggered || bucket.lastRun > auto.lastTriggered)) auto.lastTriggered = bucket.lastRun;
        this._allFlatTraces = this._allFlatTraces.filter(t => this._traceKey(t.item_id) !== aidKey)
          .concat(bucket.traces.map(t => this._traceSummary(t, auto, entity, aid)))
          .sort((a, b) => this._traceTimeOrder(a, b));
        this.applyFiltersAndSort();
        this._applyTraceBucket(bucket, auto, entity, aid);
      }
    } catch (e) {
      if (!this._isAdminSession(access) || this._traceLoadToken !== loadToken || this._listRequestToken !== loadToken || this.selectedAutomation !== entity) return;
      this._traceListError = this._lang === 'pl' ? 'Nie można wczytać śladów tej automatyzacji.' : 'Could not load automation traces.';
    }
    this._loadingSelected = false; this.render();
  }

  async onTraceClick(traceId) {
    const access = this._accessEpoch;
    const comparisonSource = this._comparisonSourceEpoch;
    if (!this._isAdminSession(access)) return;
    if (this.selectMode) {
      this.selectedTraceIds.has(traceId) ? this.selectedTraceIds.delete(traceId) : this.selectedTraceIds.add(traceId);
      this.render();
      return;
    }
    const trace = this.traces.find(t => t.id === traceId) || this._allFlatTraces.find(t => t.id === traceId);
    if (!trace) return;
    const detailToken = {}; this._detailLoadToken = detailToken;
    this.selectedTrace = traceId;
    this.traceDetail = null;
    this.detailTab = 'timeline';
    this.render();

    try {
      const detail = await this._hass.callWS({
        type: 'trace/get', domain: 'automation',
        item_id: trace.item_id, run_id: trace.id
      });
      if (!this._isAdminSession(access) || this._detailLoadToken !== detailToken || this.selectedTrace !== traceId) return;
      // Persist detail for future use (HA may purge)
      this._storedDetails[trace.item_id + '::' + trace.id] = detail;
      this._saveStoredDetails();
      this.traceDetail = this._buildDetail(trace, detail);
      this._comparisonDetailSourceEpoch = comparisonSource;
    } catch (e) {
      if (!this._isAdminSession(access) || this._detailLoadToken !== detailToken || this.selectedTrace !== traceId) return;
      // Try loading from stored details
      const storedKey = trace.item_id + '::' + trace.id;
      if (this._storedDetails[storedKey]) {
        this.traceDetail = this._buildDetail(trace, this._storedDetails[storedKey]);
        this._comparisonDetailSourceEpoch = null; // Browser cache cannot establish current source identity.
      } else {
        this.traceDetail = {
          trace, steps: [], changedVars: [], rawData: { error: e.message },
          configYaml: '', relatedEntities: [], unavailable: true
        };
      }
    }
    this.render();
  }

  // ============================================================

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

    // Only a recorded finish can create a completion step; outcome is independent of timing.
    if (trace.finishTime && Number.isFinite(+trace.finishTime)) {
      const result = this._traceResult(trace.status);
      steps.push({
        key: 'finished', category: 'result', icon: result.icon,
        description: `${result.label} · ${this._t('finishedAt')} ${this._fmtTime(trace.finishTime)} (${this._t('runtime')}: ${this._fmtDur(trace.duration)})`,
        details: {}, status: result.code,
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

  // ============================================================

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

      // Node colors (Bento tokens with hex fallbacks)
      let fill, stroke, textFill;
      if (step.category === 'trigger') { fill = 'rgba(59,130,246,0.12)'; stroke = 'var(--bento-primary, #3B82F6)'; textFill = 'var(--bento-primary, #3B82F6)'; }
      else if (step.category === 'condition') {
        if (step.status === 'skipped') { fill = 'rgba(100,116,139,0.08)'; stroke = 'var(--bento-text-secondary, #94A3B8)'; textFill = 'var(--bento-text-secondary, #94A3B8)'; }
        else { fill = 'rgba(245,158,11,0.12)'; stroke = 'var(--bento-warning, #F59E0B)'; textFill = 'var(--tc, #B45309)'; }
      }
      else if (step.category === 'result') { fill = step.status === 'success' ? 'rgba(16,185,129,0.12)' : step.status === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(173,82,0,0.10)'; stroke = this._traceResultColor(step.status); textFill = stroke; }
      else if (step.status === 'error') { fill = 'rgba(239,68,68,0.12)'; stroke = 'var(--bento-error, #EF4444)'; textFill = 'var(--bento-error, #EF4444)'; }
      else { fill = 'rgba(16,185,129,0.1)'; stroke = 'var(--bento-success, #10B981)'; textFill = 'var(--tc, #1E293B)'; }

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

  // ============================================================

  _csvCell(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    let text = String(value ?? '');
    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  // W6 exports are local allowlisted snapshots. Neither preview nor Save fetches.
  _exportRows(scope = this._exportIntent?.scope) {
    if (scope === 'comparison') return this._comparisonExportable() ? this._comparisonView.runs : [];
    if (scope === 'automations') {
      const rows = [];
      for (const entity of this.selectedAutoIds) {
        const auto = this._rawAutomations.find(a => a.entity === entity);
        const aid = this._traceKey(auto?.automationId);
        if (aid && this._traceMap[aid]) rows.push(...this._traceMap[aid].traces.map(t => this._traceSummary(t, auto, entity, aid)));
      }
      return rows;
    }
    const available = this.viewMode === 'all-traces' ? this._filteredFlat() : this.traces;
    return scope === 'selected' ? available.filter(t => this.selectedTraceIds.has(t.id)) : available;
  }

  _exportObjectId(value) {
    if (!value || typeof value !== 'object') return 0;
    if (!this._exportObjectIds.has(value)) this._exportObjectIds.set(value, ++this._exportObjectSerial);
    return this._exportObjectIds.get(value);
  }

  _readExportContext() {
    const hass = this._hass;
    // Signature stays in memory, never enters a payload. Do not stringify raw data.
    const signature = JSON.stringify([
      this._accessEpoch, hass?.user?.id, hass?.user?.is_admin, this._exportObjectId(hass?.connection),
      hass?.connection?.connected, this._comparisonOffline, this._comparisonTransportOffline,
      this._comparisonSourceEpoch, this._comparisonEpoch, this._lang, this.viewMode,
      this.selectedAutomation, this.selectedTrace, this.groupBy, this.searchQuery, this.filterStatus,
      this.sortBy, this.timeRange, this.customTimeFrom, this.customTimeTo, this.traceFilterResult,
      [...this.selectedTraceIds], [...this.selectedAutoIds], [...this._comparisonRuns.keys()],
      this._loadingTraces, this._loadingSelected, !!this._fetchError, !!this._traceListError,
      this._exportObjectId(this.traces), this._exportObjectId(this._allFlatTraces),
      this._exportObjectId(this._traceMap), this._exportObjectId(this._rawAutomations),
      this._exportObjectId(this.traceDetail), this._exportObjectId(this._comparisonView),
      this._exportIntent?.scope,
      this._exportRows().map(row => [row.item_id, row.id, row.automationName,
        this._exportObjectId(row.raw), row.raw?.timestamp?.start, row.raw?.timestamp?.finish,
        row.raw?.state, row.raw?.script_execution])
    ]);
    if (signature !== this._exportSignature) { this._exportSignature = signature; this._exportRevision++; }
    const connected = !!hass?.connection && hass.connection.connected === true
      && !this._comparisonOffline && !this._comparisonTransportOffline && this.isConnected;
    return { role: hass?.user?.is_admin ? 'admin' : 'non_admin', userId: hass?.user?.id || 'unknown',
      connectionId: this._exportObjectId(hass?.connection), datasetId: `trace-viewer:${this._exportIntent?.scope || 'all'}`,
      revision: this._exportRevision, connected, canExport: hass?.user?.is_admin === true
        && typeof hass.user.id === 'string' && hass.user.id.trim().length > 0,
      sourceConfirmed: this._exportRows().length > 0 && !this._loadingTraces && !this._loadingSelected
        && !this._fetchError && !this._traceListError };
  }

  _syncExportContext() {
    if (this._exportLanguage !== this._lang) {
      this._exportLanguage = this._lang;
      this._exportDialog?.cancel();
    }
    const revision = this._exportRevision;
    this._readExportContext();
    if (revision !== this._exportRevision) this._exportDialog?.contextChanged();
  }

  _invalidateExport() {
    this._exportRevision++;
    this._exportDialog?.contextChanged();
  }

  _comparisonExportable() {
    const view = this._comparisonView, source = view?.exportSource;
    if (!source || source.access !== this._accessEpoch || source.epoch !== this._comparisonEpoch
      || source.sourceEpoch !== this._comparisonSourceEpoch || source.connection !== this._hass?.connection
      || source.userId !== this._hass?.user?.id || !this._hass?.user?.is_admin
      || !['available', 'unconfirmed'].includes(view.result?.status)
      || view.data?.length !== 2 || view.runs?.length !== 2) return false;
    const selected = this._orderedComparisonRuns();
    if (selected.length !== 2 || selected.some((run, index) => this._comparisonIdentity(run) !== this._comparisonIdentity(view.runs[index])
      || view.data[index].run_id !== run.id || view.data[index].item_id !== run.item_id)) return false;
    // Reuse the same strict contract only as a validation boundary, not a new engine.
    const checked = tvTraceContract.compare(view.data[0], view.data[1]);
    return checked.status === 'available' && JSON.stringify(checked.data) === JSON.stringify(view.result.data);
  }

  _normalizedExportDetail(row) {
    if (this._comparisonView?.data?.some(run => run.run_id === row.id && run.item_id === row.item_id)
      && this._comparisonExportable()) {
      const data = this._comparisonView.data.find(run => run.run_id === row.id && run.item_id === row.item_id);
      if (data) return { data, source: 'current_comparison' };
    }
    if (this._comparisonDetailSourceEpoch === this._comparisonSourceEpoch && !this.traceDetail?.unavailable
      && this.traceDetail?.trace && this._comparisonIdentity(this.traceDetail.trace) === this._comparisonIdentity(row)) {
      const capability = tvTraceContract.normalizeFull(this.traceDetail.rawData, { expectedItemId: row.item_id });
      if (capability.status === 'available' && capability.data.run_id === row.id && capability.data.item_id === row.item_id) {
        return { data: capability.data, source: 'current_detail' };
      }
    }
    return null; // Unbound persisted detail cannot prove the current HA source.
  }

  _exportRecord(row, includePrivate, index, names, paths) {
    if (!names.has(row.item_id)) names.set(row.item_id, 'Automation ' + (names.size + 1));
    const list = tvTraceContract.normalizeList([row.raw], { expectedItemId: row.item_id });
    const summary = list.status === 'available' && list.data.runs[0].run_id === row.id ? list.data.runs[0] : null;
    const full = this._normalizedExportDetail(row), data = full?.data;
    const state = data?.run_state || summary?.run_state;
    const outcome = summary?.script_execution;
    const status = this._traceStatus({ state, script_execution: outcome });
    const privateText = value => typeof value === 'string' && value.length > 0 && value.length <= 256 ? value : null;
    const record = { run_alias: 'Run ' + (index + 1), run_id: 'Run ' + (index + 1), automation: names.get(row.item_id),
      automation_alias: names.get(row.item_id), redacted: true, status,
      duration_ms: data ? data.run_duration_ms : summary?.run_duration_ms ?? null,
      detail: { status: data ? 'available' : 'unavailable', source: full?.source || 'unavailable',
        step_count: data ? data.nodes.length : null,
        nodes: data ? data.nodes.map(node => {
          if (!paths.has(node.path)) paths.set(node.path, 'Point ' + (paths.size + 1));
          return { point: paths.get(node.path), ordinal: node.ordinal, status: node.status, offset_ms: node.offset_ms };
        }) : null } };
    if (includePrivate) {
      // Reviewed metadata only; no item/entity IDs, paths, free-text errors or triggers.
      record.run_id = privateText(row.id) || record.run_id;
      record.automation = privateText(row.automationName) || record.automation;
      record.timestamp = summary?.started_at || null;
      record.finish = summary?.finished_at || null;
    }
    return record;
  }

  _buildExportPayload({ draft, signal }) {
    const context = this._readExportContext();
    if (signal.aborted || !context.connected || !context.canExport || !context.sourceConfirmed) return { status: 'no_data', serialized: '' };
    const scope = this._exportIntent.scope, rows = this._exportRows(scope);
    if (!rows.length) return { status: 'no_data', serialized: '' };
    const names = new Map(), paths = new Map();
    const records = rows.map((row, index) => this._exportRecord(row, draft.includePrivate, index, names, paths));
    const pl = this._lang === 'pl';
    const included = [pl ? 'Dokładny wybrany zakres, aliasy, stan i potwierdzone czasy trwania.' : 'Exact chosen scope, aliases, state and confirmed durations.',
      pl ? 'Dostępne znormalizowane punkty wykonania; brakujące dane oznaczone jawnie.' : 'Available normalized execution points; missing data explicitly marked.',
      draft.includePrivate ? (pl ? 'Nazwy automatyzacji, identyfikatory uruchomień i potwierdzone daty wybranych rekordów.' : 'Automation names, run identifiers and confirmed dates of the chosen records.')
        : (pl ? 'Pola prywatne wyłączone.' : 'Private fields off.')];
    const excluded = [pl ? 'Tokeny, użytkownicy, adresy, surowa konfiguracja, zmienne, komunikaty błędów, opis wyzwalacza, identyfikatory encji i ścieżki źródłowe.' : 'Tokens, users, addresses, raw configuration, variables, error messages, trigger text, entity identifiers and source paths.'];
    const sourceLimit = pl
      ? 'Lokalny zakres karty: lista może zawierać historię przeglądarki. Szczegóły wyłącznie z bieżącego potwierdzonego źródła. Brak pobierania; null oznacza brak danych. Nie dowodzi pełnego przebiegu.'
      : 'Local card scope: the list may include browser history. Details only from the current confirmed source. No fetching; null means missing data. Does not prove a complete execution.';
    let partial = records.some(record => record.detail.status !== 'available' || record.duration_ms === null || this._traceResult(record.status).code === 'unconfirmed');
    const report = { schema: 'ha-trace-viewer-export-v1', status: 'success', scope,
      private_fields: draft.includePrivate, record_count: records.length, included, excluded,
      source_limit: sourceLimit, records };
    if (scope === 'automations') {
      // Group by source identity rather than label, preserving duplicate and prototype-like names.
      report.groups = [...names].map(([itemId, alias]) => ({ automation_alias: alias,
        records: records.filter((_record, index) => rows[index].item_id === itemId) }));
      report.selected_automation_count = this.selectedAutoIds.size;
      report.empty_automation_count = Math.max(0, this.selectedAutoIds.size - report.groups.length);
      partial ||= report.empty_automation_count > 0;
    }
    if (scope === 'comparison') {
      if (!this._comparisonExportable()) return { status: 'no_data', serialized: '' };
      const view = this._comparisonView;
      const points = this._comparisonPoints(view).map(point => ({ point: paths.get(point.path), ordinal: point.ordinal,
        category: point.category, offset_ms: point.offset,
        delta_ms: Object.hasOwn(point, 'delta_ms') ? point.delta_ms : null }));
      report.comparison = { baseline: 'Run 1', current: 'Run 2', source_status: view.result.status,
        run: { classification: view.result.data.run.classification, delta_ms: view.result.data.run.delta_ms },
        first_difference: points.find(point => point.category !== 'unchanged') || null, points };
      partial ||= view.result.status !== 'available';
    }
    report.status = partial ? 'partial' : 'success';
    let serialized;
    if (draft.format === 'json') serialized = JSON.stringify(report, null, 2);
    else if (draft.format === 'csv') {
      // Metadata accompanies every row so a partial CSV remains self-describing.
      const keys = ['schema','report_status','scope','private_fields','record_count','source_limit','included','excluded',
        'run_alias','run_id','automation','automation_alias','status','duration_ms','timestamp','finish','detail_status','detail_source','step_count','nodes',
        'selected_automation_count','empty_automation_count','comparison'];
      const csvRows = records.map(record => [report.schema, report.status, scope, report.private_fields, records.length, sourceLimit,
        JSON.stringify(included), JSON.stringify(excluded), record.run_alias, record.run_id, record.automation, record.automation_alias,
        record.status, record.duration_ms === null ? 'null' : record.duration_ms,
        record.timestamp ?? 'null', record.finish ?? 'null', record.detail.status, record.detail.source,
        record.detail.step_count === null ? 'null' : record.detail.step_count, JSON.stringify(record.detail.nodes),
        report.selected_automation_count ?? '', report.empty_automation_count ?? '', report.comparison ? JSON.stringify(report.comparison) : '']);
      serialized = [keys, ...csvRows].map(values => values.map(value => this._csvCell(value)).join(',')).join('\r\n');
    } else return { status: 'no_data', serialized: '' };
    return { serialized, confirmed: true, sourceConfirmed: true, status: report.status, included, excluded, sourceLimit };
  }

  _performExportDownload({ blob, filename, context, signal }) {
    const current = this._readExportContext();
    if (signal.aborted || !this.isConnected || !current.canExport || !current.connected || !current.sourceConfirmed
      || Object.keys(context).some(key => context[key] !== current[key])) return { outcome: 'unknown' };
    const url = URL.createObjectURL(blob);
    try {
      const anchor = this.ownerDocument.createElement('a'); anchor.href = url; anchor.download = filename;
      anchor.click();
      return { outcome: 'initiated' }; // Browser handoff cannot confirm persistence to disk.
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }

  _openExport(scope, format, opener) {
    if (!['json', 'csv'].includes(format) || this._hass?.user?.is_admin !== true || !this._exportRows(scope).length) return;
    // Do not replace the factory while a previous handoff may still settle.
    if (this._exportHandoff) { this._exportDialog?.open({ opener }); return; }
    this._exportDialog?.destroy();
    this._exportIntent = { scope };
    this._syncExportContext();
    const launchRevision = this._exportRevision;
    this._exportDialog = createExportDialog({ root: this.shadowRoot, getLanguage: () => this._lang,
      createUiV3, getContext: () => this._readExportContext(), formats: ['json', 'csv'], defaultFormat: format,
      defaultFilename: `${scope === 'comparison' ? 'comparison' : scope === 'automations' ? 'automations' : 'traces'}.${format}`,
      policy: { id: 'trace-viewer-w6-allowlist-v1', allowlistedFields: ['scope','status','counts','aliases','durations','normalized_points','comparison','reviewed_run_metadata'],
        neverInclude: ['tokens','users','addresses','raw_config'] },
      buildPayload: request => this._buildExportPayload(request),
      performDownload: async request => {
        if (this._exportHandoff) return { outcome: 'unknown' };
        const handoff = {}; this._exportHandoff = handoff;
        try { return await this._performExportDownload(request); }
        finally { if (this._exportHandoff === handoff) this._exportHandoff = null; }
      } });
    // Factory opens synchronously and starts only one preview. No post-await open.
    if (launchRevision === this._exportRevision && this.isConnected) this._exportDialog.open({ opener: opener || this._exportOpener(scope) });
  }

  _exportOpener(scope) {
    // Stable focus proxy resolves the replacement toolbar button after card repaint.
    return { get isConnected() { return true; }, focus: () => {
      if (this.isConnected) {
        const target = (scope === 'comparison' && this.shadowRoot.querySelector('#exportComparison'))
          || this.shadowRoot.querySelector('#expBtn');
        target?.focus({ preventScroll: true });
      }
    } };
  }

  _export(fmt, onlySelected) { this._openExport(onlySelected ? 'selected' : 'all', fmt); }
  _exportMultiAuto(fmt) { this._openExport('automations', fmt); }
  _exportComparison() { if (this._comparisonExportable()) this._openExport('comparison', 'json'); }

  // ============================================================

  _safeJson(obj) {
    try {
      const seen = new WeakSet();
      return JSON.stringify(obj, (k, v) => {
        if (typeof v === 'object' && v !== null) { if (seen.has(v)) return '[Circular]'; seen.add(v); }
        return v;
      }, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    } catch (e) { return 'Error: ' + e.message; }
  }

  // ============================================================

  _traceResultColor(status) {
    return status === 'success' ? 'var(--bento-success, #10B981)'
      : status === 'error' ? 'var(--bento-error, #EF4444)' : 'var(--bento-warning, #ad5200)';
  }

  // ============================================================

  _renderAutoList() {
    if (!this.automations.length) return `<div class="empty"><div class="empty-ico">\u26A0</div><div>${this._t('noAutomations')}</div></div>`;

    const ps = this.autoPageSize;
    const totalPages = Math.ceil(this.automations.length / ps);
    if (this.autoPage >= totalPages) this.autoPage = Math.max(0, totalPages - 1);
    const pageList = this.automations.slice(this.autoPage * ps, (this.autoPage + 1) * ps);

    const pag = totalPages > 1 ? `<div class="pag">
      <button class="pag-btn" data-apdir="-1" ${this.autoPage === 0 ? 'disabled' : ''} aria-label="${this._t('previousPage')}">\u2039</button>
      <span class="pag-info">${this.autoPage + 1}/${totalPages} (${this.automations.length})</span>
      <button class="pag-btn" data-apdir="1" ${this.autoPage >= totalPages - 1 ? 'disabled' : ''} aria-label="${this._t('nextPage')}">\u203A</button>
      <select class="pag-size" id="autoPagSize" aria-label="${this._lang==='pl'?'Automatyzacje na stronie':'Automations per page'}">
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
      <div class="auto-item ${isSel ? 'sel' : ''} ${isChk ? 'chk' : ''} s-${a.status}" data-auto="${_esc(a.entity)}">
        ${this.selectMode ? `<label class="family-check"><input type="checkbox" data-autocheck="${_esc(a.entity)}" aria-label="${_esc(this._t('selectMode')+': '+a.name)}" ${isChk ? 'checked' : ''}></label>` : ''}
        <button type="button" class="family-row-action" data-auto-action="${_esc(a.entity)}" role="button" tabindex="0" ${this.selectMode ? `aria-pressed="${isChk}"` : ''} aria-label="${_esc((this._lang === 'pl' ? (this.selectMode ? 'Wybierz automatyzację: ' : 'Otwórz automatyzację: ') : (this.selectMode ? 'Select automation: ' : 'Open automation: ')) + a.name)}">
          <span class="auto-name" style="display:block">${_esc(this._sanitize(a.name))}</span>
          <span class="auto-meta">
            <span class="auto-dot s-${a.status}"></span>
            <span data-ts="${a.lastTriggered?.toISOString() || ''}">${a.lastTriggered ? this._relTime(a.lastTriggered) : (this._lang === 'pl' ? 'Nigdy' : 'Never')}</span>
            <span class="auto-count">${a.triggerCount}</span>
          </span>
        </button>
      </div>`;
    }).join('')}</div>` + pag;
  }

  // ============================================================

  _comparisonText(key) {
    const labels = {
      compare: ['Porównaj uruchomienia', 'Compare runs'], select: ['Wybierz do porównania', 'Select for comparison'],
      remove: ['Usuń z porównania', 'Remove from comparison'], baseline: ['Bazowe (starsze)', 'Baseline (older)'],
      current: ['Bieżące (nowsze)', 'Current (newer)'], close: ['Zamknij porównanie', 'Close comparison'],
      choose: ['Wybierz dokładnie dwa uruchomienia tej samej automatyzacji.', 'Select exactly two runs of the same automation.'],
      limit: ['Możesz wybrać najwyżej dwa uruchomienia.', 'You can select at most two runs.'],
      different: ['Porównanie wymaga dwóch uruchomień tej samej automatyzacji.', 'Comparison requires two runs of the same automation.'],
      loading: ['Wczytywanie dwóch wybranych śladów…', 'Loading the two selected traces…'],
      malformed: ['Nieprawidłowe dane śladu', 'Malformed trace data'], no_data: ['Brak danych wykonania', 'No data for execution'],
      unavailable: ['Porównanie niedostępne', 'Comparison unavailable'], permission_denied: ['Brak uprawnień administratora', 'Administrator permission required'],
      unknown_role: ['Nie sprawdzono uprawnień', 'Permissions not checked'], aborted: ['Porównanie anulowane', 'Comparison canceled'],
      unconfirmed: ['Niepotwierdzony — wykonanie nadal trwa', 'Unconfirmed — execution is still running'],
      available: ['Porównanie zapisanych punktów wykonania', 'Comparison of recorded execution points'],
      added: ['Dodane punkty', 'Added points'], removed: ['Usunięte punkty', 'Removed points'],
      reached_later: ['Osiągnięte później', 'Reached later'], reached_earlier: ['Osiągnięte wcześniej', 'Reached earlier'],
      unchanged: ['W granicach progu czasu', 'Within timing threshold'], slower: ['Wolniejsze', 'Slower'], faster: ['Szybsze', 'Faster'],
      run: ['Czas całego uruchomienia', 'Whole run timing'], unknown: ['Brak danych czasu zakończenia', 'No completion timing data'],
      first: ['Pierwsza różnica', 'First difference'], jump: ['Przejdź do pierwszej różnicy', 'Jump to first difference'],
      no_difference: ['Brak różnic obecności lub czasu ponad próg w zapisanych punktach.', 'No recorded presence or timing differences above the threshold.'],
      scope: ['Tylko obecność i czas punktów wykonania; bez porównania wartości zmiennych ani konfiguracji. Brak zapisu nie potwierdza pełnego przebiegu.', 'Execution point presence and timing only; variable values and configuration are not compared. Missing records cannot confirm a complete execution.'],
      threshold: ['Próg czasu: co najmniej 20 ms; stosunek 1,25 (25% później/wolniej, 20% wcześniej/szybciej; Analyzer).', 'Timing threshold: at least 20 ms; ratio 1.25 (25% later/slower, 20% earlier/faster; Analyzer).'],
      order: ['Pierwsza = najwcześniejszy zapisany punkt od początku wykonania w jednym z tych śladów.', 'First = the earliest recorded elapsed execution point in either trace.'],
      timeout: ['Upłynął limit 10 s. Ponów porównanie.', 'The 10 s limit expired. Retry comparison.'],
      offline: ['Brak połączenia z Home Assistant.', 'No connection to Home Assistant.'],
      previous: ['Poprzednie punkty', 'Previous points'], next: ['Następne punkty', 'Next points']
    };
    return labels[key]?.[this._lang === 'pl' ? 0 : 1] || labels.unavailable[this._lang === 'pl' ? 0 : 1];
  }

  _comparisonIdentity(run) {
    return JSON.stringify([run.item_id, run.id]);
  }

  _invalidateComparison(clearSelection = false) {
    this._invalidateExport();
    this._comparisonEpoch++;
    this._comparisonController?.abort();
    this._comparisonController = null;
    this._comparisonPending = null;
    this._comparisonView = null;
    this._comparisonMessage = null;
    this._comparisonPage = 0;
    if (clearSelection) {
      this._comparisonSourceEpoch++;
      this._comparisonRuns.clear();
    }
  }

  _ensureComparisonLifecycle() {
    if (!this._comparisonOfflineHandler) {
      this._comparisonOfflineHandler = () => { this._comparisonOffline = true; this._invalidateComparison(true); this.render(); };
      this._comparisonOnlineHandler = () => { this._comparisonOffline = false; this._invalidateComparison(true); this.render(); };
      window.addEventListener('offline', this._comparisonOfflineHandler);
      window.addEventListener('online', this._comparisonOnlineHandler);
    }
    const connection = this._hass?.connection;
    if (connection === this._comparisonConnection) return;
    this._comparisonConnection?.removeEventListener?.('disconnected', this._comparisonDisconnectedHandler);
    this._comparisonConnection?.removeEventListener?.('ready', this._comparisonReadyHandler);
    this._comparisonConnection = connection;
    this._comparisonTransportOffline = connection?.connected === false;
    this._comparisonDisconnectedHandler = () => { this._comparisonTransportOffline = true; this._invalidateComparison(true); this.render(); };
    this._comparisonReadyHandler = () => { this._comparisonTransportOffline = false; this._invalidateComparison(true); this.render(); };
    connection?.addEventListener?.('disconnected', this._comparisonDisconnectedHandler);
    connection?.addEventListener?.('ready', this._comparisonReadyHandler);
  }

  _toggleComparisonRun(run) {
    if (!this._hass?.user?.is_admin || typeof run?.item_id !== 'string' || !run.item_id
      || typeof run?.id !== 'string' || !run.id || run.timestamp == null || !Number.isFinite(+run.timestamp)) return;
    const key = this._comparisonIdentity(run);
    if (this._comparisonRuns.has(key)) {
      this._invalidateComparison(); this._comparisonRuns.delete(key);
    } else if (this._comparisonRuns.size < 2) {
      this._invalidateComparison();
      this._comparisonRuns.set(key, { id: run.id, item_id: run.item_id,
        timestamp: new Date(+run.timestamp), automationName: String(run.automationName || run.item_id) });
    } else this._comparisonMessage = 'limit';
    this.render();
    const focus = Array.from(this.shadowRoot.querySelectorAll('[data-compare-run]'))
      .find(button => button.dataset.compareRun === key)
      || Array.from(this.shadowRoot.querySelectorAll('[data-remove-comparison]')).find(button => button.dataset.removeComparison === key)
      || this.shadowRoot.querySelector('[data-remove-comparison], [data-compare-run], .comparison-picker');
    focus?.focus({ preventScroll: true });
  }

  _orderedComparisonRuns() {
    return [...this._comparisonRuns.values()].sort((a, b) => +a.timestamp - +b.timestamp
      || (this._comparisonIdentity(a) < this._comparisonIdentity(b) ? -1 : 1));
  }

  async _loadComparisonRun(run, hass, signal) {
    const detail = this.traceDetail;
    const loaded = this._comparisonDetailSourceEpoch === this._comparisonSourceEpoch
      && detail?.trace && this._comparisonIdentity(detail.trace) === this._comparisonIdentity(run)
      && !detail.unavailable;
    const capability = loaded
      ? tvTraceContract.normalizeFull(detail.rawData, { expectedItemId: run.item_id })
      : await tvTraceContract.requestFull({ hass, itemId: run.item_id, runId: run.id, signal });
    // Analyzer validates item_id; the consuming card also checks the exact requested run_id.
    if (capability.status === 'available' && (capability.data.run_id !== run.id || capability.data.item_id !== run.item_id)) {
      return { status: 'malformed' };
    }
    return capability;
  }

  _compareSelectedRuns() {
    if (this._comparisonPending) return this._comparisonPending;
    const runs = this._orderedComparisonRuns();
    if (runs.length !== 2 || !this._hass?.user?.is_admin) return Promise.resolve();
    const failure = message => {
      this._comparisonView = { runs, result: { status: 'unavailable' }, message };
      this.render(); this.shadowRoot.querySelector('#comparisonHeading')?.focus({ preventScroll: true });
      return Promise.resolve();
    };
    if (runs[0].item_id !== runs[1].item_id) return failure('different');
    if (this._comparisonOffline || this._comparisonTransportOffline || this._hass.connection?.connected === false) return failure('offline');
    const epoch = this._comparisonEpoch, access = this._accessEpoch, hass = this._hass;
    const userId = hass.user.id, connection = hass.connection;
    const controller = new AbortController(); this._comparisonController = controller;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 10000);
    this._comparisonView = { runs, result: null }; this.render();
    this.shadowRoot.querySelector('#comparisonHeading')?.focus({ preventScroll: true });
    let pending;
    pending = (async () => {
      try {
        const capabilities = await Promise.all(runs.map(run => this._loadComparisonRun(run, hass, controller.signal)));
        if (epoch !== this._comparisonEpoch || access !== this._accessEpoch
          || this._hass?.connection !== connection || this._hass?.user?.id !== userId
          || !this._hass?.user?.is_admin || this._comparisonOffline || this._comparisonTransportOffline || this._hass?.connection?.connected === false) return;
        const failed = capabilities.find(capability => capability.status !== 'available');
        let result;
        if (timedOut) result = { status: 'unavailable' };
        else if (failed) result = { status: failed.status };
        else if (capabilities.some(capability => capability.data.kind !== 'execution' || !capability.data.nodes.length)) result = { status: 'no_data' };
        else {
          result = tvTraceContract.compare(capabilities[0].data, capabilities[1].data);
          if (result.status === 'available' && capabilities.some(capability => capability.data.run_state !== 'stopped'
            || capability.data.run_duration_ms === null)) result = { ...result, status: 'unconfirmed' };
        }
        // Retain normalized allowlisted data only. Raw trace/config/variables never enter comparison state/DOM.
        this._comparisonView = { runs, result, exportSource: { access, epoch, sourceEpoch: this._comparisonSourceEpoch, connection, userId }, message: timedOut ? 'timeout' : null,
          data: capabilities.every(capability => capability.status === 'available') ? capabilities.map(capability => capability.data) : null };
        const focused = this.shadowRoot.activeElement;
        const restoreFocus = focused && this.shadowRoot.querySelector('#traceComparison')?.contains(focused);
        this.render();
        if (restoreFocus) this.shadowRoot.querySelector('#comparisonHeading')?.focus({ preventScroll: true });
      } catch (_error) {
        if (epoch === this._comparisonEpoch && access === this._accessEpoch) {
          this._comparisonView = { runs, result: { status: 'unavailable' } }; this.render();
        }
      } finally {
        clearTimeout(timer);
        if (this._comparisonPending === pending) this._comparisonPending = null;
        if (this._comparisonController === controller) this._comparisonController = null;
      }
    })();
    this._comparisonPending = pending;
    return pending;
  }

  _comparisonPoints(view) {
    if (!view.result?.data || !view.data) return [];
    // Presentation ordering only: Analyzer remains the sole classifier.
    const recorded = new Map();
    for (const data of view.data) for (const node of data.nodes) {
      const key = JSON.stringify([node.path, node.ordinal]);
      recorded.set(key, Math.min(recorded.get(key) ?? Infinity, node.offset_ms));
    }
    return Object.entries(view.result.data.nodes).flatMap(([category, nodes]) => nodes.map(node => ({
      ...node, category, offset: recorded.get(JSON.stringify([node.path, node.ordinal]))
    }))).sort((a, b) => a.offset - b.offset || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0) || a.ordinal - b.ordinal);
  }

  _renderComparisonPicker() {
    const runs = this._orderedComparisonRuns();
    return `<section class="comparison-picker" tabindex="-1" aria-label="${this._comparisonText('compare')}">
      <div class="comparison-actions"><button type="button" id="compareRuns" class="comparison-button" ${runs.length !== 2 || !this._hass?.user?.is_admin ? 'disabled' : ''}>${this._comparisonText('compare')} (${runs.length}/2)</button>
      <span>${this._comparisonText('choose')}</span></div>
      ${this._comparisonMessage ? `<p role="status">${this._comparisonText(this._comparisonMessage)}</p>` : ''}
      <div class="comparison-records">${runs.map((run, index) => `<div class="comparison-record"><strong>${this._comparisonText(index === 0 ? 'baseline' : 'current')}</strong>
        <span>${_esc(run.automationName)}</span><span>${_esc(run.item_id)} / ${_esc(run.id)}</span><time>${_esc(this._fmtTime(run.timestamp))}</time>
        <button type="button" class="comparison-button" data-remove-comparison="${_esc(this._comparisonIdentity(run))}" aria-label="${this._comparisonText('remove')}: ${_esc(run.item_id)} / ${_esc(run.id)}">${this._comparisonText('remove')}</button></div>`).join('')}</div>
    </section>`;
  }

  _renderComparison() {
    const view = this._comparisonView;
    if (!view) return '';
    const result = view.result;
    const points = this._comparisonPoints(view);
    const first = points.find(point => point.category !== 'unchanged');
    const pages = Math.max(1, Math.ceil(points.length / 50));
    this._comparisonPage = Math.min(this._comparisonPage || 0, pages - 1);
    const shown = points.slice(this._comparisonPage * 50, (this._comparisonPage + 1) * 50);
    const records = view.runs.map((run, index) => `<div class="comparison-record"><strong>${this._comparisonText(index === 0 ? 'baseline' : 'current')}</strong>
      <span>${_esc(run.item_id)} / ${_esc(run.id)}</span><time>${_esc(this._fmtTime(run.timestamp))}</time></div>`).join('');
    const timing = result?.data?.run;
    return `<section id="traceComparison" class="trace-comparison" role="region" aria-labelledby="comparisonHeading">
      <div class="comparison-actions"><h3 id="comparisonHeading" tabindex="-1">${this._comparisonText(result?.status || 'loading')}</h3>
        ${this._comparisonExportable() ? `<button type="button" id="exportComparison" class="comparison-button">${this._lang === 'pl' ? 'Eksportuj porównanie' : 'Export comparison'}</button>` : ''}
        <button type="button" id="closeComparison" class="comparison-button">${this._comparisonText('close')}</button></div>
      <div class="comparison-records">${records}</div>
      <p role="status">${view.message ? this._comparisonText(view.message) : ''}</p>
      <p>${this._comparisonText('scope')}</p><p>${this._comparisonText('threshold')}</p><p>${this._comparisonText('order')}</p>
      ${timing ? `<p>${this._comparisonText('run')}: ${timing.delta_ms === null ? this._comparisonText('unknown') : `${this._comparisonText(timing.classification)} (${_esc(timing.delta_ms)} ms)`}</p>` : ''}
      ${result?.data ? `<div class="comparison-actions">${first ? `<button type="button" id="jumpComparisonDifference" class="comparison-button">${this._comparisonText('jump')}</button>` : `<p>${this._comparisonText('no_difference')}</p>`}</div>
        <p id="comparisonPageStatus" role="status" tabindex="-1">${this._lang === 'pl' ? 'Strona' : 'Page'} ${this._comparisonPage + 1} / ${pages} · ${points.length} ${this._lang === 'pl' ? 'zapisanych punktów' : 'recorded points'}</p>
        ${pages > 1 ? `<nav class="comparison-actions" aria-label="${this._lang === 'pl' ? 'Strony punktów porównania' : 'Comparison point pages'}"><button type="button" id="comparisonPrevious" class="comparison-button" ${this._comparisonPage === 0 ? 'disabled' : ''}>${this._comparisonText('previous')}</button><button type="button" id="comparisonNext" class="comparison-button" ${this._comparisonPage === pages - 1 ? 'disabled' : ''}>${this._comparisonText('next')}</button></nav>` : ''}
        <ul class="comparison-points">${shown.map(point => `<li ${point.path === first?.path && point.ordinal === first?.ordinal ? 'id="comparisonFirstDifference" tabindex="-1" class="comparison-first"' : ''}>
          ${point.path === first?.path && point.ordinal === first?.ordinal ? `<strong>${this._comparisonText('first')}: </strong>` : ''}<span>${_esc(point.path)} #${point.ordinal + 1}</span>
          <span>${this._comparisonText(point.category)}</span><span>${_esc(point.offset)} ms${Object.hasOwn(point, 'delta_ms') ? ` (Δ ${_esc(point.delta_ms)} ms)` : ''}</span></li>`).join('')}</ul>` : ''}
    </section>`;
  }

  _closeComparison() {
    this._invalidateComparison(); this.render();
    this.shadowRoot.querySelector('#compareRuns')?.focus({ preventScroll: true });
  }

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
          <button type="button" class="tgroup-h" data-group="${_esc(g.name)}" role="button" tabindex="0" aria-expanded="true" aria-label="${_esc((this._lang === 'pl' ? 'Grupa przebiegów: ' : 'Trace group: ') + g.name)}">
            <span class="tg-tog">\u25BC</span><span class="tg-name">${_esc(this.groupBy === 'result' ? this._traceStatusLabel(g.name) : this._sanitize(g.name))}</span>
            <span class="tg-cnt">${g.count}</span>
          </button>
          <div class="tgroup-items">${g.traces.map(t => this._renderTraceItem(t)).join('')}</div>
        </div>
      `).join('')}</div>`;
    }
        const ps = this.tracePageSize;
    const totalPages = Math.ceil(list.length / ps);
    if (this.tracePage >= totalPages) this.tracePage = Math.max(0, totalPages - 1);
    const pageList = list.slice(this.tracePage * ps, (this.tracePage + 1) * ps);
    const pag = totalPages > 1 ? `<div class="pag"><button class="pag-btn" data-pdir="-1" ${this.tracePage===0?'disabled':''} aria-label="${this._t('previousPage')}">‹ Prev</button><span class="pag-info">Page ${this.tracePage+1}/${totalPages} (${list.length} traces)</span><button class="pag-btn" data-pdir="1" ${this.tracePage>=totalPages-1?'disabled':''} aria-label="${this._t('nextPage')}">Next ›</button><select class="pag-size" id="pagSize" aria-label="${this._lang==='pl'?'Ślady na stronie':'Traces per page'}"><option value="15" ${ps===15?'selected':''}>15/page</option><option value="30" ${ps===30?'selected':''}>30/page</option><option value="50" ${ps===50?'selected':''}>50/page</option><option value="100" ${ps===100?'selected':''}>100/page</option></select></div>` : '';
    return statsHtml + pag + `<div class="list">${pageList.map(t => this._renderTraceItem(t)).join('')}</div>` + pag;
  }

  _renderTraceItem(t) {
    const sel = this.selectedTrace === t.id;
    const chk = this.selectedTraceIds.has(t.id);
    const showName = this.viewMode === 'all-traces' && this.groupBy !== 'automation';
    return `
      <div class="tr-item ${sel ? 'sel' : ''} ${chk ? 'chk' : ''} s-${t.status}" data-trace="${_esc(t.id)}">
        ${this.selectMode ? `<label class="family-check"><input type="checkbox" data-tcheck="${_esc(t.id)}" aria-label="${_esc(this._t('selectMode')+': '+(t.automationName||t.item_id||t.id))}" ${chk ? 'checked' : ''}></label>` : ''}
        <button type="button" class="comparison-toggle" data-compare-run="${_esc(this._comparisonIdentity(t))}" aria-pressed="${this._comparisonRuns.has(this._comparisonIdentity(t))}" aria-label="${this._comparisonText('select')}: ${_esc(t.item_id)} / ${_esc(t.id)}">${this._comparisonRuns.has(this._comparisonIdentity(t)) ? '☑' : '☐'}</button>
        <button type="button" class="family-row-action family-trace-action" data-trace-action="${_esc(t.id)}" role="button" tabindex="0" ${this.selectMode ? `aria-pressed="${chk}"` : ''} aria-label="${_esc((this._lang === 'pl' ? (this.selectMode ? 'Wybierz przebieg: ' : 'Otwórz przebieg: ') : (this.selectMode ? 'Select trace: ' : 'Open trace: ')) + (t.automationName || t.item_id || t.id) + ' · ' + this._fmtTimeShort(t.timestamp))}">
        <span class="tr-info">
          ${showName ? `<span class="tr-auto" style="display:block">${_esc(t.automationName)}</span>` : ''}
          <span class="tr-time" style="display:block" data-ts="${t.timestamp?.toISOString() || ''}">${this._fmtTimeShort(t.timestamp)} \u00B7 ${this._relTime(t.timestamp)}</span>
          ${this._traceResultHtml(t.status)}${t.status === 'running' || t.status === 'aborted' ? `<span class="tr-domain"> ${_esc(this._t(t.status))}</span>` : ''}
          <span class="tr-trig" style="display:block">${_esc(t.lastStep || t.scriptExecution || t.trigger)}</span>
        </span>
        <span class="tr-dur">${this._fmtDur(t.duration)}</span></button>
      </div>`;
  }

  // ============================================================

  _renderDetail() {
    if (!this.traceDetail) {
      if (this.selectedTrace) return `<div class="empty"><div class="spinner"></div><div>${this._t('loading')}</div></div>`;
      return `<div class="empty"><div class="empty-ico">\u261A</div><div>${this._t('clickTraceToView')}</div></div>`;
    }

    const { trace, steps, changedVars, rawData, configYaml, relatedEntities } = this.traceDetail;
    const tabs = ['timeline', 'related', 'changes', 'config', 'json'];
    const tabLabels = { timeline: this._t('timeline'), related: `${this._t('related')} (${relatedEntities.length})`,
      changes: `${this._t('changes')} (${changedVars.length})`, config: this._t('config'), json: this._t('json') };

    // Build only the active tab pane
    let activePane = '';
    switch (this.detailTab) {
      case 'timeline':
        activePane = steps.map((s, i) => `
          <div class="tl-step s-${s.status}">
            <div class="tl-head">
              <div class="tl-num" style="background:${s.category === 'trigger' ? 'var(--bento-primary, #3B82F6)' : s.category === 'condition' ? 'var(--bento-warning, #F59E0B)' : s.category === 'result' ? this._traceResultColor(s.status) : s.status === 'error' ? 'var(--bento-error, #EF4444)' : 'var(--bento-success, #10B981)'}">${s.icon}</div>
              <div class="tl-title">
                <span class="tl-cat">${_esc(s.category.toUpperCase())}</span>
                <span class="tl-desc">${_esc(s.description)}</span>
              </div>
              <span class="tl-dur">${s.duration > 0 ? this._fmtDur(s.duration) : ''}</span>

        </div>
            ${s.error ? `<div class="tl-err">\u26A0 ${_esc(typeof s.error === 'string' ? s.error : JSON.stringify(s.error))}</div>` : ''}
            ${Object.keys(s.details).length > 0 ? `<div class="tl-dets">${Object.entries(s.details).filter(([,v]) => v !== undefined && v !== null).map(([k, v]) =>
              `<span class="tl-det"><b>${_esc(k)}:</b> ${_esc(typeof v === 'object' ? JSON.stringify(v) : v)}</span>`
            ).join('')}</div>` : ''}
            ${s.timestamp ? `<div class="tl-ts">${this._fmtTimeShort(s.timestamp)}</div>` : ''}
          </div>
        `).join('');
        break;
      case 'related':
        activePane = relatedEntities.length === 0 ? `<div class="empty" style="height:auto;padding:24px">${this._t('noRelatedActivity')}</div>` :
          `<div class="rel-list">${relatedEntities.map(r => `
            <div class="rel-item">
              <div class="rel-entity">${_esc(r.friendlyName || r.entity)}</div>
              <div class="rel-action">${_esc(r.action)}</div>
              ${r.time ? `<div class="rel-time">${this._fmtTimeShort(r.time)}</div>` : ''}
            </div>
          `).join('')}</div>`;
        break;
      case 'changes':
        activePane = changedVars.length === 0 ? `<div class="empty" style="height:auto;padding:24px">${this._t('noChanges')}</div>` :
          changedVars.map(cv => `
            <div class="cv-item">
              <div class="cv-head"><span class="cv-step">${_esc(cv.step)}</span><span class="cv-name">${_esc(cv.variable)}</span></div>
              <pre class="cv-val">${this._safeJson(cv.value)}</pre>
            </div>
          `).join('');
        break;
      case 'config':
        activePane = `<div class="config-header">${this._t('automationConfig')}</div>
          <pre class="yaml-content">${this._escHtml(configYaml)}</pre>`;
        break;
      case 'json':
        activePane = `<div class="json-bar"><button class="btn-s" id="cpJson">\u{1F4CB} ${this._t('copyJson')}</button></div>
          <pre class="json-content">${this._safeJson(rawData)}</pre>`;
        break;
    }

    return `
      <!-- Header with status -->
      <div class="det-head">
        <div class="det-info">
          <div class="det-title">${_esc(trace.automationName || this._t('traceDetail'))}</div>
          <div class="det-time">${this._t('executedAt')} ${this._fmtTime(trace.timestamp)}</div>
        </div>
        <div class="det-badge">
          ${this._traceResultHtml(trace.status)}${trace.status === 'running' || trace.status === 'aborted' ? `<span> ${_esc(this._t(trace.status))}</span>` : ''}
          <span class="det-dur">${this._fmtDur(trace.duration)}</span>
        </div>
      </div>

      <!-- Flow graph -->
      <div class="det-flow">
        ${this._renderFlowGraph(steps)}
      </div>

      <!-- Tabs -->
      <div class="det-tabs">
        ${tabs.map(t => `<button class="dtab ${this.detailTab === t ? 'act' : ''}" data-dtab="${t}" role="tab" aria-selected="${!!(this.detailTab === t )}">${tabLabels[t]}</button>`).join('')}
      </div>

      <!-- Tab content -->
      <div class="det-body">
        ${this.traceDetail.unavailable ? `<div role="status">${_esc(this._t('unavailableDetail'))}</div>` : ''}
        <div class="tab-pane act" id="tp-${this.detailTab}">
          ${activePane}
        </div>
      </div>
    `;
  }

  // ============================================================

  render() {
    this._syncExportContext();
    if (!this._hass) return;
    const familyFocus=_rememberFamilyFocus(this), familyDrafts=_rememberFamilyDrafts(this);
    const familyRowFocus=_rememberFamilyRowFocus(this, [['[data-auto-action]','data-auto-action'],['[data-trace-action]','data-trace-action'],['.tgroup-h[data-group]','data-group'],['[data-autocheck]','data-autocheck'],['[data-tcheck]','data-tcheck'],['[data-compare-run]','data-compare-run']]);
    this._ensureComparisonLifecycle();
    if (!this._hass.user?.is_admin) {
      this._exportDialog?.cancel();
      const message = this._lang === 'pl'
        ? 'Ślady automatyzacji są dostępne tylko dla administratora Home Assistant.'
        : 'Automation traces are available only to a Home Assistant administrator.';
      this._cardSurface.innerHTML = `${this._css()}<div class="card"><div class="col-main"><div class="topbar"><span class="title">${_esc(this.config.title || this._t('traceViewer'))}</span></div><div role="status" style="padding:16px;color:var(--bento-text-secondary)">${message}</div></div></div>`;
      _bindFamilyNavigation(this);
      return;
    }
    const activeSearch = this.shadowRoot.activeElement;
    const searchSelection = activeSearch && ['autoSearch', 'trSearch'].includes(activeSearch.id)
      ? { id: activeSearch.id, start: activeSearch.selectionStart, end: activeSearch.selectionEnd,
          direction: activeSearch.selectionDirection }
      : null;
    const selN = this.selectedTraceIds.size;
    this._cardSurface.innerHTML = `${this._css()}
    <div class="card">
      <div class="col-main">
        ${this._loadingTraces || this._loadingSelected ? `<div role="status">${this._lang === 'pl' ? 'Wczytywanie śladów…' : 'Loading traces…'}</div>` : ''}
        ${this._traceListError ? `<div role="alert">${_esc(this._traceListError)} <button class="btn-s" data-retry="selected">${this._lang === 'pl' ? 'Ponów' : 'Retry'}</button></div>` : ''}
        ${this._fetchError ? `<div style="margin:0 0 10px;padding:10px 14px;background:var(--bento-error-light,rgba(239,68,68,0.08));color:var(--bento-error,#EF4444);border:1px solid var(--bento-error-border,rgba(239,68,68,0.25));border-radius:var(--bento-radius-sm,10px);font-size:13px;font-weight:500">⚠ ${_esc(this._fetchError)} <button class="btn-s" data-retry="all">${this._lang === 'pl' ? 'Ponów' : 'Retry'}</button></div>` : ''}
        <!-- TOP BAR -->
        <div class="topbar">
          <span class="title">${_esc(this.config.title || this._t('traceViewer'))}</span>
          <div class="topbar-r">
            <span class="trace-saved-badge" id="traceStorageInfo" title="${this._lang === 'pl' ? 'Zapisane ślady' : 'Saved traces'}" style="font-size:11px;color:var(--bento-text-secondary);padding:4px 8px;background:var(--bento-bg);border-radius:var(--radius-xs);border:1px solid var(--bento-border);display:inline-flex;align-items:center;gap:4px">\u{1F4BE} ${this._lang === 'pl' ? 'Zapisane: ' + this._getStoredTraceCount() : this._getStoredTraceCount() + ' saved'}</span><button type="button" class="trace-settings-btn" id="goToSettingsBtn" title="${this._lang === 'pl' ? 'Ustawienia Trace Viewer' : 'Trace Viewer Settings'}" style="font-size:11px;color:var(--bento-text-secondary);padding:4px 8px;background:var(--bento-bg);border-radius:var(--radius-xs);border:1px solid var(--bento-border);cursor:pointer;display:inline-flex;align-items:center;gap:4px;margin-left:6px">\u2699\uFE0F ${this._lang === 'pl' ? 'Ustawienia' : 'Settings'}</button>
            <div class="dd" id="expDD">
              <button class="btn-s" id="expBtn" ${!this._exportRows('all').length && this.selectedAutoIds.size === 0 ? 'disabled' : ''}>${this._t('export')} \u25BE</button>
              <div class="dd-menu">
                <div style="padding:8px;font-size:11px">${this._lang === 'pl' ? 'Podgląd przed zapisem. Pola prywatne domyślnie wyłączone.' : 'Preview before saving. Private fields off by default.'}</div>
                ${this._exportRows('all').length ? `<button type="button" class="dd-i" data-exp="all-json">JSON (${this._lang === 'pl' ? 'wszystkie w bieżącym zakresie' : 'all in current scope'})</button><button type="button" class="dd-i" data-exp="all-csv">CSV (${this._lang === 'pl' ? 'wszystkie w bieżącym zakresie' : 'all in current scope'})</button><div class="dd-div"></div>` : ''}
                ${selN > 0 ? `<button type="button" class="dd-i" data-exp="sel-json">JSON (${selN} traces ${this._t('selected')})</button><button type="button" class="dd-i" data-exp="sel-csv">CSV (${selN} traces ${this._t('selected')})</button><div class="dd-div"></div>` : ''}
                ${this.selectedAutoIds.size > 0 ? `<button type="button" class="dd-i" data-exp="auto-json">JSON (${this.selectedAutoIds.size} ${this._t('automations')})</button><button type="button" class="dd-i" data-exp="auto-csv">CSV (${this.selectedAutoIds.size} ${this._t('automations')})</button><div class="dd-div"></div>` : ''}
                
              </div>
            </div>
          </div>
        </div>

        ${this._showSettings ? `<section role="region" aria-label="${this._lang === 'pl' ? 'Ustawienia Trace Viewer' : 'Trace Viewer settings'}" style="padding:12px;border:1px solid var(--bento-border);border-radius:10px">
          <p>${this._lang === 'pl' ? 'Historia jest przechowywana w tej przeglądarce i na tym urządzeniu: do 2000 śladów oraz 200 otwartych szczegółów. Czyszczenie danych przeglądarki usuwa historię. Eksportuj potrzebne ślady wcześniej.' : 'History is stored in this browser on this device: up to 2000 traces and 200 opened details. Clearing browser data removes this history. Export important traces first.'}</p>
          <label>${this._lang === 'pl' ? 'Ślady na stronie' : 'Traces per page'} <select id="settingsPageSize">${[15,30,50,100].map(n => `<option value="${n}" ${this.tracePageSize === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <p>${this._lang === 'pl' ? 'Aby zwiększyć liczbę śladów po stronie Home Assistant, ustaw trace.stored_traces w konfiguracji automatyzacji. Ta karta nie zmienia automatyzacji.' : 'To retain more traces in Home Assistant, set trace.stored_traces in the automation configuration. This card does not change your automations.'}</p>
          <button class="btn-s" id="closeTraceSettings">${this._lang === 'pl' ? 'Zamknij' : 'Close'}</button>
        </section>` : ''}
        <!-- CONTROLS -->
        <div class="cbar">
          <div class="cg"><label>${this._t('viewMode')}</label><select id="viewSel" aria-label="${this._t('viewMode')}">
            <option value="automations" ${this.viewMode === 'automations' ? 'selected' : ''}>${this._t('byAutomation')}</option>
            <option value="all-traces" ${this.viewMode === 'all-traces' ? 'selected' : ''}>${this._t('flatList')}</option>
          </select></div>
          ${this.viewMode === 'all-traces' ? `<div class="cg"><label>${this._t('groupBy')}</label><select id="grpSel" aria-label="${this._t('groupBy')}">
            <option value="none" ${this.groupBy === 'none' ? 'selected' : ''}>${this._lang === 'pl' ? 'Bez grupowania' : 'No grouping'}</option>
            <option value="automation" ${this.groupBy === 'automation' ? 'selected' : ''}>${this._t('groupAutomation')}</option>
            <option value="result" ${this.groupBy === 'result' ? 'selected' : ''}>${this._t('groupResult')}</option>
            <option value="trigger" ${this.groupBy === 'trigger' ? 'selected' : ''}>${this._t('groupTrigger')}</option>
          </select></div>` : ''}
          <div class="cg"><label>${this._t('timeRange')}</label>
            <select id="timeSel" aria-label="${this._t('timeRange')}">${['all','1h','6h','24h','7d','30d','custom'].map(v =>
              `<option value="${v}" ${this.timeRange === v ? 'selected' : ''}>${this._t('time' + v.charAt(0).toUpperCase() + v.slice(1))}</option>`
            ).join('')}</select>
          </div>
          ${this.timeRange === 'custom' ? `<div class="cg"><input type="datetime-local" id="cfrom" aria-label="${this._lang==='pl'?'Od':'From'}" value="${this.customTimeFrom || ''}" /><span>\u2192</span><input type="datetime-local" id="cto" aria-label="${this._lang==='pl'?'Do':'To'}" value="${this.customTimeTo || ''}" /></div>` : ''}
          <div class="cg"><label>${this._t('filterByStatus')}</label><select id="resSel" aria-label="${this._t('filterByStatus')}">
            ${this._traceResultOptions()}
          </select></div>
          <div class="cg cg-r">
            <button class="btn-s ${this.selectMode ? 'btn-act' : ''}" id="selBtn">\u2611 ${this.selectMode ? this._t('cancel') : this._t('selectMode')}</button>
            ${this.selectMode ? `
              <span style="font-size:12px;color:var(--bento-text-secondary);font-weight:500">${this.selectedAutoIds.size}A + ${this.selectedTraceIds.size}T</span>
            ` : ''}
          </div>
        </div>

        <!-- PANELS -->
        <div class="panels">
          ${this.viewMode === 'automations' ? `
          <div class="pan-left">
            <div class="pan-head"><span class="pan-title">${this._t('automations')} (${this.automations.length})</span></div>
            <div class="search-box"><input type="text" class="sinput" id="autoSearch" aria-label="${this._t('search')}" placeholder="${this._t('search')}" value="${this._escHtml(this.searchQuery)}" /></div>
            <div class="ctrls">
              <div class="crow"><span class="clbl">${this._t('sortBy')}</span><select class="csel" id="sortSel" aria-label="${this._t('sortBy')}">
                <option value="last_triggered" ${this.sortBy === 'last_triggered' ? 'selected' : ''}>${this._t('sortLastTriggered')}</option>
                <option value="name" ${this.sortBy === 'name' ? 'selected' : ''}>${this._t('sortName')}</option>
                <option value="trigger_count" ${this.sortBy === 'trigger_count' ? 'selected' : ''}>${this._t('sortTriggerCount')}</option>
              </select></div>
              <div class="crow"><span class="clbl">${this._t('filterByStatus')}</span><select class="csel" id="fltSel" aria-label="${this._t('filterByStatus')}">
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
              ${this.viewMode === 'all-traces' ? `<input type="text" class="sinput-sm" id="trSearch" aria-label="${this._t('searchTraces')}" placeholder="${this._t('searchTraces')}" value="${this._escHtml(this.searchQuery)}" />` : ''}
            </div>
            ${this._renderComparisonPicker()}
            ${this._renderTracesList()}
          </div>

          <div class="pan-right">
            ${this._renderDetail()}
          </div>
        </div>
        ${this._renderComparison()}
        ${this._hass?.user?.is_admin && this.config?.show_support !== false && !this._supportDismissed() ? `<div class="donate-section" data-source="own-card" style="margin:8px 0 0;padding:4px 0;background:none;border:0;box-shadow:none;min-height:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex-direction:row;justify-content:flex-start;text-align:left"><a href="https://buymeacoffee.com/macsiem" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:var(--secondary-text-color,#64748b);font-weight:400;text-decoration:underline">${this._lang === 'pl' ? 'Dobrowolne wsparcie HA Tools' : 'Optional support for HA Tools'}</a><button type="button" class="support-dismiss" aria-label="${this._lang === 'pl' ? 'Ukryj link wsparcia' : 'Dismiss support link'}" style="margin-left:auto;padding:2px 6px;min-height:0;line-height:1;border:0;background:none;color:var(--secondary-text-color,#64748b);cursor:pointer">×</button></div>` : ''}
      </div>
    </div>`;
    this._bindEvents();
    _restoreFamilyDrafts(this,familyDrafts);
    _bindFamilyNavigation(this,familyFocus);
    _restoreFamilyRowFocus(this,familyRowFocus);
    // Apply compact classes immediately after render based on current width
    this._applyCompactClasses();
    if (searchSelection) {
      const input = this.shadowRoot.getElementById(searchSelection.id);
      input?.focus({ preventScroll: true });
      input?.setSelectionRange(searchSelection.start, searchSelection.end, searchSelection.direction);
    }
  }

  _applyCompactClasses() {
    const w = this.offsetWidth || this.clientWidth || 0;
    const card = this.shadowRoot?.querySelector('.card');
    if (!card || !w) return;
    card.classList.toggle('compact-mobile', w < 768);
    card.classList.toggle('compact-xs', w < 480);
    card.classList.toggle('compact-hide-right', w < 1200);
    card.classList.toggle('compact-hide-left', w < 900);
  }

  // ============================================================

  _supportDismissed() {
    try { return localStorage.getItem('ha-trace-viewer-support-dismissed') === '1'; } catch (_) { return false; }
  }

  _bindEvents() {
    this.shadowRoot.querySelector('.support-dismiss')?.addEventListener('click', () => {
      try { localStorage.setItem('ha-trace-viewer-support-dismissed', '1'); } catch (_) {}
      this.shadowRoot.querySelector('.donate-section[data-source="own-card"]')?.remove();
    });
    const $ = s => this.shadowRoot.querySelector(s);
    const $$ = s => this.shadowRoot.querySelectorAll(s);

    $('#exportComparison')?.addEventListener('click', () => this._exportComparison());
    $('#compareRuns')?.addEventListener('click', () => this._compareSelectedRuns());
    $$('[data-compare-run]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      const run = [...this.traces, ...this._allFlatTraces].find(run => this._comparisonIdentity(run) === button.dataset.compareRun);
      if (run) this._toggleComparisonRun(run);
    }));
    $$('[data-remove-comparison]').forEach(button => button.addEventListener('click', () => {
      const run = this._comparisonRuns.get(button.dataset.removeComparison);
      if (run) this._toggleComparisonRun(run);
    }));
    $('#closeComparison')?.addEventListener('click', () => this._closeComparison());
    $('#traceComparison')?.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this._closeComparison(); }
    });
    $('#jumpComparisonDifference')?.addEventListener('click', () => {
      const points = this._comparisonPoints(this._comparisonView);
      const index = points.findIndex(point => point.category !== 'unchanged');
      if (index < 0) return;
      const page = Math.floor(index / 50);
      if (page !== this._comparisonPage) { this._comparisonPage = page; this.render(); }
      const first = $('#comparisonFirstDifference'); first?.focus({ preventScroll: true });
      first?.scrollIntoView?.({ block: 'nearest' });
    });
    for (const [id, offset] of [['comparisonPrevious', -1], ['comparisonNext', 1]]) $('#'+id)?.addEventListener('click', () => {
      const pages = Math.max(1, Math.ceil(this._comparisonPoints(this._comparisonView).length / 50));
      this._comparisonPage = Math.max(0, Math.min(pages - 1, this._comparisonPage + offset)); this.render();
      const focus = $('#'+id); (focus && !focus.disabled ? focus : $('#comparisonPageStatus'))?.focus({ preventScroll: true });
    });

    // Trace storage info badge -- navigate to panel Settings >
    $('#traceStorageInfo')?.addEventListener('click', () => {
      // Shadow DOM: this element lives inside ha-tools-panel's shadowRoot
      // closest() can't cross shadow boundaries, use getRootNode().host instead
      let panel = null;
      try {
        const root = this.getRootNode();
        if (root && root.host && root.host.tagName === 'HA-TOOLS-PANEL') {
          panel = root.host;
        }
      } catch (e) { console.debug('[ha-trace-viewer] caught:', e); }
      if (!panel) panel = document.querySelector('ha-tools-panel');
      if (panel && panel._navigateToSettings) {
        panel._navigateToSettings('trace-backend');
      } else {
        this._showSettings = !this._showSettings; this.render();
      }
    });

    // Settings info bar button
    $('#goToSettingsBtn')?.addEventListener('click', () => {
      let panel = null;
      try {
        const root = this.getRootNode();
        if (root && root.host && root.host.tagName === 'HA-TOOLS-PANEL') panel = root.host;
      } catch (e) { console.debug('[ha-trace-viewer] caught:', e); }
      if (!panel) panel = document.querySelector('ha-tools-panel');
      if (panel && panel._navigateToSettings) {
        panel._navigateToSettings('trace-backend');
      } else {
        this._showSettings = !this._showSettings; this.render();
      }
    });

    $('#settingsPageSize')?.addEventListener('change', e => { this.tracePageSize = Number(e.target.value); this.tracePage = 0; this._savePageSize(this.tracePageSize); this.render(); });
    $('#closeTraceSettings')?.addEventListener('click', () => { this._showSettings = false; this.render(); $('#goToSettingsBtn')?.focus(); });
    // Export dropdown
    const closeExportMenu = () => {
      $('#expDD')?.classList.remove('open');
      if (this._expDDClose) document.removeEventListener('click', this._expDDClose);
      this._expDDClose = null;
    };
    $('#expBtn')?.addEventListener('click', e => {
      e.stopPropagation();
      const dd = $('#expDD'), open = !dd.classList.contains('open');
      closeExportMenu();
      if (!open) return;
      dd.classList.add('open');
      this._expDDClose = closeExportMenu;
      document.addEventListener('click', closeExportMenu);
    });
    $('#expDD')?.addEventListener('click', e => e.stopPropagation());
    $('#expDD')?.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); closeExportMenu(); $('#expBtn')?.focus(); }
    });
    $$('[data-retry]').forEach(el => el.addEventListener('click', () => el.dataset.retry === 'all' ? this.updateAutomationData() : this._loadTraces(this.selectedAutomation)));
    $$('.dd-i[data-exp]').forEach(el => el.addEventListener('click', () => {
      const a = el.dataset.exp;
      if (a === 'all-json') this._export('json', false);
      else if (a === 'all-csv') this._export('csv', false);
      else if (a === 'sel-json') this._export('json', true);
      else if (a === 'sel-csv') this._export('csv', true);
      else if (a === 'auto-json') this._exportMultiAuto('json');
      else if (a === 'auto-csv') this._exportMultiAuto('csv');
      closeExportMenu();
    }));

    // Controls
    $('#viewSel')?.addEventListener('change', e => { this.viewMode = e.target.value; this.searchQuery = ''; this._detailLoadToken = null; this._traceLoadToken = null; this._loadingSelected = false; this._traceListError = null; this.selectedAutomation = null; this.selectedTrace = null; this.traceDetail = null; this.selectedTraceIds.clear(); this.selectMode = false;
    this.tracePage = 0; this.autoPage = 0;
    this.tracePageSize = this._loadPageSize(); this.applyFiltersAndSort(); this._saveCurrentSettings(); this.render(); });
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

    // Keep native label activation from also opening/toggling its containing row.
    $$('.family-check').forEach(label=>label.addEventListener('click',e=>e.stopPropagation()));
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
      el.querySelector('.family-row-action')?.focus({preventScroll:true});
      if (this.selectMode) {
        const entity = el.dataset.auto;
        this.selectedAutoIds.has(entity) ? this.selectedAutoIds.delete(entity) : this.selectedAutoIds.add(entity);
        this.render();
      } else {
        this.onAutoClick(el.dataset.auto);
      }
    }));
    $$('.tr-item[data-trace]').forEach(el => el.addEventListener('click', () => {
      el.querySelector('.family-row-action')?.focus({preventScroll:true});
      this.onTraceClick(el.dataset.trace);
    }));
    $$('[data-tcheck]').forEach(el => el.addEventListener('click', e => {
      e.stopPropagation(); const id = el.dataset.tcheck;
      this.selectedTraceIds.has(id) ? this.selectedTraceIds.delete(id) : this.selectedTraceIds.add(id); this.render();
    }));
    $$('.tgroup-h').forEach(h => h.addEventListener('click', () => {
      const collapsed=h.parentElement.classList.toggle('collapsed');
      h.setAttribute('aria-expanded',String(!collapsed));
    }));
    _bindFamilyRowKeys(this.shadowRoot, '.family-row-action,.tgroup-h');

    // Detail tabs
    $$('.dtab').forEach(tab => tab.addEventListener('click', () => {
      this.detailTab = tab.dataset.dtab;
      this.render();
      const nav=this.shadowRoot.querySelector('.det-tabs');
      (nav?.hidden ? this.shadowRoot.getElementById('ha-tools-tab-picker') : this.shadowRoot.querySelector(`[data-dtab="${this.detailTab}"]`))?.focus({ preventScroll:true });
    }));

    // Copy JSON
    $('#cpJson')?.addEventListener('click', () => {
      const txt = this.traceDetail?.rawData ? JSON.stringify(this.traceDetail.rawData, null, 2) : '';
      navigator.clipboard?.writeText(txt).then(() => {
        const b = $('#cpJson'); if (b) { b.textContent = `\u2714 ${this._t('copied')}`; setTimeout(() => b.textContent = `\u{1F4CB} ${this._t('copyJson')}`, 1500); }
      });
    });
  }

  // ============================================================

  _css() {
    return `<style>${haToolsBentoCSS}
${createUiV3({ language: this._lang }).css}

.comparison-picker, .trace-comparison { container-type: inline-size; min-width: 0; max-width: 100%; padding: 12px; box-sizing: border-box; }
.trace-comparison { border: 1px solid var(--bento-border); border-radius: 12px; margin-top: 12px; background: var(--bento-card); }
.comparison-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.comparison-actions > * { min-width: 0; overflow-wrap: anywhere; }
.comparison-button, .comparison-toggle { min-width: 44px; min-height: 44px; padding: 8px 12px; border: 1px solid var(--bento-border); border-radius: 8px; background: var(--bento-bg-2); color: var(--bento-text); cursor: pointer; font: inherit; white-space: normal; overflow-wrap: anywhere; }
.comparison-button:disabled { cursor: default; opacity: .55; }
.comparison-toggle { flex: 0 0 44px; padding: 8px; }
.comparison-toggle[aria-pressed="true"] { border-color: var(--bento-primary); background: var(--bento-primary-light); }
.comparison-records { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 8px 0; }
.comparison-record { display: flex; flex-direction: column; gap: 4px; min-width: 0; padding: 8px; border: 1px solid var(--bento-border); border-radius: 8px; overflow-wrap: anywhere; }
.comparison-points { padding: 0; margin: 8px 0; list-style: none; }
.comparison-points li { display: flex; gap: 8px; flex-wrap: wrap; padding: 12px; overflow-wrap: anywhere; }
.comparison-first { border: 2px solid var(--bento-primary); border-radius: 8px; background: var(--bento-primary-light); }
@container (max-width: 500px) { .comparison-records { grid-template-columns: minmax(0, 1fr); } .comparison-points li { flex-direction: column; } }
/* === HA Tools split — premium banners (donate / intro / prereq) === */

/* Donation footer — diamond top */
.donate-section {  margin: 24px 0 4px; padding: 20px 24px; position: relative; overflow: hidden;  background: linear-gradient(135deg, rgba(99,102,241,0.06), rgba(236,72,153,0.06));  border: 1px solid rgba(99,102,241,0.18); border-radius: var(--bento-radius-md, 18px);  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px;  font-family: 'Inter', -apple-system, sans-serif;}
.donate-section:not([data-source="own-card"])::before {  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;  background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);}
.donate-section .donate-text { flex: 1; min-width: 240px; }
.donate-section h3 {  margin: 0 0 6px; font-size: 16px; font-weight: 700; letter-spacing: -0.02em;  background: linear-gradient(135deg, #6366f1, #ec4899);  -webkit-background-clip: text; background-clip: text; color: transparent;}
.donate-section p { margin: 0; font-size: 13px; line-height: 1.55; color: var(--bento-text-secondary, #57534e); letter-spacing: -0.005em; }
.donate-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
.donate-btn {  display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px;  border-radius: 12px; font-weight: 700; font-size: 13px; letter-spacing: -0.005em;  text-decoration: none; transition: transform 0.2s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s, filter 0.2s;  border: 1px solid transparent;}
.donate-btn:hover { transform: translateY(-2px); filter: brightness(1.05); }
.donate-btn.coffee {  background: linear-gradient(135deg, #FFDD00, #FFC700); color: #000;  box-shadow: 0 4px 14px -2px rgba(255, 221, 0, 0.4);}
.donate-btn.coffee:hover { box-shadow: 0 8px 24px -4px rgba(255, 221, 0, 0.55); }
.donate-btn.paypal {  background: linear-gradient(135deg, #0070ba, #005ea6); color: #fff;  box-shadow: 0 4px 14px -2px rgba(0, 112, 186, 0.45);}
.donate-btn.paypal:hover { box-shadow: 0 8px 24px -4px rgba(0, 112, 186, 0.6); }
:host(.bento-dark) .donate-section { background: linear-gradient(135deg, rgba(129,140,248,0.10), rgba(244,114,182,0.10)); border-color: rgba(129,140,248,0.25); }
:host(.bento-dark) .donate-section h3 { background: linear-gradient(135deg, #a5b4fc, #f9a8d4); -webkit-background-clip: text; background-clip: text; color: transparent; }
:host(.bento-dark) .donate-section p { color: #d6d3d1; }
@media (max-width: 600px) {  .donate-section { flex-direction: column; text-align: center; padding: 18px; }  .donate-buttons { justify-content: center; width: 100%; } }

/* Prereq banner — premium */
.prereq-banner {  display: flex; align-items: flex-start; gap: 14px; padding: 16px 20px;  border-radius: var(--bento-radius-sm, 12px); margin: 0 0 16px;  font-size: 13px; line-height: 1.55; border: 1px solid;  font-family: 'Inter', sans-serif; letter-spacing: -0.005em;  position: relative; overflow: hidden;}
.prereq-banner::before {  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;}
.prereq-banner.prereq-error { background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.25); color: #991b1b; }
.prereq-banner.prereq-error::before { background: linear-gradient(180deg, #ef4444, #f87171); }
.prereq-banner.prereq-info  { background: rgba(99,102,241,0.06); border-color: rgba(99,102,241,0.25); color: #4338ca; }
.prereq-banner.prereq-info::before  { background: linear-gradient(180deg, #6366f1, #8b5cf6); }
.prereq-banner .prereq-icon { font-size: 22px; line-height: 1; padding-top: 2px; flex-shrink: 0; }
.prereq-banner .prereq-text { flex: 1; min-width: 0; }
.prereq-banner .prereq-text strong { font-weight: 700; letter-spacing: -0.01em; }
.prereq-banner code {  background: rgba(0,0,0,0.06); padding: 1px 7px; border-radius: 5px;  font-size: 12px; font-family: 'JetBrains Mono', ui-monospace, monospace;  border: 1px solid rgba(0,0,0,0.08);}
.prereq-banner .prereq-cta {  display: inline-flex; align-items: center; padding: 8px 16px; border-radius: 10px;  background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff !important;  text-decoration: none; font-weight: 700; font-size: 12.5px; flex-shrink: 0;  letter-spacing: -0.005em;  box-shadow: 0 4px 14px -2px rgba(99,102,241,0.45);  transition: all 0.2s cubic-bezier(0.4,0,0.2,1);}
.prereq-banner .prereq-cta:hover { transform: translateY(-1px); box-shadow: 0 8px 24px -4px rgba(99,102,241,0.6); }
:host(.bento-dark) .prereq-banner.prereq-error { background: rgba(248,113,113,0.10); border-color: rgba(248,113,113,0.30); color: #fca5a5; }
:host(.bento-dark) .prereq-banner.prereq-info { background: rgba(129,140,248,0.10); border-color: rgba(129,140,248,0.30); color: #c7d2fe; }
:host(.bento-dark) .prereq-banner code { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.10); }
@media (max-width: 600px) {  .prereq-banner { flex-direction: column; align-items: stretch; padding-left: 20px; }  .prereq-banner .prereq-cta { align-self: flex-start; } }

/* First-run intro banner — premium */
.intro-banner {  position: relative; padding: 18px 52px 18px 22px; margin: 0 0 18px;  background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(236,72,153,0.06));  border: 1px solid rgba(99,102,241,0.20);  border-radius: var(--bento-radius-sm, 12px);  font-size: 13px; line-height: 1.55; overflow: hidden;  font-family: 'Inter', sans-serif; letter-spacing: -0.005em;  animation: bentoSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);}
.intro-banner::before {  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;  background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);}
.intro-banner .intro-headline {  font-weight: 700; font-size: 14.5px; margin-bottom: 10px; letter-spacing: -0.02em;  background: linear-gradient(135deg, #6366f1, #ec4899);  -webkit-background-clip: text; background-clip: text; color: transparent;  display: flex; align-items: center; gap: 8px;}
.intro-banner .intro-steps {  margin: 8px 0 0; padding: 0; list-style: none; counter-reset: introstep;}
.intro-banner .intro-steps li {  margin-bottom: 8px; line-height: 1.55; color: var(--bento-text, #0c0a09);  padding-left: 32px; position: relative; counter-increment: introstep;  font-size: 12.5px;}
.intro-banner .intro-steps li::before {  content: counter(introstep); position: absolute; left: 0; top: -1px;  width: 22px; height: 22px; border-radius: 50%;  background: var(--bento-card, #fff); border: 1px solid rgba(99,102,241,0.25);  display: flex; align-items: center; justify-content: center;  font-size: 11px; font-weight: 800; color: #6366f1;  font-family: 'JetBrains Mono', ui-monospace, monospace;  font-feature-settings: 'tnum' 1;}
.intro-banner .intro-dismiss {  position: absolute; top: 12px; right: 14px;  background: var(--bento-card, transparent); border: 1px solid var(--bento-border, transparent);  cursor: pointer; font-size: 14px; line-height: 1;  color: var(--bento-text-secondary, #64748B);  padding: 4px 8px; border-radius: 999px;  transition: all 0.15s ease;}
.intro-banner .intro-dismiss:hover {  background: var(--bento-bg-2, #e7e5e4); color: var(--bento-text, #0c0a09);  transform: rotate(90deg);}
:host(.bento-dark) .intro-banner { background: linear-gradient(135deg, rgba(129,140,248,0.14), rgba(244,114,182,0.10)); border-color: rgba(129,140,248,0.30); }
:host(.bento-dark) .intro-banner .intro-headline { background: linear-gradient(135deg, #a5b4fc, #f9a8d4); -webkit-background-clip: text; background-clip: text; color: transparent; }
:host(.bento-dark) .intro-banner .intro-steps li { color: #fafaf9; }
:host(.bento-dark) .intro-banner .intro-steps li::before { background: #16161f; border-color: rgba(129,140,248,0.35); color: #a5b4fc; }
:host(.bento-dark) .intro-banner .intro-dismiss { background: #16161f; border-color: #27272f; color: #d6d3d1; }
:host(.bento-dark) .intro-banner .intro-dismiss:hover { background: #27272f; color: #fafaf9; }



/* ===== BENTO DESIGN SYSTEM (local fallback) ===== */

:host {
  --bento-primary: #3B82F6;
  --bento-primary-hover: #2563EB;
  --bento-primary-light: rgba(59, 130, 246, 0.08);
  --bento-success: #10B981;
  --bento-success-light: rgba(16, 185, 129, 0.08);
  --bento-error: #EF4444;
  --bento-error-light: rgba(239, 68, 68, 0.08);
  --bento-warning: #F59E0B;
  --bento-warning-light: rgba(245, 158, 11, 0.08);
  --bento-bg: var(--primary-background-color, #F8FAFC);
  --bento-card: var(--card-background-color, #FFFFFF);
  --bento-border: var(--divider-color, #E2E8F0);
  --bento-text: var(--primary-text-color, #1E293B);
  --bento-text-secondary: var(--secondary-text-color, #64748B);
  --bento-text-muted: var(--disabled-text-color, #94A3B8);
  --bento-radius-xs: 6px;
  --bento-radius-sm: 10px;
  --bento-radius-md: 16px;
  --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
  --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04);
  --bento-shadow-lg: 0 8px 25px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.04);
  --bento-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

:host {
  --pc: var(--bento-primary);
  --ec: var(--bento-error);
  --wc: var(--bento-warning);
  --sc: var(--bento-success);
  --bg: var(--bento-bg);
  --cbg: var(--bento-card);
  --tc: var(--bento-text);
  --ts: var(--bento-text-secondary);
  --dc: var(--bento-border);
  --hov: rgba(59, 130, 246, 0.04);
  --sel: rgba(59, 130, 246, 0.08);
  --radius: var(--bento-radius-md);
  --radius-sm: var(--bento-radius-sm);
  --radius-xs: var(--bento-radius-xs);
  --shadow: var(--bento-shadow-sm);
  --shadow-md: var(--bento-shadow-md);
  --tr: var(--bento-transition);
  display: block;
  color-scheme: light dark;
}
* { box-sizing: border-box; margin: 0; padding: 0; }

.card {
  display: flex; height: 100%; background: var(--bento-card); color: var(--bento-text); container-type: inline-size;
  border-radius: var(--radius); overflow: visible;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  border: 1px solid var(--bento-border); box-shadow: var(--shadow);
}
.col-main { display: flex; flex-direction: column; flex: 1; overflow: hidden; color: var(--bento-text); font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

/* Top bar */
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-bottom: 1px solid var(--bento-border); background: var(--bento-card);
  border-radius: var(--radius) var(--radius) 0 0;
}
.title { font-size: 20px; font-weight: 700; color: var(--bento-text); letter-spacing: -0.01em; }
.topbar-r { display: flex; gap: 8px; align-items: center; }
.btn-s {
  padding: 9px 16px; border: 1.5px solid var(--bento-border); border-radius: var(--radius-sm);
  background: var(--bento-card); color: var(--bento-text); cursor: pointer; font-size: 13px;
  font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--tr); white-space: nowrap;
}
.btn-s:hover { background: var(--bento-bg); border-color: var(--bento-primary); color: var(--bento-primary); }
.btn-act {
  background: var(--bento-primary) !important; color: white !important; border-color: var(--bento-primary) !important;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25) !important;
}

/* Dropdown */
.dd { position: relative; display: inline-block; }
.dd-menu {
  display: none; position: absolute; right: 0; top: 100%; margin-top: 4px;
  background: var(--bento-card); border: 1px solid var(--bento-border); border-radius: var(--radius-sm);
  min-width: 180px; z-index: 100; box-shadow: var(--shadow-md); overflow: hidden;
}
.dd.open .dd-menu { display: block; }
.dd-i {
  padding: 10px 16px; cursor: pointer; font-size: 13px; color: var(--bento-text);
  transition: var(--tr); font-family: 'Inter', sans-serif;
}
.dd-i:hover { background: rgba(59, 130, 246, 0.06); color: var(--bento-primary); }
.dd-div { border-top: 1px solid var(--bento-border); margin: 4px 0; }

/* Controls bar */
.cbar {
  display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px;
  border-bottom: 1px solid var(--bento-border); background: var(--bento-bg); align-items: center;
}
.cg { display: inline-flex; gap: 6px; align-items: center; font-size: 12px; flex-shrink: 0; }
.cg label {
  display: block; font-size: 12px; font-weight: 600; color: var(--bento-text-secondary);
  text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap;
}
.cg select, .cg input {
  width: auto; padding: 6px 10px; border: 1.5px solid var(--bento-border); border-radius: var(--radius-xs);
  background: var(--bento-card); color: var(--bento-text); font-size: 13px;
  font-family: 'Inter', sans-serif; transition: var(--tr); outline: none;
}
.cg select:focus, .cg input:focus { border-color: var(--bento-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.cg-r { margin-left: auto; }

/* Stats */
.stats {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px; padding: 12px 16px; background: var(--bento-bg); border-bottom: 1px solid var(--bento-border);
}
.stat {
  display: flex; flex-direction: column; align-items: center; padding: 12px;
  background: var(--bento-card); border-radius: var(--radius-sm); border: 1px solid var(--bento-border);
  transition: var(--tr); text-align: center;
}
.stat:hover { border-color: var(--bento-primary); box-shadow: var(--shadow-md); transform: translateY(-1px); }
.sv { font-size: 24px; font-weight: 700; color: var(--bento-primary); line-height: 1.2; }
.sl { font-size: 12px; color: var(--bento-text-secondary); font-weight: 500; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
.stat.ok .sv { color: var(--bento-success); }
.stat.err .sv { color: var(--bento-error); }

/* Panels */
.panels { display: flex; flex: 1; overflow: hidden; }
.pan-left {
  width: 280px; min-width: 240px; display: flex; flex-direction: column;
  border-right: 1px solid var(--bento-border); background: var(--bento-card);
}
.pan-center {
  flex: 1; min-width: 280px; display: flex; flex-direction: column;
  border-right: 1px solid var(--bento-border); background: var(--bento-card);
}
.pan-center.expanded { min-width: 360px; }
.pan-right {
  flex: 1.4; min-width: 360px; display: flex; flex-direction: column;
  background: var(--bento-bg); overflow-y: auto;
}
.pan-head {
  padding: 12px 16px; border-bottom: 1px solid var(--bento-border); background: var(--bento-bg);
  display: flex; align-items: center; gap: 8px;
}
.pan-title {
  font-size: 12px; font-weight: 600; color: var(--bento-text-secondary); text-transform: uppercase;
  letter-spacing: 0.04em;
}
.sinput-sm {
  flex: 1; max-width: 180px; padding: 6px 10px; border: 1.5px solid var(--bento-border);
  border-radius: var(--radius-xs); background: var(--bento-card); color: var(--bento-text);
  font-size: 13px; font-family: 'Inter', sans-serif; transition: var(--tr); outline: none;
}
.sinput-sm:focus { border-color: var(--bento-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

/* Search & controls in left panel */
.search-box { padding: 10px 12px; border-bottom: 1px solid var(--bento-border); }
.sinput {
  width: 100%; padding: 9px 14px; border: 1.5px solid var(--bento-border); border-radius: var(--radius-sm);
  background: var(--bento-card); color: var(--bento-text); font-size: 13px;
  font-family: 'Inter', sans-serif; transition: var(--tr); outline: none;
}
.sinput:focus { border-color: var(--bento-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.sinput::placeholder, .sinput-sm::placeholder { color: var(--bento-text-secondary); opacity: 0.7; }
.ctrls { padding: 10px 12px; border-bottom: 1px solid var(--bento-border); display: flex; flex-direction: column; gap: 6px; }
.crow { display: flex; gap: 8px; align-items: center; font-size: 12px; }
.clbl { font-weight: 600; min-width: 55px; color: var(--bento-text-secondary); font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; }
.csel {
  flex: 1; padding: 6px 10px; border: 1.5px solid var(--bento-border); border-radius: var(--radius-xs);
  background: var(--bento-card); color: var(--bento-text); font-size: 13px;
  font-family: 'Inter', sans-serif; transition: var(--tr); outline: none;
}
.csel:focus { border-color: var(--bento-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

/* List */
.list { flex: 1; overflow-y: auto; overflow-x: hidden; border: 1px solid var(--bento-border); border-radius: var(--radius-sm); margin: 0; }
.empty {
  display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  height: 100%; color: var(--bento-text-secondary); gap: 12px; font-size: 14px; padding: 48px 24px;
  font-family: 'Inter', sans-serif;
}
.empty-ico { font-size: 48px; opacity: 0.5; }
.pag {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 16px; font-size: 13px; color: var(--bento-text-secondary); border-bottom: 1px solid var(--bento-border);
}
@container (max-width: 600px) { .pag { display: none !important; } }
.pag-btn {
  padding: 8px 14px; border: 1.5px solid var(--bento-border); border-radius: var(--radius-xs);
  background: var(--bento-card); color: var(--bento-text); cursor: pointer; font-size: 13px;
  font-weight: 500; font-family: 'Inter', sans-serif; transition: var(--tr);
}
.pag-btn:hover:not(:disabled) { background: var(--bento-primary); color: white; border-color: var(--bento-primary); }
.pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pag-info { font-size: 13px; color: var(--bento-text-secondary); font-weight: 500; padding: 0 8px; }
.pag-size {
  padding: 6px 10px; border: 1.5px solid var(--bento-border); border-radius: var(--radius-xs);
  background: var(--bento-card); color: var(--bento-text); font-size: 13px; cursor: pointer;
  font-family: 'Inter', sans-serif;
}

/* Auto items */
.auto-item {
  padding: 12px 16px; border-bottom: 1px solid var(--bento-border); cursor: pointer;
  transition: var(--tr); display: flex; align-items: center; gap: 10px;
  font-family: 'Inter', sans-serif;
}
.auto-item:hover { background: rgba(59, 130, 246, 0.04); }
.auto-item.sel { background: rgba(59, 130, 246, 0.08); border-left: 3px solid var(--bento-primary); padding-left: 13px; }
.auto-item.chk { background: rgba(59, 130, 246, 0.06); }
.auto-name { font-weight: 500; font-size: 13px; color: var(--bento-text); margin-bottom: 2px; line-height: 1.4; }
.auto-meta { display: flex; gap: 8px; font-size: 12px; color: var(--bento-text-secondary); align-items: center; }
.auto-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--bento-text-secondary); display: inline-block; }
.auto-dot.s-running { background: var(--bento-success); color: var(--bento-success); }
.auto-dot.s-stopped { background: var(--bento-text-secondary); color: var(--bento-text-secondary); }
.auto-dot.s-error { background: var(--bento-error); color: var(--bento-error); }
.auto-count {
  background: var(--bento-border); padding: 2px 8px; border-radius: 10px; font-weight: 600;
  font-size: 11px; color: var(--bento-text-secondary); margin-left: auto;
}

/* Trace groups */
.tgroup { border: 1px solid var(--bento-border); border-radius: var(--radius-xs); margin-bottom: 8px; overflow: hidden; }
.tgroup-h {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  background: var(--bento-bg); cursor: pointer; font-size: 13px; font-weight: 600;
  user-select: none; transition: var(--tr); font-family: 'Inter', sans-serif; color: var(--bento-text);
}
.tgroup-h:hover { background: rgba(59, 130, 246, 0.06); }
.tg-tog { font-size: 12px; transition: transform 0.2s; color: var(--bento-text-secondary); }
.tgroup.collapsed .tg-tog { transform: rotate(-90deg); }
.tgroup.collapsed .tgroup-items { display: none; }
.tg-name { flex: 1; font-weight: 600; font-size: 13px; color: var(--bento-text); }
.tg-cnt {
  font-size: 11px; color: var(--bento-text-secondary); margin-left: auto; background: var(--bento-border);
  padding: 2px 8px; border-radius: 10px;
}

/* Trace items */
.tr-item {
  padding: 10px 16px; border-bottom: 1px solid var(--bento-border); cursor: pointer;
  transition: var(--tr); display: flex; align-items: center; gap: 10px;
  font-family: 'Inter', sans-serif;
}
.tr-item:hover { background: rgba(59, 130, 246, 0.04); }
.tr-item.sel { background: rgba(59, 130, 246, 0.08); border-left: 3px solid var(--bento-primary); padding-left: 13px; }
.tr-item.chk { background: rgba(59, 130, 246, 0.06); }
.tr-cb { font-size: 16px; cursor: pointer; user-select: none; }
.tr-ico { font-size: 14px; min-width: 18px; text-align: center; }
.tr-ico.s-success { color: var(--bento-success); }
.tr-ico.s-error { color: var(--bento-error); }
.tr-ico.s-running { color: var(--bento-primary); }
.tr-ico.s-aborted { color: var(--bento-warning); }
.tr-info { flex: 1; min-width: 0; }
.tr-auto { font-size: 12px; font-weight: 600; color: var(--bento-primary); margin-bottom: 2px; }
.tr-time { font-size: 12px; font-weight: 500; color: var(--bento-text); }
.tr-trig { font-size: 11px; color: var(--bento-text-secondary); margin-top: 2px; }
.tr-dur { font-size: 11px; color: var(--bento-text-secondary); white-space: nowrap; font-weight: 600; }

/* Detail panel */
.det-head {
  padding: 16px 20px; border-bottom: 1px solid var(--bento-border); display: flex;
  justify-content: space-between; align-items: flex-start; gap: 12px; background: var(--bento-card);
}
.det-info { flex: 1; min-width: 0; }
.det-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; color: var(--bento-text); letter-spacing: -0.01em; }
.det-time { font-size: 12px; color: var(--bento-text-secondary); }
.det-badge {
  display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px;
  border-radius: 20px; font-size: 11px; font-weight: 600; white-space: nowrap;
  letter-spacing: 0.02em; text-transform: uppercase;
}
.det-dur { margin-left: 4px; opacity: 0.8; }
.det-badge.s-success { background: rgba(16, 185, 129, 0.1); color: #059669; }
.det-badge.s-error { background: rgba(239, 68, 68, 0.1); color: #DC2626; }
.det-badge.s-running { background: rgba(59, 130, 246, 0.1); color: var(--bento-primary); }
.det-badge.s-aborted { background: rgba(245, 158, 11, 0.1); color: #B45309; }

/* Flow graph */
.det-flow {
  padding: 16px 20px; border-bottom: 1px solid var(--bento-border); display: flex;
  justify-content: center; background: var(--bento-bg); overflow-x: auto;
}
.flow-graph { display: block; }

/* Detail tabs */
.det-tabs {
  display: flex; gap: 4px; border-bottom: 2px solid var(--bento-border); padding: 0 16px;
  overflow-x: auto; margin-bottom: 0;
}
.dtab {
  padding: 10px 20px; background: transparent; border: none; border-bottom: 2px solid transparent;
  color: var(--bento-text-secondary); cursor: pointer; font-size: 14px; font-weight: 500;
  transition: var(--tr); margin-bottom: -2px; white-space: nowrap;
  border-radius: 8px 8px 0 0; font-family: 'Inter', sans-serif;
}
.dtab.act { color: var(--bento-primary); border-bottom-color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }
.dtab:hover { color: var(--bento-primary); background: rgba(59, 130, 246, 0.04); }

/* Tab panes */
.det-body { flex: 1; overflow-y: auto; padding: 16px 20px; }
.tab-pane { display: none; animation: fadeSlideIn 0.3s ease-out; }
.tab-pane.act { display: block; }

/* Timeline steps */
.tl-step {
  margin-bottom: 10px; border-left: 3px solid var(--bento-border); padding: 12px 14px;
  background: var(--bento-card); border-radius: 0 var(--radius-xs) var(--radius-xs) 0;
  transition: var(--tr);
}
.tl-step:hover { box-shadow: var(--shadow); }
.tl-step.s-success { border-left-color: var(--bento-success); }
.tl-step.s-error { border-left-color: var(--bento-error); }
.tl-step.s-unconfirmed { border-left-color: var(--bento-warning, #ad5200); }
.tl-step.s-skipped { border-left-color: var(--bento-text-secondary); opacity: 0.6; }
.tl-head { display: flex; gap: 10px; align-items: center; }
.tl-num {
  width: 24px; height: 24px; border-radius: 50%; color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0;
  font-weight: 600;
}
.tl-title { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.tl-cat { font-size: 10px; font-weight: 700; color: var(--bento-primary); text-transform: uppercase; letter-spacing: 0.04em; }
.tl-desc { font-size: 13px; font-weight: 500; color: var(--bento-text); overflow-wrap: anywhere; }
.tl-dur { font-size: 11px; color: var(--bento-text-secondary); white-space: nowrap; font-weight: 600; }
.tl-err {
  margin-top: 8px; padding: 8px 12px; background: rgba(239, 68, 68, 0.08);
  border-radius: var(--radius-xs); font-size: 12px; color: #DC2626;
}
.tl-dets { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px 14px; }
.tl-det { font-size: 11px; color: var(--bento-text-secondary); word-break: break-word; }
.tl-det b { color: var(--bento-text); font-weight: 600; }
.tl-ts { font-size: 10px; color: var(--bento-text-secondary); margin-top: 4px; opacity: 0.6; }

/* Related activity */
.rel-list { display: flex; flex-direction: column; gap: 8px; }
.rel-item {
  padding: 12px 14px; border: 1px solid var(--bento-border); border-radius: var(--radius-xs);
  display: flex; flex-direction: column; gap: 4px; transition: var(--tr);
  background: var(--bento-card);
}
.rel-item:hover { border-color: var(--bento-primary); box-shadow: var(--shadow); }
.rel-entity { font-size: 13px; font-weight: 600; color: var(--bento-primary); }
.rel-action { font-size: 13px; color: var(--bento-text); }
.rel-time { font-size: 11px; color: var(--bento-text-secondary); }

/* Changed vars */
.cv-item {
  margin-bottom: 10px; border: 1px solid var(--bento-border); border-radius: var(--radius-xs);
  overflow: hidden; background: var(--bento-card);
}
.cv-head {
  display: flex; gap: 8px; padding: 8px 12px; background: var(--bento-bg);
  font-size: 12px; align-items: center; border-bottom: 1px solid var(--bento-border);
}
.cv-step { color: var(--bento-primary); font-weight: 700; }
.cv-name { font-weight: 500; color: var(--bento-text); }
.cv-val {
  margin: 0; padding: 10px 12px; font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px; overflow-x: auto; color: var(--bento-text); line-height: 1.5;
  white-space: pre-wrap; word-break: break-word; background: var(--bento-card);
}

/* Config */
.config-header {
  font-size: 12px; font-weight: 600; color: var(--bento-text-secondary); text-transform: uppercase;
  letter-spacing: 0.04em; margin-bottom: 10px;
}
.yaml-content {
  margin: 0; padding: 16px; background: var(--bento-bg); border: 1px solid var(--bento-border);
  border-radius: var(--radius-sm); font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px; overflow-x: auto; color: var(--bento-text); line-height: 1.6;
  max-height: 600px; overflow-y: auto; white-space: pre-wrap; word-break: break-word;
}

/* JSON */
.json-bar { margin-bottom: 8px; display: flex; gap: 8px; }
.json-content {
  margin: 0; padding: 16px; background: var(--bento-bg); border: 1px solid var(--bento-border);
  border-radius: var(--radius-sm); font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px; overflow-x: auto; color: var(--bento-text); line-height: 1.5;
  max-height: 600px; overflow-y: auto;
}

/* Loading spinner */
.spinner {
  width: 32px; height: 32px; border: 3px solid var(--bento-border);
  border-top: 3px solid var(--bento-primary); border-radius: 50%;
  animation: spin 0.8s linear infinite; margin: 24px auto;
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--bento-text-secondary); }

/* Responsive */
@media (max-width: 1200px) { .pan-right { display: none; } }
@media (max-width: 900px) { .pan-left { display: none !important; } .pan-center.expanded { min-width: 100%; } }
@media (max-width: 768px) {
  .stats { grid-template-columns: repeat(2, 1fr); }
  .panels { flex-direction: column; }
  .pan-left { display: block !important; width: 100% !important; max-height: 30vh; overflow-y: auto; border-right: none; border-bottom: 1px solid var(--bento-border); min-width: auto; }
  .pan-center { width: 100% !important; min-width: 0 !important; flex: 1; }
  .pan-right { display: block !important; width: 100% !important; min-width: auto; max-height: none; overflow-y: auto; border-right: none; border-top: 1px solid var(--bento-border); flex: 1; min-height: 300px; }
  .pan-right:empty, .pan-right .empty { display: none; }
}


:host(.bento-dark) {
    --bento-bg: var(--primary-background-color, #1a1a2e);
    --bento-card: var(--card-background-color, #16213e);
    --bento-text: var(--primary-text-color, #e2e8f0);
    --bento-text-secondary: var(--secondary-text-color, #94a3b8);
    --bento-border: var(--divider-color, #334155);
    --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
    --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  }
/* === DARK MODE ADDED - old comment below === */

        /* === MOBILE FIX === */
        @media (max-width: 768px) {
          .tabs { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; gap: 2px; }
          .tab, .tab-btn, .tab-btn { padding: 6px 10px; font-size: 12px; white-space: nowrap; }
          .card, .card-container { padding: 14px; }
          .stats, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .stat-val, .kpi-val, .metric-val { font-size: 18px; }
          .stat-lbl, .kpi-lbl, .metric-lbl { font-size: 10px; }
          .panels, .board { flex-direction: column; }
          .column { min-width: unset; }
          h2 { font-size: 18px; }
          h3 { font-size: 15px; }
        }
        @media (max-width: 480px) {
          .tabs { gap: 1px; }
          .tab, .tab-btn, .tab-btn { padding: 5px 8px; font-size: 11px; }
          .stats, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid { grid-template-columns: 1fr 1fr; }
          .stat-val, .kpi-val, .metric-val { font-size: 16px; }
        }
      
        /* Settings Info Bar */

/* === Container-based responsive (for dashboard cards) === */
.card.compact-hide-right .pan-right { display: none; }
.card.compact-hide-left .pan-left { display: none !important; }
.card.compact-hide-left .pan-center.expanded { min-width: 100%; }
.card.compact-mobile .stats { grid-template-columns: repeat(2, 1fr); }
.card.compact-mobile .panels { flex-direction: column; }
.card.compact-mobile .pan-left { display: block !important; width: 100% !important; max-height: 30vh; overflow-y: auto; border-right: none; border-bottom: 1px solid var(--bento-border); min-width: auto; }
.card.compact-mobile .pan-center { width: 100% !important; min-width: 0 !important; flex: 1; }
.card.compact-mobile .pan-right { display: block !important; width: 100% !important; min-width: auto; max-height: none; overflow-y: auto; border-right: none; border-top: 1px solid var(--bento-border); flex: 1; min-height: 300px; }
.card.compact-mobile .pan-right:empty, .card.compact-mobile .pan-right .empty { display: none; }
.card.compact-mobile .tabs { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; gap: 2px; }
.card.compact-mobile .tab, .card.compact-mobile .tab-btn { padding: 6px 10px; font-size: 12px; white-space: nowrap; }
.card.compact-mobile .card-container { padding: 14px; }
.card.compact-mobile .stats, .card.compact-mobile .stats-grid, .card.compact-mobile .summary-grid, .card.compact-mobile .stat-cards, .card.compact-mobile .kpi-grid, .card.compact-mobile .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
.card.compact-mobile .stat-val, .card.compact-mobile .kpi-val, .card.compact-mobile .metric-val { font-size: 18px; }
.card.compact-mobile .stat-lbl, .card.compact-mobile .kpi-lbl, .card.compact-mobile .metric-lbl { font-size: 10px; }
.card.compact-mobile .panels, .card.compact-mobile .board { flex-direction: column; }
.card.compact-mobile .column { min-width: unset; }
.card.compact-mobile h2 { font-size: 18px; }
.card.compact-mobile h3 { font-size: 15px; }
.card.compact-xs .tabs { gap: 1px; }
.card.compact-xs .topbar { flex-wrap: wrap; gap: 8px; }
.card.compact-xs .topbar-r { flex-wrap: wrap; min-width: 0; max-width: 100%; }
.card.compact-xs .tab, .card.compact-xs .tab-btn { padding: 5px 8px; font-size: 11px; }
.card.compact-xs .stats, .card.compact-xs .stats-grid, .card.compact-xs .summary-grid, .card.compact-xs .stat-cards, .card.compact-xs .kpi-grid, .card.compact-xs .metrics-grid { grid-template-columns: 1fr 1fr; }
.card.compact-xs .stat-val, .card.compact-xs .kpi-val, .card.compact-xs .metric-val { font-size: 16px; }

${_FAMILY_CONTROL_CSS}
:host { container-type:inline-size;container-name:family-trace;min-width:0; }
.col-main,.panels { min-width:0;max-width:100%; }
:host .tgroup-h { min-height:44px;min-width:44px; }
:host .card .pan-left,:host .card .pan-center,:host .card .pan-right { display:flex !important;min-width:0 !important; }
.family-check { width:44px;height:44px;flex:none;justify-content:center; }
.family-check input { margin:0; }
:host .dd-i[data-exp] { width:100%;text-align:left;font:inherit;border:0;border-radius:0;background:transparent;color:inherit; }
@container family-trace (width < 1200px) {
  .panels { flex-direction:column; }
  .pan-left,.pan-center,.pan-right { width:100% !important;max-height:none !important;min-width:0 !important;flex:auto; }
  .pan-right { min-height:300px;border-top:1px solid var(--bento-border); }
  .topbar,.topbar-r,.controls,.crow,.pag { flex-wrap:wrap; }
  .topbar-r,.cg { min-width:0;max-width:100%; }
  .pan-head { flex-wrap:wrap; }
}

</style>`;
  }

  // ============================================================

  connectedCallback() {
    if (this._hass) this.updateAutomationData();
    // ResizeObserver for mobile view in small dashboard cards
    this._resizeObserver = new ResizeObserver(() => this._applyCompactClasses());
    this._resizeObserver.observe(this);
    _bindFamilyNavigation(this);
  }
  disconnectedCallback() {
    this._exportDialog?.cancel();
    if (!this._exportHandoff) { this._exportDialog?.destroy(); this._exportDialog = null; }
    this._invalidateComparison(true);
    window.removeEventListener('offline', this._comparisonOfflineHandler);
    window.removeEventListener('online', this._comparisonOnlineHandler);
    this._comparisonOfflineHandler = null; this._comparisonOnlineHandler = null;
    this._comparisonConnection?.removeEventListener?.('disconnected', this._comparisonDisconnectedHandler);
    this._comparisonConnection?.removeEventListener?.('ready', this._comparisonReadyHandler);
    this._comparisonConnection = null;
    this._accessEpoch++; this._traceLoadToken = null; this._detailLoadToken = null;
    _disconnectFamilyNavigation(this);this._familyNavWidth=null;
    // Canceled requests cannot finish their loading state after reconnection.
    // Keep completed details, but clear a selection whose request was canceled.
    if (this.selectedTrace && !this.traceDetail) this.selectedTrace = null;
    if (this._loadingSelected) this.selectedAutomation = null;
    this._loadingSelected = false; this._loadingTraces = false; this._traceListError = null;
    if (this.relativeTimeUpdater) clearInterval(this.relativeTimeUpdater);
    if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
    if (this._expDDClose) { document.removeEventListener('click', this._expDDClose); this._expDDClose = null; }
  }
  static getConfigElement() { return document.createElement('ha-trace-viewer-editor'); }
  getCardSize() { return 10; }
  // Trace lists and detail panes are dynamic. Omitting rows tells Home
  // Assistant Sections to use the card's natural content height.
  getGridOptions() { return { columns: 12, min_columns: 6 }; }

  static getStubConfig() { return { type: 'custom:ha-trace-viewer', title: 'Trace Viewer' }; }
}

if (!customElements.get('ha-trace-viewer')) customElements.define('ha-trace-viewer', HATraceViewer);


class HaTraceViewerEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }
  set hass(hass) {
    this._hass = hass;
    this._updateTitleLabel();
  }
  _titleLabel() {
    const language = typeof this._config?.language === 'string' ? this._config.language : this._hass?.language || navigator.language || 'en';
    return language.startsWith('pl') ? 'Tytuł' : 'Title';
  }
  _updateTitleLabel() {
    const label = this.shadowRoot.querySelector('label[for="cf_title"]');
    if (label) label.textContent = this._titleLabel();
  }
  _dispatch() {
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config }, bubbles: true, composed: true }));
  }
  _render() {
    const title = this.shadowRoot.querySelector('#cf_title');
    const value = String(this._config.title ?? 'Trace Viewer');
    if (title) {
      // Reuse the Config Auditor editor fix: equal HA echoes must not reset selection.
      if (title.value !== value) title.value = value;
      this._updateTitleLabel();
      return;
    }
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; padding:16px; }
        h3 { margin:0 0 16px; font-size:15px; font-weight:600; color:var(--bento-text, var(--primary-text-color,#1e293b)); }
        input { box-sizing:border-box;min-height:44px;min-width:44px;max-width:100%;transition:border-color .2s; }
            input:focus-visible { outline:3px solid var(--primary-color,#1769aa);outline-offset:2px; }
        input:focus { border-color:var(--bento-primary, var(--primary-color,#3b82f6)); }
      </style>
      <h3>Trace Viewer</h3>
            <div style="margin-bottom:12px;">
              <label for="cf_title" style="display:block;font-weight:500;margin-bottom:4px;font-size:13px;">${this._titleLabel()}</label>
              <input type="text" id="cf_title" value="${_esc(value)}"
                style="width:100%;padding:8px 12px;border:1px solid var(--divider-color,#e2e8f0);border-radius:8px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#1e293b);font-size:14px;box-sizing:border-box;">
            </div>
    `;
        const f_title = this.shadowRoot.querySelector('#cf_title');
        if (f_title) f_title.addEventListener('input', (e) => {
          this._config = { ...this._config, title: e.target.value };
          this._dispatch();
        });
  }
  connectedCallback() { this._render(); }
}
if (!customElements.get('ha-trace-viewer-editor')) { customElements.define('ha-trace-viewer-editor', HaTraceViewerEditor); }

})();

window.customCards = window.customCards || [];
window.customCards.push({ type: 'ha-trace-viewer', name: 'HA Trace Viewer', description: 'Automation trace viewer for Home Assistant' });
