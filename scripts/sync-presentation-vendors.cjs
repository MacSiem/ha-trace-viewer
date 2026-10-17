'use strict';
// Presentation only; Analyzer classification and diagnostic export stay independent.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'shared/presentation-provenance.json'), 'utf8'));
const cardPath = path.join(root, 'ha-trace-viewer.js');
let card = fs.readFileSync(cardPath, 'utf8');
for (const [file, provenance] of Object.entries(manifest.files)) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  if (crypto.createHash('sha256').update(source).digest('hex') !== provenance.sourceSha256) throw new Error('Presentation source drift: ' + file);
  const start = '/* BEGIN INLINE ' + file + ' */', end = '/* END INLINE ' + file + ' */';
  if (card.split(start).length !== 2 || card.split(end).length !== 2) throw new Error('Missing/competing presentation factory: ' + file);
  const expected = start + '\n' + source.split('// Node tests use the canonical factory;')[0].trimEnd() + '\n' + end;
  const a = card.indexOf(start), b = card.indexOf(end, a) + end.length;
  if (process.argv.includes('--write')) card = card.slice(0, a) + expected + card.slice(b);
  else if (card.slice(a, b) !== expected) throw new Error('Presentation runtime drift: ' + file);
}
if (process.argv.includes('--write')) fs.writeFileSync(cardPath, card);
console.log('Presentation source/runtime/provenance parity PASS');
