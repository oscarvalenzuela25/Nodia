import 'reflect-metadata';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  realpath,
  writeFile,
  rm,
  readdir,
  lstat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CodexRpc } from '../dist/common/ai/codex/codex-rpc.js';
import { CodexRuntimeService } from '../dist/common/ai/codex/codex-runtime.service.js';
import { codexDocument } from '../dist/common/ai/codex/codex-document.js';

// No .env, database, real credentials, login or generation. Real native startup is
// opt-in; fake JSONL and the actual PDF worker always run in disposable profiles.
const root = await realpath(
  await mkdtemp(join(tmpdir(), 'nodia-codex-contract-')),
);
let runtime;
try {
  if (process.platform !== 'win32') {
    const peer = join(root, 'peer');
    await writeFile(
      peer,
      `#!${process.execPath}\nimport ${JSON.stringify(new URL('./fixtures/codex-peer.mjs', import.meta.url).href)};\n`,
      { mode: 0o700 },
    );
    process.env.NODIA_SYNTHETIC_SECRET = 'must-not-be-inherited';
    for (const method of [
      'peer/echo',
      'peer/tool',
      'peer/invalid',
      'peer/overflow',
      'peer/crash',
      'peer/hang',
    ]) {
      const rpc = new CodexRpc(peer, root, root, root);
      try {
        await rpc.initialize();
        if (method === 'peer/echo') {
          assert.deepEqual(
            await rpc.request(method, { text: 'Factura sintética 😀' }),
            { text: 'Factura sintética 😀' },
          );
          const env = await rpc.request('peer/env');
          assert(!env.includes('NODIA_SYNTHETIC_SECRET'));
          assert(!env.includes('OPENAI_API_KEY'));
        } else if (method === 'peer/tool') {
          let rejected = 0;
          rpc.on('toolRejected', () => rejected++);
          await rpc.request(method);
          assert.equal(rejected, 1);
        } else
          await assert.rejects(rpc.request(method, {}, 200), (e) =>
            [502, 503, 504].includes(e.getStatus()),
          );
      } finally {
        await rpc.close();
        assert.equal(rpc.alive, false);
      }
    }
    delete process.env.NODIA_SYNTHETIC_SECRET;
  }
  const pdf = (pages) => {
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pages} >>`,
    ];
    for (let i = 0; i < pages; i++) {
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents ${4 + i * 2} 0 R >>`,
      );
      const content = '0 0 1 rg 10 10 150 150 re f\n';
      objects.push(
        `<< /Length ${content.length} >>\nstream\n${content}endstream`,
      );
    }
    let text = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(text));
      text += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = Buffer.byteLength(text);
    text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
      .join(
        '',
      )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(text);
  };
  const work = join(root, 'documents');
  await import('node:fs/promises').then(({ mkdir }) =>
    mkdir(work, { mode: 0o700 }),
  );
  const images = await codexDocument(
    pdf(2),
    'application/pdf',
    work,
    AbortSignal.timeout(20000),
  );
  assert.equal(images.length, 2);
  assert(images.every((v) => v.url.startsWith('data:image/png;base64,')));
  assert.deepEqual(await readdir(work), []);
  await assert.rejects(
    codexDocument(pdf(9), 'application/pdf', work, AbortSignal.timeout(20000)),
  );
  await assert.rejects(
    codexDocument(
      Buffer.from('%PDF-invalid'),
      'application/pdf',
      work,
      AbortSignal.timeout(20000),
    ),
  );
  const cancellation = new AbortController();
  cancellation.abort();
  await assert.rejects(
    codexDocument(pdf(2), 'application/pdf', work, cancellation.signal),
  );
  assert.deepEqual(await readdir(work), []);
  if (process.argv.includes('--runtime')) {
    process.env.NODIA_CODEX_ENABLED = 'true';
    process.env.NODIA_CODEX_PROFILE_ROOT = join(root, 'profiles');
    runtime = new CodexRuntimeService();
    const lease = await runtime.acquire('42');
    assert(lease.profile.rpc.alive);
    await assert.rejects(runtime.acquire('42'), (e) => e.getStatus() === 409);
    assert.equal((await runtime.observe('42')).authenticated, false);
    await assert.rejects(
      runtime.listModels('42'),
      (e) => e.getStatus() === 409,
    );
    const other = await runtime.get('43');
    assert.notEqual(other.cwd, lease.profile.cwd);
    if (process.platform !== 'win32')
      assert.equal((await lstat(join(root, 'profiles', '42'))).mode & 0o077, 0);
    lease.release();
    await runtime.onModuleDestroy();
    runtime = undefined;
    assert(
      !(await readdir(join(root, 'profiles', '42'))).includes('nodia.lock'),
    );
  }
  await (await import('./codex-http.integration.mjs')).codexHttpContracts();
  console.log(
    'Codex contracts passed: JSONL, isolated environment, tools, failure/timeout/shutdown, PDF limits/cleanup' +
      (process.argv.includes('--runtime')
        ? ', native runtime without authentication.'
        : '.'),
  );
} finally {
  await runtime?.onModuleDestroy();
  await rm(root, { recursive: true, force: true });
}
