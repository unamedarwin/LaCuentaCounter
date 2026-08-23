const assert = require('node:assert/strict');
const qrcode = require('../vendor/qrcode.js');
const jsQR = require('../vendor/jsQR.js');

const payload = { p: 'LCC1', v: 1, g: 'game-smoke', t: 'Taula', e: '2026-01-01T00:00:00.000Z', r: 1, a: [
  { n: 'Pep', s: 900, d: 950, b: -50, k: 3 },
  { n: 'Pep', s: 900, d: 0, b: 900, k: 1 },
  { n: 'Joana', s: 900, d: 0, b: 900, k: 1 }
] };
const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
const value = `LCC1:${encoded}`;
const qr = qrcode(0, 'M');
qr.addData(value);
qr.make();

const quiet = 4;
const scale = 8;
const modules = qr.getModuleCount();
const size = (modules + quiet * 2) * scale;
const pixels = new Uint8ClampedArray(size * size * 4).fill(255);

for (let row = 0; row < modules; row += 1) {
  for (let column = 0; column < modules; column += 1) {
    if (!qr.isDark(row, column)) continue;
    for (let y = 0; y < scale; y += 1) for (let x = 0; x < scale; x += 1) {
      const pixel = (((row + quiet) * scale + y) * size + (column + quiet) * scale + x) * 4;
      pixels[pixel] = 0; pixels[pixel + 1] = 0; pixels[pixel + 2] = 0;
    }
  }
}

const decoded = jsQR(pixels, size, size, { inversionAttempts: 'attemptBoth' });
assert.equal(decoded?.data, value);
const decodedPayload = JSON.parse(Buffer.from(decoded.data.slice(5), 'base64url').toString());
assert.deepEqual(decodedPayload.a.map(player => player.n), ['Pep', 'Pep', 'Joana']);
assert.equal(decodedPayload.a[0].b, -50);
const shareUrl = `https://example.test/tournament.html#import=${encoded}`;
assert.equal(new URLSearchParams(new URL(shareUrl).hash.slice(1)).get('import'), encoded);
console.log('QR generation/decoding round-trip: ok');
