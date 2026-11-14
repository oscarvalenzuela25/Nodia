// Synthetic assets only: no browser, account, network or production files.
import fs from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const header = Buffer.alloc(8), checksum = Buffer.alloc(4);
  header.writeUInt32BE(data.length); header.write(type, 4);
  checksum.writeUInt32BE(crc(Buffer.concat([header.subarray(4), data])));
  return Buffer.concat([header, data, checksum]);
}
export function png(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc((size * 4 + 1) * size))), chunk('IEND', Buffer.alloc(0))]);
}
export function pwaFixture(directory) {
  const write = (name, bytes) => { const filename = path.join(directory, name);
    fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, bytes); };
  const icons = [];
  for (const purpose of ['any', 'maskable']) for (const size of [192, 512]) {
    const src = `/icons/icon-${purpose === 'maskable' ? 'maskable-' : ''}${size}.png`;
    write(src.slice(1), png(size)); icons.push({ src, sizes: `${size}x${size}`, type: 'image/png', purpose });
  }
  const manifest = { id: '/', name: 'Nodia', short_name: 'Nodia', lang: 'es', start_url: '/', scope: '/',
    display: 'standalone', background_color: '#f7f9f3', theme_color: '#f7f9f3', prefer_related_applications: false, icons };
  write('manifest.webmanifest', JSON.stringify(manifest));
  write('index.html', '<!doctype html><html><head><link rel="manifest" href="/manifest.webmanifest">' +
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="apple-touch-icon" href="/apple-touch-icon.png">' +
    '<meta name="theme-color" content="#f7f9f3"></head><body>Synthetic PWA fixture</body></html>');
  write('apple-touch-icon.png', png(180)); write('favicon-32x32.png', png(32));
  write('favicon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M1 1h30v30H1z"/></svg>');
  const image = png(32), ico = Buffer.alloc(22);
  ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4); ico[6] = 32; ico[7] = 32;
  ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(image.length, 14); ico.writeUInt32LE(22, 18);
  write('favicon.ico', Buffer.concat([ico, image]));
  return { manifest, write, updateManifest: () => write('manifest.webmanifest', JSON.stringify(manifest)) };
}
