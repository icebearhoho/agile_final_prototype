// Usage:
//   node tools/fee-types.js extract   — re-extract current bundle data into data/fee-types.json
//   node tools/fee-types.js apply     — patch data/fee-types.json into the bundle
//   node tools/fee-types.js restore   — restore the pristine deployed bundle from .orig
const lib = require('./fee-types-lib.js');
const cmd = process.argv[2];

if (cmd === 'extract') {
  const data = lib.extract();
  console.log('Extracted to', lib.JSON_FILE);
  console.log(JSON.stringify(data, null, 2));
} else if (cmd === 'apply') {
  const { current, next } = lib.apply();
  console.log('Patched', lib.BUNDLE);
  console.log('--- previous region ---\n' + current.terms.map(t => t.term).join(', '));
  console.log(next.slice(0, 400));
} else if (cmd === 'restore') {
  lib.restore();
  console.log('Restored pristine bundle.');
} else {
  console.log('Commands: extract | apply | restore');
}
