// Validate the already built installation assets; never build or install a service worker.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ensure = (value, code) => { if (!value) throw new Error(code); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const maxAssetBytes = 2 * 1024 * 1024;
const asset = (directory, name) => {
  const filename = path.join(directory, name);
  ensure(fs.existsSync(filename), 'pwa_asset_missing');
  const stat = fs.lstatSync(filename);
  const relative = path.relative(fs.realpathSync(directory), fs.realpathSync(filename));
  ensure(stat.isFile() && !stat.isSymbolicLink() && relative && !path.isAbsolute(relative) &&
    relative !== '..' && !relative.startsWith('..' + path.sep) && stat.size > 0 && stat.size <= maxAssetBytes,
  'pwa_asset_invalid');
  return fs.readFileSync(filename);
};
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)]
  .map(([, key, value]) => [key.toLowerCase(), value]));
const links = html => [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => attributes(tag));
const localUrl = value => {
  ensure(typeof value === 'string' && /^\/[A-Za-z0-9/_-]+(?:\.[A-Za-z0-9_-]+)?$/.test(value) &&
    !value.includes('//'), 'pwa_asset_url_invalid');
  return value.slice(1);
};

// Signature, IHDR and bounded chunk structure establish actual dimensions, not filename claims.
export function pngDimensions(bytes) {
  ensure(bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.readUInt32BE(8) === 13 && bytes.toString('ascii', 12, 16) === 'IHDR', 'pwa_png_invalid');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  ensure(width > 0 && height > 0 && width <= 4096 && height <= 4096, 'pwa_png_invalid');
  let offset = 8, idat = false, ended = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
    ensure(offset + length + 12 <= bytes.length, 'pwa_png_invalid');
    if (type === 'IDAT' && length > 0) idat = true;
    offset += length + 12;
    if (type === 'IEND') { ensure(length === 0 && offset === bytes.length, 'pwa_png_invalid'); ended = true; break; }
  }
  ensure(idat && ended, 'pwa_png_invalid');
  return { width, height };
}

