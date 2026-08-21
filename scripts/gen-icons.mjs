/**
 * Gera os PNGs do PWA sem nenhuma dependência: monta os chunks do PNG na mão
 * e comprime com o zlib do próprio Node. Evita arrastar sharp/canvas para o
 * projeto só para desenhar uma casinha.
 *
 *   npm run icons
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const BG = [0x0b, 0x0f, 0x14];
const FG = [0x4f, 0xd1, 0xa5];

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  // Cada linha do PNG começa com um byte de filtro; 0 = sem filtro.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Cobertura do glifo em (x,y), com supersampling 3x3 para suavizar as bordas. */
function coverage(x, y, s, inset) {
  const cx = s / 2;
  const hw = s * (0.5 - inset) * 0.62;
  const top = s * (0.5 - (0.5 - inset) * 0.62);
  const roofY = top + hw * 0.95;
  const bottom = roofY + hw * 0.88;
  const bodyHw = hw * 0.68;

  let hits = 0;
  for (let sy = 0; sy < 3; sy++) {
    for (let sx = 0; sx < 3; sx++) {
      const px = x + (sx + 0.5) / 3;
      const py = y + (sy + 0.5) / 3;
      const dx = Math.abs(px - cx);

      const inRoof = py >= top && py <= roofY && dx <= (hw * (py - top)) / (roofY - top);
      const inBody = py > roofY && py <= bottom && dx <= bodyHw;

      // Porta vazada: dá leitura de "casa" mesmo em 48px na barra de tarefas.
      const doorW = bodyHw * 0.34;
      const inDoor = py > bottom - (bottom - roofY) * 0.52 && py <= bottom && dx <= doorW;

      if ((inRoof || inBody) && !inDoor) hits++;
    }
  }
  return hits / 9;
}

function render(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  // Ícone maskable precisa de 20% de margem: o Android recorta em círculo,
  // squircle ou o que o launcher quiser.
  const inset = maskable ? 0.22 : 0.12;
  const r = size * 0.22; // raio dos cantos, só no ícone normal

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let alpha = 255;

      if (!maskable) {
        const dx = Math.max(r - x, x - (size - r), 0);
        const dy = Math.max(r - y, y - (size - r), 0);
        if (Math.hypot(dx, dy) > r) alpha = 0;
      }

      const cov = coverage(x, y, size, inset);
      px[i] = Math.round(BG[0] + (FG[0] - BG[0]) * cov);
      px[i + 1] = Math.round(BG[1] + (FG[1] - BG[1]) * cov);
      px[i + 2] = Math.round(BG[2] + (FG[2] - BG[2]) * cov);
      px[i + 3] = alpha;
    }
  }
  return png(size, px);
}

mkdirSync(OUT, { recursive: true });
const files = [
  ["icon-192.png", render(192)],
  ["icon-512.png", render(512)],
  ["maskable-512.png", render(512, { maskable: true })],
];
for (const [name, buf] of files) {
  writeFileSync(join(OUT, name), buf);
  console.log(`${name}  ${(buf.length / 1024).toFixed(1)} KB`);
}
