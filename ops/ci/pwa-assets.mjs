// Validate already built PWA assets; never build or install a service worker.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';

const ensure = (value, code) => { if (!value) throw new Error(code); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const maxAssetBytes = 2 * 1024 * 1024;
const workerName = 'service-worker.js';
const workerPath = '/' + workerName;
const releasePath = '/pwa-release.json';
const teacherReaderPath = '/nodia-teacher/downloads';
const teacherReaderFile = teacherReaderPath.slice(1) + '.html';
const versionedAssetPath = /^\/assets\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2)$/;
const publicFailureCodes = new Set(['pwa_public_asset_request_failed', 'pwa_public_asset_status_invalid',
  'pwa_public_asset_mime_invalid', 'pwa_public_asset_body_missing', 'pwa_public_asset_size_invalid',
  'pwa_public_asset_digest_mismatch']);
const installationPaths = new Set(['/', '/manifest.webmanifest', '/apple-touch-icon.png', '/favicon-32x32.png',
  '/favicon.svg', '/favicon.ico', releasePath, teacherReaderPath, '/icons/icon-192.png', '/icons/icon-512.png',
  '/icons/icon-maskable-192.png', '/icons/icon-maskable-512.png', workerPath]);
export function pwaVerificationDetails(value) {
  const result = {};
  if (installationPaths.has(value?.pwa_failed_asset_path)) result.pwa_failed_asset_path = value.pwa_failed_asset_path;
  if (Number.isSafeInteger(value?.pwa_verification_attempts) && value.pwa_verification_attempts >= 1 &&
    value.pwa_verification_attempts <= 25) result.pwa_verification_attempts = value.pwa_verification_attempts;
  return result;
}
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

function validateTeacherReader(directory, reader, allowed) {
  const bytes = asset(directory, teacherReaderFile);
  const html = bytes.toString('utf8');
  ensure(reader && reader.html === html && Array.isArray(reader.assets) &&
    reader.assets.length > 0 && reader.assets.length <= 32, 'pwa_teacher_reader_invalid');
  const names = new Set();
  let size = bytes.length;
  const assets = reader.assets.map(item => {
    ensure(item && typeof item.path === 'string' && allowed.has(item.path) && !names.has(item.path), 'pwa_teacher_reader_asset_invalid');
    const content = asset(directory, item.path.slice(1));
    const digest = sha(content);
    ensure(content.length === item.bytes && digest === item.sha256, 'pwa_teacher_reader_asset_mismatch');
    names.add(item.path);
    size += content.length;
    return { path: item.path, bytes: content.length, sha256: digest };
  });
  ensure(size <= 512 * 1024 && JSON.stringify({ html, assets }) === JSON.stringify(reader), 'pwa_teacher_reader_invalid');
  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map(([tag]) => attributes(tag).src);
  const styles = links(html).filter(link => ['modulepreload', 'stylesheet'].includes(link.rel)).map(link => link.href);
  ensure(scripts.length > 0 && [...scripts, ...styles].every(url => names.has(url)), 'pwa_teacher_reader_entry_mismatch');
  return bytes;
}

