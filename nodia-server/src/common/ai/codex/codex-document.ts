import { imageSize } from 'image-size';
import { BadRequestException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { codexError } from './codex-contract.js';

export async function codexDocument(
  buffer: Buffer,
  mime: string,
  cwd: string,
  signal: AbortSignal,
) {
  if (signal.aborted) throw codexError('codex_cancelled', 499);
  if (mime !== 'application/pdf') {
    let dimensions;
    try {
      dimensions = imageSize(buffer);
    } catch {
      throw new BadRequestException('Imagen inválida.');
    }
    if (
      !dimensions.width ||
      !dimensions.height ||
      Math.max(dimensions.width, dimensions.height) > 4096 ||
      dimensions.width * dimensions.height > 16_000_000
    )
      throw new BadRequestException(
        'La imagen supera el límite de 4096 píxeles por lado o 16 megapíxeles.',
      );
    return [
      {
        type: 'image',
        url: `data:${mime};base64,${buffer.toString('base64')}`,
      },
    ];
  }
  const dir = await mkdtemp(join(cwd, 'pdf-'));
  try {
    await writeFile(join(dir, 'input.pdf'), buffer, { mode: 0o600 });
    const child = spawn(
      process.execPath,
      [
        '--max-old-space-size=256',
        fileURLToPath(
          new URL('../../../../scripts/render-codex-pdf.mjs', import.meta.url),
        ),
        dir,
      ],
      { cwd: dir, env: {}, shell: false, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let output = '';
    let exceeded = false;
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > 4096) {
        exceeded = true;
        child.kill('SIGKILL');
      }
    });
    child.stderr.resume();
    const workerSignal = AbortSignal.any([signal, AbortSignal.timeout(60000)]);
    const abort = () => child.kill('SIGKILL');
    workerSignal.addEventListener('abort', abort, { once: true });
    if (workerSignal.aborted) abort();
    let code: number | null;
    try {
      code = await new Promise<number | null>((resolve, reject) => {
        child.once('close', resolve);
        child.once('error', reject);
      });
    } finally {
      workerSignal.removeEventListener('abort', abort);
    }
    if (workerSignal.aborted)
      throw codexError(
        signal.aborted ? 'codex_cancelled' : 'codex_timeout',
        signal.aborted ? 499 : 504,
      );
    // PDF.js can emit warnings on stdout. A successful worker ends with its count.
    const count = Number(output.trim().split('\n').at(-1));
    if (
      code !== 0 ||
      exceeded ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 8
    )
      throw new BadRequestException(
        'PDF inválido o superior al límite de ocho páginas.',
      );
    const inputs: { type: 'image'; url: string }[] = [];
    let size = 0;
    for (let page = 1; page <= count; page++) {
      const bytes = await readFile(join(dir, `page-${page}.png`));
      size += bytes.length;
      if (size > 24 * 1024 * 1024)
        throw new BadRequestException(
          'El PDF rasterizado excede el tamaño permitido.',
        );
      inputs.push({
        type: 'image',
        url: `data:image/png;base64,${bytes.toString('base64')}`,
      });
    }
    return inputs;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
