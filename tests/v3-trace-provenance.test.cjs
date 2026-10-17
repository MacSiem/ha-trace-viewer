const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname,'..');

test('maintained trace vendor check rejects drift and restores only the shared factory', () => {
  // The local owner supplies SSD TMPDIR; hosted CI uses its own ephemeral runner temp.
  const tempRoot = process.env.TMPDIR || require('node:os').tmpdir();
  assert.ok(path.isAbsolute(tempRoot));
  const fixture = fs.mkdtempSync(path.join(tempRoot,'trace-vendor-'));
  fs.mkdirSync(path.join(fixture,'shared'));
  for(const file of ['ha-trace-viewer.js','shared/ha-tools-trace-contract.js']) fs.copyFileSync(path.join(root,file),path.join(fixture,file));
  const script = path.join(root,'scripts/sync-trace-contract.cjs');
  const run = flag => spawnSync(process.execPath,[script,flag,'--root',fixture],{encoding:'utf8'});
  assert.equal(run('--write').status,0);
  assert.equal(run('--check').status,0);
  const file=path.join(fixture,'ha-trace-viewer.js');
  const source=fs.readFileSync(file,'utf8');
  fs.writeFileSync(file,source.replace('const AA_TRACE_MAX_BYTES = 2 * 1024 * 1024;','const AA_TRACE_MAX_BYTES = 3 * 1024 * 1024;'));
  assert.equal(run('--check').status,1);
  assert.equal(run('--write').status,0);
  assert.equal(fs.readFileSync(file,'utf8'),source);
  assert.equal(run('--check').status,0);
  // Fixture files remain in the SSD test temp area for the normal retention lane.
});
