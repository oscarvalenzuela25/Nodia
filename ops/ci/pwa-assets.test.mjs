import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { pngDimensions, validatePwaAssets, verifyPublishedPwaAssets } from './pwa-assets.mjs';
import { png, pwaFixture } from './fixtures/pwa-assets.mjs';
import { assetTools, staticAssets } from './cd-pages.mjs';

const root = fileURLToPath(new URL('../../.tmp/ci/pwa-assets/', import.meta.url));
fs.mkdirSync(root, { recursive: true });
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(root, 'case-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, ...pwaFixture(directory) };
}
function publicRequest(directory, change = value => value) {
  return async (url, options) => {
    assert.equal(new URL(url).origin, 'https://nodia-1ge.pages.dev');
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Authorization, undefined);
    const pathname = new URL(url).pathname;
    const contentType = pathname === '/' ? 'text/html' : pathname.endsWith('.webmanifest') ? 'application/manifest+json' :
      pathname.endsWith('.svg') ? 'image/svg+xml' : pathname.endsWith('.ico') ? 'image/vnd.microsoft.icon' : 'image/png';
    return change(new Response(fs.readFileSync(path.join(directory, pathname === '/' ? 'index.html' : pathname.slice(1))), {
      headers: { 'content-type': contentType }, status: 200,
    }), pathname);
  };
}

test('installation assets have real dimensions and same-origin file references; public hashes and MIME match the build', async t => {
  const f = fixture(t), profile = validatePwaAssets(f.directory, { required: true });
  assert.equal(profile.files.length, 10);
  assert.equal(profile.files[0].path, '/manifest.webmanifest');
  const result = await verifyPublishedPwaAssets(f.directory, { request: publicRequest(f.directory) });
  assert.deepEqual(result, { pwa_assets_verified: true, pwa_assets_count: 10 });
});

test('historical builds remain valid; removing only the manifest or its HTML link cannot silently disable validation', t => {
  const f = fixture(t);
  fs.rmSync(path.join(f.directory, 'manifest.webmanifest'));
  assert.throws(() => validatePwaAssets(f.directory), /pwa_manifest_link_invalid/);
  f.write('index.html', '<!doctype html><title>Historical fixture</title>');
  assert.equal(validatePwaAssets(f.directory), null);
  assert.throws(() => validatePwaAssets(f.directory, { required: true }), /pwa_manifest_link_invalid/);
  f.updateManifest();
  assert.throws(() => validatePwaAssets(f.directory), /pwa_manifest_link_invalid/);
});

test('invalid JSON, scope, executable metadata and native-app preference are rejected', t => {
  const f = fixture(t);
  f.write('manifest.webmanifest', '<!doctype html>SPA fallback');
  assert.throws(() => validatePwaAssets(f.directory), /pwa_manifest_json_invalid/);
  for (const change of [{ scope: '/private/' }, { start_url: 'https://other.invalid/' },
    { prefer_related_applications: true }, { token: 'synthetic-forbidden-metadata' }]) {
    f.write('manifest.webmanifest', JSON.stringify({ ...f.manifest, ...change }));
    assert.throws(() => validatePwaAssets(f.directory), /pwa_manifest_(identity|fields)_invalid/);
  }
});

test('missing, truncated and mismatched PNGs cannot pass by claiming a valid size in JSON', t => {
  const f = fixture(t), name = 'icons/icon-512.png';
  fs.rmSync(path.join(f.directory, name));
  assert.throws(() => validatePwaAssets(f.directory), /pwa_asset_missing/);
  f.write(name, png(32));
  assert.throws(() => validatePwaAssets(f.directory), /pwa_icon_dimensions_mismatch/);
  f.write(name, png(512).subarray(0, 40));
  assert.throws(() => validatePwaAssets(f.directory), /pwa_png_invalid/);
  assert.throws(() => pngDimensions(Buffer.from('<html>fallback</html>')), /pwa_png_invalid/);
});

