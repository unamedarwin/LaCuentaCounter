const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { TextEncoder, TextDecoder } = require('node:util');

const memory = new Map();
const context = {
  LCCI18N: { t: source => source, apply() {}, locale: () => 'ca' },
  TextEncoder, TextDecoder, URL, URLSearchParams, Intl, Uint8Array,
  btoa: value => Buffer.from(value, 'binary').toString('base64'),
  atob: value => Buffer.from(value, 'base64').toString('binary'),
  localStorage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) },
  navigator: {}, location: { protocol: 'file:', href: 'https://example.test/index.html' },
  window: { addEventListener() {} },
  document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
  console, setTimeout, clearTimeout
};
context.globalThis = context;
vm.runInNewContext(fs.readFileSync(require.resolve('../shared.js'), 'utf8'), context);

const payload = { p: 'LCC1', v: 1, g: 'parser-smoke', t: 'Taula', e: '2026-01-01T00:00:00.000Z', r: 2, a: [
  { n: 'A', s: 900, d: 900, b: 0, k: 3 },
  { n: 'B', s: 900, d: 0, b: 900, k: 1 },
  { n: 'C', s: 900, d: 0, b: 900, k: 1 }
] };
const encoded = context.LCC.toBase64Url(JSON.stringify(payload));

assert.equal(context.LCC.parseResultText(`LCC1:${encoded}`).r, 2);
assert.equal(context.LCC.parseResultText(`https://example.test/tournament.html#import=${encoded}`).a[0].b, 0);
assert.equal(context.LCC.parseResultText(`https://example.test/tournament.html?import=${encoded}`).g, 'parser-smoke');
assert.throws(() => context.LCC.parseResultText('https://example.test/tournament.html'), /no conté cap resultat importable/);
console.log('LCC1 raw, hash URL and query URL parsing: ok');
