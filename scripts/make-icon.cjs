// Generates public/icon.png — a branded Nova Nexus app icon (no deps).
// Dark indigo gradient background with a glowing 4-point "nova" star.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256;

function lerp(a, b, t) { return a + (b - a) * t; }
function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

const c1 = hex('#1a1a3e'); // top
const c2 = hex('#0d1b3a'); // bottom
const accent = hex('#38bdf8'); // cyan star
const accent2 = hex('#8b5cf6'); // violet glow

const px = Buffer.alloc(SIZE * SIZE * 4);
const cx = SIZE / 2, cy = SIZE / 2;

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const t = y / SIZE;
    let r = lerp(c1[0], c2[0], t), g = lerp(c1[1], c2[1], t), b = lerp(c1[2], c2[2], t);

    const dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ang = Math.atan2(dy, dx);

    // Rounded-corner mask
    const inset = 18;
    const rx = Math.abs(dx) - (cx - inset), ry = Math.abs(dy) - (cy - inset);
    const corner = Math.sqrt(Math.max(rx, 0) ** 2 + Math.max(ry, 0) ** 2);
    let alpha = 255;
    if (corner > 26) alpha = 0; else if (corner > 22) alpha = Math.round(255 * (1 - (corner - 22) / 4));

    // Soft violet radial glow
    const glow = Math.max(0, 1 - dist / 150);
    r = lerp(r, accent2[0], glow * 0.25);
    g = lerp(g, accent2[1], glow * 0.25);
    b = lerp(b, accent2[2], glow * 0.25);

    // 4-point star (nova): bright near the two diagonals/axes, thin arms
    const arm = Math.abs(Math.cos(2 * ang)); // peaks along axes
    const starR = 92 * (0.35 + 0.65 * arm * arm * arm);
    const core = Math.max(0, 1 - dist / 26); // bright center
    let starGlow = 0;
    if (dist < starR) starGlow = Math.pow(1 - dist / starR, 1.6) * Math.pow(arm, 1.2);
    starGlow = Math.max(starGlow, core);
    r = lerp(r, accent[0], Math.min(1, starGlow));
    g = lerp(g, accent[1], Math.min(1, starGlow));
    b = lerp(b, accent[2], Math.min(1, starGlow));
    // White-hot center
    const white = Math.max(0, 1 - dist / 12);
    r = lerp(r, 255, white); g = lerp(g, 255, white); b = lerp(b, 255, white);

    const i = (y * SIZE + x) * 4;
    px[i] = Math.round(Math.max(0, Math.min(255, r)));
    px[i + 1] = Math.round(Math.max(0, Math.min(255, g)));
    px[i + 2] = Math.round(Math.max(0, Math.min(255, b)));
    px[i + 3] = alpha;
  }
}

// Encode PNG
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0, 0);
  return Buffer.concat([len, t, data, crc]);
}
const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return c ^ 0xffffffff; }

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4); ihdr[8] = 8; ihdr[9] = 6; // RGBA
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) { raw[y * (SIZE * 4 + 1)] = 0; px.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4); }
const idat = zlib.deflateSync(raw);
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(__dirname, '..', 'public', 'icon.png');
fs.writeFileSync(out, png);
console.log('Wrote', out, png.length, 'bytes');
