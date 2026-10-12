(function() {
'use strict';
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

if (typeof module !== 'undefined' && module.exports) module.exports = { createHAToolsTraceContract };
})();
