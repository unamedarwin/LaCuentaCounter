const assert = require('node:assert/strict');
const qrcode = require('../vendor/qrcode.js');
const jsQR = require('../vendor/jsQR.js');

const value = 'https://example.test/tournament.html#import=eyJwIjoiTENDMSJ9';
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
console.log('QR generation/decoding round-trip: ok');