test('foreign, credential-bearing, encoded and traversing icon URLs are rejected before reading files', t => {
  const f = fixture(t), original = f.manifest.icons[0].src;
  for (const src of ['https://foreign.invalid/icon.png', '//foreign.invalid/icon.png',
    '/icons/../secret.png', '/icons/%2e%2e/secret.png', '/icons/icon.png?token=synthetic', '/icons\\icon.png']) {
    f.manifest.icons[0].src = src; f.updateManifest();
    assert.throws(() => validatePwaAssets(f.directory), /pwa_asset_url_invalid/);
  }
  f.manifest.icons[0].src = original;
});

test('duplicated purposes, embedded raster favicon and theme mismatch are rejected', t => {
  const f = fixture(t);
  f.manifest.icons[2].purpose = 'any'; f.manifest.icons[2].sizes = '192x192'; f.updateManifest();
  assert.throws(() => validatePwaAssets(f.directory), /pwa_manifest_icons_invalid/);
  f.manifest.icons[2].purpose = 'maskable'; f.updateManifest();
  f.write('favicon.svg', '<svg><image href="data:image/png;base64,synthetic"/><path/></svg>');
  assert.throws(() => validatePwaAssets(f.directory), /pwa_favicon_vector_required/);
  f.write('favicon.svg', '<svg><path d="M0 0h1v1z"/></svg>');
  f.manifest.theme_color = '#000000'; f.updateManifest();
  assert.throws(() => validatePwaAssets(f.directory), /pwa_theme_color_mismatch/);
});

test('Pages refuses a partial PWA build before requesting upload tokens', async t => {
  const f = fixture(t);
  fs.rmSync(path.join(f.directory, 'icons/icon-192.png'));
  await assert.rejects(staticAssets(f.directory, { hash: () => 'a'.repeat(32), contentType: () => 'image/png' }), /pwa_asset_missing/);
});

test('Pages upload inventory includes installation assets with their actual public MIME types', async t => {
  const f = fixture(t), content = await staticAssets(f.directory, await assetTools());
  for (const [name, type] of [['/manifest.webmanifest', 'application/manifest+json'],
    ['/icons/icon-192.png', 'image/png'], ['/icons/icon-maskable-512.png', 'image/png'],
    ['/favicon.svg', 'image/svg+xml'], ['/apple-touch-icon.png', 'image/png']]) {
    assert.equal(content.assets.get(content.manifest[name]).contentType, type);
  }
});

test('published SPA fallback, wrong MIME, modified bytes and missing files fail read-only verification', async t => {
  const f = fixture(t);
  for (const change of [
    () => new Response('<html>SPA fallback</html>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('{}', { headers: { 'content-type': 'application/manifest+json' } }),
    () => new Response('', { status: 404 }),
    () => new Response('x', { headers: { 'content-type': 'application/manifest+json', 'content-length': '999999999' } }),
    () => new Response(Buffer.alloc(1024 * 1024), { headers: { 'content-type': 'application/manifest+json' } }),
  ]) {
    await assert.rejects(verifyPublishedPwaAssets(f.directory, { request: publicRequest(f.directory, change) }),
      /pwa_public_asset_(mime_invalid|digest_mismatch|status_invalid|size_invalid)/);
  }
});

test('public entry HTML must also match the artifact, so stale metadata cannot pass with fresh icon URLs', async t => {
  const f = fixture(t);
  await assert.rejects(verifyPublishedPwaAssets(f.directory, { request: publicRequest(f.directory, (response, pathname) =>
    pathname === '/' ? new Response('<title>Historical app</title>', { headers: { 'content-type': 'text/html' } }) : response) }),
  /pwa_public_asset_digest_mismatch/);
});

test('a public read transport failure is sanitized and attempted only once', async t => {
  const f = fixture(t); let calls = 0;
  await assert.rejects(verifyPublishedPwaAssets(f.directory, { request: async () => {
    calls++; throw new Error('private error details');
  } }), error => { assert.equal(error.message, 'pwa_public_asset_request_failed'); return true; });
  assert.equal(calls, 1);
});