export function validatePwaAssets(directory, { required = false } = {}) {
  const html = asset(directory, 'index.html').toString('utf8');
  const htmlLinks = links(html), manifestLinks = htmlLinks.filter(link => link.rel?.toLowerCase() === 'manifest');
  const present = fs.existsSync(path.join(directory, 'manifest.webmanifest'));
  // Historical pre-PWA releases can still be reconciled or rolled back without inventing a manifest.
  if (!required && !present && manifestLinks.length === 0) return null;
  ensure(present && manifestLinks.length === 1 && manifestLinks[0].href === '/manifest.webmanifest', 'pwa_manifest_link_invalid');
  const manifestBytes = asset(directory, 'manifest.webmanifest');
  let manifest;
  try { manifest = JSON.parse(manifestBytes.toString('utf8')); } catch { throw new Error('pwa_manifest_json_invalid'); }
  ensure(manifest && !Array.isArray(manifest) && manifest.id === '/' && manifest.name === 'Nodia' &&
    manifest.short_name === 'Nodia' && manifest.lang === 'es' && manifest.start_url === '/' && manifest.scope === '/' &&
    manifest.display === 'standalone' && manifest.prefer_related_applications === false &&
    /^#[a-f0-9]{6}$/i.test(manifest.background_color) && /^#[a-f0-9]{6}$/i.test(manifest.theme_color),
  'pwa_manifest_identity_invalid');
  const allowed = new Set(['id', 'name', 'short_name', 'lang', 'start_url', 'scope', 'display',
    'prefer_related_applications', 'background_color', 'theme_color', 'icons']);
  ensure(Object.keys(manifest).every(key => allowed.has(key)), 'pwa_manifest_fields_invalid');
  ensure(Array.isArray(manifest.icons) && manifest.icons.length === 4, 'pwa_manifest_icons_invalid');
  const files = [{ path: '/manifest.webmanifest', contentType: 'application/manifest+json', bytes: manifestBytes }];
  const combinations = new Set(), paths = new Set();
  for (const icon of manifest.icons) {
    ensure(icon && icon.type === 'image/png' && ['any', 'maskable'].includes(icon.purpose) &&
      ['192x192', '512x512'].includes(icon.sizes), 'pwa_manifest_icons_invalid');
    const name = localUrl(icon.src);
    ensure(name.endsWith('.png') && !paths.has(name) && !combinations.has(icon.sizes + ':' + icon.purpose),
      'pwa_manifest_icons_invalid');
    const bytes = asset(directory, name), size = Number(icon.sizes.split('x')[0]), dimensions = pngDimensions(bytes);
    ensure(dimensions.width === size && dimensions.height === size, 'pwa_icon_dimensions_mismatch');
    paths.add(name); combinations.add(icon.sizes + ':' + icon.purpose);
    files.push({ path: icon.src, contentType: 'image/png', bytes });
  }
  for (const [name, size] of [['apple-touch-icon.png', 180], ['favicon-32x32.png', 32]]) {
    const bytes = asset(directory, name), dimensions = pngDimensions(bytes);
    ensure(dimensions.width === size && dimensions.height === size, 'pwa_icon_dimensions_mismatch');
    files.push({ path: '/' + name, contentType: 'image/png', bytes });
  }
  ensure(htmlLinks.some(link => link.rel === 'apple-touch-icon' && link.href === '/apple-touch-icon.png'),
    'pwa_apple_icon_link_invalid');
  ensure(htmlLinks.some(link => link.rel === 'icon' && link.type === 'image/svg+xml' && link.href === '/favicon.svg'),
    'pwa_favicon_link_invalid');
  const svg = asset(directory, 'favicon.svg');
  ensure(/<svg\b/.test(svg.toString()) && /<path\b/.test(svg.toString()) &&
    !/<(?:image|script|foreignObject)\b|data:image|\bon\w+\s*=/i.test(svg.toString()), 'pwa_favicon_vector_required');
  files.push({ path: '/favicon.svg', contentType: 'image/svg+xml', bytes: svg });
  const ico = asset(directory, 'favicon.ico');
  ensure(ico.length >= 22 && ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1 &&
    ico.readUInt16LE(4) > 0 && 6 + ico.readUInt16LE(4) * 16 <= ico.length, 'pwa_favicon_ico_invalid');
  files.push({ path: '/favicon.ico', contentType: 'image/vnd.microsoft.icon', bytes: ico });
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => attributes(tag));
  ensure(meta.some(item => item.name === 'theme-color' && item.content === manifest.theme_color), 'pwa_theme_color_mismatch');
  files.push({ path: '/', contentType: 'text/html', bytes: Buffer.from(html, 'utf8') });
  return { files: files.map(file => ({ path: file.path, contentType: file.contentType,
    bytes: file.bytes.length, sha256: sha(file.bytes) })) };
}

async function limitedBytes(response, limit) {
  const declared = response.headers.get('content-length');
  ensure(declared === null || /^\d+$/.test(declared) && Number(declared) <= limit, 'pwa_public_asset_size_invalid');
  ensure(response.body, 'pwa_public_asset_body_missing');
  const reader = response.body.getReader(), chunks = [];
  let length = 0, complete = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { complete = true; break; }
      length += value.length;
      ensure(length <= limit, 'pwa_public_asset_size_invalid');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } finally {
    if (!complete) await reader.cancel();
    reader.releaseLock();
  }
}

export async function verifyPublishedPwaAssets(directory, { request = fetch } = {}) {
  const profile = validatePwaAssets(directory);
  if (!profile) return { pwa_assets_verified: false, pwa_profile: 'historical_without_manifest' };
  for (const file of profile.files) {
    let response;
    try {
      response = await request('https://nodia-1ge.pages.dev' + file.path, { method: 'GET', redirect: 'error',
        cache: 'no-store', headers: { Accept: file.contentType }, signal: AbortSignal.timeout(20_000) });
    } catch { throw new Error('pwa_public_asset_request_failed'); }
    ensure(response.status === 200, 'pwa_public_asset_status_invalid');
    const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    const allowedMime = file.contentType === 'image/vnd.microsoft.icon'
      ? ['image/vnd.microsoft.icon', 'image/x-icon'] : [file.contentType];
    ensure(allowedMime.includes(mime), 'pwa_public_asset_mime_invalid');
    const bytes = await limitedBytes(response, file.bytes);
    ensure(bytes.length === file.bytes && sha(bytes) === file.sha256, 'pwa_public_asset_digest_mismatch');
  }
  return { pwa_assets_verified: true, pwa_assets_count: profile.files.length };
}
