/* Keep the exact existing Analyzer contract inside this card's own closure. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const args = process.argv.slice(2);
const write = args.includes('--write');
const rootAt = args.indexOf('--root');
const root = rootAt < 0 ? path.resolve(__dirname,'..') : path.resolve(args[rootAt+1]);
const sourcePath = 'shared/ha-tools-trace-contract.js';
const runtimePath = 'ha-trace-viewer.js';
const start = '/* BEGIN INLINE shared/ha-tools-trace-contract.js */';
const end = '/* END INLINE shared/ha-tools-trace-contract.js */';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
try {
  const source = fs.readFileSync(path.join(root,sourcePath),'utf8');
  const snapshot = source.split('// BEGIN ANALYZER TRACE SNAPSHOT\n')[1]?.split('// END ANALYZER TRACE SNAPSHOT')[0];
  if (!snapshot || sha(snapshot) !== '0f891270a1d1fc04636e1b8752b8a3856371068a3be98a67797639b566b237b3') throw new Error('Analyzer snapshot changed; review the upstream contract first');
  const prefix = "(function() {\n'use strict';\n";
  const suffix = "\nif (typeof module !== 'undefined' && module.exports) module.exports = { createHAToolsTraceContract };\n})();\n";
  if (!source.startsWith(prefix) || !source.endsWith(suffix)) throw new Error('Unexpected shared factory envelope');
  const factory = source.slice(prefix.length,-suffix.length).trimEnd();
  const original = fs.readFileSync(path.join(root,runtimePath),'utf8');
  if (original.split(start).length !== 2 || original.split(end).length !== 2) throw new Error('Runtime vendor markers are missing or duplicated');
  const a = original.indexOf(start), b = original.indexOf(end,a)+end.length;
  const generated = original.slice(0,a)+start+'\n'+factory+'\n'+end+original.slice(b);
  const manifestPath = path.join(root,'generated-sources.json');
  const manifest = JSON.stringify({schema:1,sharedTraceContract:{path:sourcePath,sha256:sha(source),bytes:Buffer.byteLength(source),analyzerSnapshotSha256:sha(snapshot)}},null,2)+'\n';
  if (write) {
    if (generated !== original) fs.writeFileSync(path.join(root,runtimePath),generated);
    fs.writeFileSync(manifestPath,manifest);
  } else if (original !== generated || !fs.existsSync(manifestPath) || fs.readFileSync(manifestPath,'utf8') !== manifest) throw new Error('Trace vendor or provenance drift; run scripts/sync-trace-contract.cjs --write');
  console.log('Trace contract source/runtime/provenance parity PASS');
} catch (error) {
  console.error(error.message); process.exitCode=1;
}
