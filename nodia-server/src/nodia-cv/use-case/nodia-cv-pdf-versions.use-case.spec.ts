import { ForbiddenException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { NodiaCvGenerationScope } from '../nodia-cv-generation-scope.service.js';
import type { NodiaCvGenerationStore } from '../nodia-cv-generation.store.js';
import type { NodiaCvPdfVersionsStore } from '../nodia-cv-pdf-versions.store.js';
import {
  CV_PDF_RENDERER,
  type NodiaCvPdfRenderer,
} from '../pdf/nodia-cv-pdf-renderer.service.js';
import type { CvGenerationRow } from '../types/nodia-cv-generation.types.js';
import { NodiaCvPdfVersionsUseCase } from './nodia-cv-pdf-versions.use-case.js';

const actor = { userId: '121', sessionId: randomUUID() };
const id = randomUUID();

function fixture() {
  const manager = {} as EntityManager;
  const transaction = vi.fn(
    async (work: (m: EntityManager) => Promise<unknown>) => work(manager),
  );
  const authorize = vi.fn().mockResolvedValue({ actorId: actor.userId });
  const row = {
    id,
    owner_user_id: actor.userId,
    state: 'ready',
    qualification: false,
    language: 'en',
    profile_id: randomUUID(),
    profile_snapshot: { full_name: 'Synthetic Test' },
    draft: { selectedFacts: [], remainingFacts: [] },
    review: { included_fact_ids: [], evidence: [] },
    review_revision: 1,
    offer_text: 'Synthetic role',
    expires_at: new Date(Date.now() + 60_000),
  } as CvGenerationRow;
  const status = vi.fn().mockResolvedValue(row);
  const prepared = vi.fn().mockResolvedValue(undefined);
  const insertPrepared = vi.fn();
  const bytes = Buffer.from('synthetic renderer reply');
  const output = {
    bytes,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    renderer: CV_PDF_RENDERER,
    page_count: 1,
    extracted_text: 'Synthetic Test',
    missing_contact: true,
  };
  let complete = () => {};
  const pending = new Promise<typeof output>((resolve) => {
    complete = () => resolve(output);
  });
  const render = vi.fn(() => pending);
  const useCase = new NodiaCvPdfVersionsUseCase(
    { transaction, authorize } as unknown as NodiaCvGenerationScope,
    { status } as unknown as NodiaCvGenerationStore,
    { prepared, insertPrepared } as unknown as NodiaCvPdfVersionsStore,
    { render } as unknown as NodiaCvPdfRenderer,
  );
  return { status, row, authorize, insertPrepared, render, complete, useCase };
}

describe('Nodia CV publication fence for verified PDFs', () => {
  it('checks module authority again after the isolated render completes', async () => {
    const test = fixture();
    const work = test.useCase.prepare(actor, id, {
      revision: 1,
      template: 'classic',
    });
    await vi.waitFor(() => expect(test.render).toHaveBeenCalled());
    test.authorize.mockRejectedValueOnce(
      new ForbiddenException('core:module_access_required'),
    );
    test.complete();

    await expect(work).rejects.toMatchObject({ status: 403 });
    expect(test.insertPrepared).not.toHaveBeenCalled();
  });

  it('rejects publishing a PDF when a review advances while it renders', async () => {
    const test = fixture();
    const work = test.useCase.prepare(actor, id, {
      revision: 1,
      template: 'compact',
    });
    await vi.waitFor(() => expect(test.render).toHaveBeenCalled());
    test.status.mockResolvedValueOnce({ ...test.row, review_revision: 2 });
    test.complete();

    await expect(work).rejects.toMatchObject({
      status: 409,
      message: 'nodiaCv:stale_draft',
    });
    expect(test.insertPrepared).not.toHaveBeenCalled();
  });
});
