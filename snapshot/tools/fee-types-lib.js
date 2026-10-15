// Shared helpers for reading/writing the fee-types seed inside the built bundle.
// The Vite build stores the seed as:  ts=[...terms],ns={...due dates},rs=[...fee types],is=[...schools]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BUNDLE = path.join(ROOT, 'assets', 'index-9rDsKP4t.js');
const JSON_FILE = path.join(ROOT, 'data', 'fee-types.json');

function findRegion(s) {
  const start = s.indexOf(',ts=[');
  const end = s.indexOf('],is=[', start);
  if (start === -1 || end === -1) throw new Error('Seed region markers not found in bundle.');
  // region text without the leading ',' and including closing ']'
  return { start: start + 1, end: end + 1, text: s.slice(start + 1, end + 1) };
}

function parseRegion(text) {
  if (/function|=>/.test(text)) throw new Error('Unexpected code inside seed region — aborting.');
  const terms = text.match(/ts=\[([^\]]*)\]/)[1]
    .split(',').map(x => x.trim()).filter(Boolean).map(x => x.slice(1, -1));
  const nsMatch = text.match(/ns=\{([^}]*)\}/)[1];
  const due = {};
  for (const m of nsMatch.matchAll(/"([^"]+)":`([^`]*)`/g)) due[m[1]] = m[2];
  const feeTypes = [];
  for (const m of text.matchAll(/\{id:`([^`]*)`,school:`([^`]*)`,name:`([^`]*)`(?:,level:`([^`]*)`)?,updated:`([^`]*)`,components:\[([^\]]*)\]\}/g)) {
    const components = [...m[6].matchAll(/\{name:`([^`]*)`,amount:([0-9.]+)\}/g)]
      .map(c => ({ name: c[1], amount: Number(c[2]) }));
    const ft = { id: m[1], school: m[2], name: m[3], updated: m[5], components };
    if (m[4] !== undefined) ft.level = m[4]; // optional level/cohort
    feeTypes.push(ft);
  }
  return { terms: terms.map(t => ({ term: t, due: due[t] || '' })), feeTypes };
}

function quote(v) { return '`' + String(v).replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`'; }

function buildRegion(data) {
  const terms = data.terms.map(t => quote(t.term)).join(',');
  const ns = data.terms.map(t => `"${t.term}":${quote(t.due)}`).join(',');
  const rs = data.feeTypes.map(ft => {
    const level = ft.level ? `,level:${quote(ft.level)}` : '';
    const comps = ft.components.map(c => `{name:${quote(c.name)},amount:${Number(c.amount)}}`).join(',');
    return `{id:${quote(ft.id)},school:${quote(ft.school)},name:${quote(ft.name)}${level},updated:${quote(ft.updated)},components:[${comps}]}`;
  }).join(',');
  return `ts=[${terms}],ns={${ns}},rs=[${rs}]`;
}

function readJSON() { return JSON.parse(fs.readFileSync(JSON_FILE, 'utf8')); }

function extract() {
  const s = fs.readFileSync(BUNDLE, 'utf8');
  const region = findRegion(s);
  const data = parseRegion(region.text);
  fs.mkdirSync(path.dirname(JSON_FILE), { recursive: true });
  fs.writeFileSync(JSON_FILE, JSON.stringify(data, null, 2) + '\n');
  return data;
}

function apply() {
  let s = fs.readFileSync(BUNDLE, 'utf8');
  const region = findRegion(s);
  const current = parseRegion(region.text); // validates region is still well-formed
  const next = buildRegion(readJSON());
  const orig = path.join(ROOT, 'assets', 'index-9rDsKP4t.js.orig');
  if (!fs.existsSync(orig)) fs.copyFileSync(BUNDLE, orig); // pristine copy of the deployed build
  s = s.slice(0, region.start) + next + s.slice(region.end);
  fs.writeFileSync(BUNDLE, s);
  return { current, next };
}

function restore() {
  const orig = path.join(ROOT, 'assets', 'index-9rDsKP4t.js.orig');
  if (!fs.existsSync(orig)) throw new Error('No .orig backup found.');
  fs.copyFileSync(orig, BUNDLE);
}

module.exports = { extract, apply, restore, BUNDLE, JSON_FILE };