function validateUpdateRelease(directory, html, version, worker, readerRequired) {
  const bytes = asset(directory, releasePath.slice(1));
  ensure(/^[a-f0-9]{24}$/.test(version) && typeof worker === 'string' &&
    bytes.toString('utf8') === `${JSON.stringify({ version })}\n`, 'pwa_update_version_invalid');
  const marker = /^const nodiaRelease = (\{[^\r\n]+\});\n/.exec(worker);
  ensure(marker, 'pwa_update_worker_metadata_missing');
  let release;
  try { release = JSON.parse(marker[1]); } catch { throw new Error('pwa_update_worker_metadata_invalid'); }
  const { entry, assets, teacherReader } = release;
  ensure(JSON.stringify({ version, entry, assets, teacherReader }) === marker[1] && Array.isArray(entry) && entry.length > 0 &&
    Array.isArray(assets) && new Set(assets).size === assets.length &&
    assets.every(url => typeof url === 'string' && versionedAssetPath.test(url)), 'pwa_update_worker_metadata_invalid');
  const allowed = new Set(assets);
  const entryTags = html.match(/<script\b[^>]*src="[^"]+"[^>]*>|<link\b[^>]*rel="stylesheet"[^>]*>/g) ?? [];
  const scripts = [...new Set([...entryTags.join('\n').matchAll(/\b(?:href|src)="(\/assets\/[^"?#]+)"/g)]
    .map(match => match[1]).filter(url => allowed.has(url)))];
  ensure(JSON.stringify(entry) === JSON.stringify(scripts), 'pwa_update_entry_mismatch');
  for (const url of assets) asset(directory, url.slice(1));
  const reader = readerRequired || teacherReader !== undefined ? validateTeacherReader(directory, teacherReader, allowed) : undefined;
  return { bytes, reader, workerSourceSha: sha(worker.slice(marker[0].length)) };
}

export function validatePwaAssets(directory, { required = false, workerRequired = false, updateRequired = false, readerRequired = false } = {}) {
  const html = asset(directory, 'index.html').toString('utf8');
  const htmlLinks = links(html), manifestLinks = htmlLinks.filter(link => link.rel?.toLowerCase() === 'manifest');
  const present = fs.existsSync(path.join(directory, 'manifest.webmanifest'));
  const workerPresent = fs.existsSync(path.join(directory, workerName));
  const hasReader = readerRequired || fs.existsSync(path.join(directory, teacherReaderFile));
  // Historical pre-PWA releases can still be reconciled or rolled back without inventing a manifest.
  if (!required && !present && !workerRequired && !workerPresent && !updateRequired && !hasReader && manifestLinks.length === 0) return null;
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
  const svg = asset(directory, 'favicon.svg');
  // Preserve historical releases while binding cache-versioned URLs to this exact shared PWA mark.
  const faviconUrls = new Set(['/favicon.svg', `/favicon.svg?v=${sha(svg).slice(0, 12)}`]);
  ensure(htmlLinks.some(link => link.rel === 'icon' && link.type === 'image/svg+xml' && faviconUrls.has(link.href)),
    'pwa_favicon_link_invalid');
  ensure(/<svg\b/.test(svg.toString()) && /<path\b/.test(svg.toString()) &&
    !/<(?:image|script|foreignObject)\b|data:image|\bon\w+\s*=/i.test(svg.toString()), 'pwa_favicon_vector_required');
  files.push({ path: '/favicon.svg', contentType: 'image/svg+xml', bytes: svg });
  const ico = asset(directory, 'favicon.ico');
  ensure(ico.length >= 22 && ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1 &&
    ico.readUInt16LE(4) > 0 && 6 + ico.readUInt16LE(4) * 16 <= ico.length, 'pwa_favicon_ico_invalid');
  files.push({ path: '/favicon.ico', contentType: 'image/vnd.microsoft.icon', bytes: ico });
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => attributes(tag));
  ensure(meta.some(item => item.name === 'theme-color' && item.content === manifest.theme_color), 'pwa_theme_color_mismatch');
  const versions = meta.filter(item => item.name === 'nodia-release');
  const hasUpdate = updateRequired || hasReader || versions.length > 0 || fs.existsSync(path.join(directory, releasePath.slice(1)));
  let workerSourceSha;
  if (workerRequired || workerPresent || hasUpdate) {
    const bytes = asset(directory, workerName);
    const worker = bytes.toString('utf8');
    try { new Script(worker); } catch { throw new Error('pwa_service_worker_script_invalid'); }
    workerSourceSha = sha(bytes);
    files.push({ path: workerPath, contentType: 'application/javascript', bytes });
    if (hasUpdate) {
      ensure(versions.length === 1, 'pwa_update_version_invalid');
      const update = validateUpdateRelease(directory, html, versions[0].content, worker, hasReader);
      workerSourceSha = update.workerSourceSha;
      files.push({ path: releasePath, contentType: 'application/json', bytes: update.bytes });
      if (update.reader) files.push({ path: teacherReaderPath, contentType: 'text/html', bytes: update.reader });
    }
  }
  files.push({ path: '/', contentType: 'text/html', bytes: Buffer.from(html, 'utf8') });
  return { workerSourceSha, files: files.map(file => ({ path: file.path, contentType: file.contentType,
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

export async function verifyPublishedPwaAssets(directory, { request = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = () => performance.now(),
  timeoutMs = 120_000, pollIntervalMs = 5_000, pollLimit = 25 } = {}) {
  const profile = validatePwaAssets(directory);
  if (!profile) return { pwa_assets_verified: false, pwa_profile: 'historical_without_manifest' };
  ensure(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 120_000 &&
    Number.isInteger(pollIntervalMs) && pollIntervalMs > 0 && pollIntervalMs <= 5_000 &&
    Number.isInteger(pollLimit) && pollLimit > 0 && pollLimit <= 25, 'pwa_public_verification_budget_invalid');
  const deadline = now() + timeoutMs;
  let failure;
  // Pages' canonical API identity can advance before the public alias converges.
  // Repeat complete, strictly verified snapshots only. This function never publishes or authenticates.
  for (let attempt = 1; attempt <= pollLimit; attempt++) {
    try {
      for (const file of profile.files) {
        let response;
        try {
          const remaining = Math.ceil(deadline - now());
          ensure(remaining > 0, 'pwa_public_asset_request_failed');
          response = await request('https://nodia-1ge.pages.dev' + file.path, { method: 'GET', redirect: 'error',
            cache: 'no-store', headers: { Accept: file.contentType },
            signal: AbortSignal.timeout(Math.min(20_000, remaining)) });
          ensure(response.status === 200, 'pwa_public_asset_status_invalid');
          const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
          const allowedMime = file.contentType === 'image/vnd.microsoft.icon'
            ? ['image/vnd.microsoft.icon', 'image/x-icon'] : file.path === workerPath
              ? ['application/javascript', 'text/javascript'] : [file.contentType];
          ensure(allowedMime.includes(mime), 'pwa_public_asset_mime_invalid');
          const bytes = await limitedBytes(response, file.bytes);
          ensure(bytes.length === file.bytes && sha(bytes) === file.sha256, 'pwa_public_asset_digest_mismatch');
          ensure(now() < deadline, 'pwa_public_asset_request_failed');
        } catch (error) {
          const code = error instanceof Error && publicFailureCodes.has(error.message)
            ? error.message : 'pwa_public_asset_request_failed';
          throw Object.assign(new Error(code), pwaVerificationDetails({ pwa_failed_asset_path: file.path,
            pwa_verification_attempts: attempt }));
        } finally {
          // Release unread error responses before polling again; never retain remote bodies.
          try { await response?.body?.cancel(); } catch { /* Already consumed or canceled. */ }
        }
      }
      return { pwa_assets_verified: true, pwa_assets_count: profile.files.length, pwa_verification_attempts: attempt };
    } catch (error) { failure = error; }
    const remaining = deadline - now();
    if (attempt === pollLimit || remaining <= 0) break;
    await sleep(Math.min(pollIntervalMs, remaining));
    if (now() >= deadline) break;
  }
  throw failure;
}
