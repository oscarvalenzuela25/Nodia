import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import {
  NODIA_AI_DELETION_JOURNAL,
  type NodiaAiDeletionJournalPort,
} from '../../nodia-ai-recovery/types/deletion-journal.js';
import type { PrepareNodiaCvApplicationDocumentDto } from '../dto/nodia-cv-application-document.dto.js';
import type {
  CopyNodiaCvVersionDto,
  ListNodiaCvVersionsDto,
  PrepareNodiaCvPdfDto,
  SaveNodiaCvVersionDto,
} from '../dto/nodia-cv-pdf-version.dto.js';
import { NodiaCvGenerationScope } from '../nodia-cv-generation-scope.service.js';
import { NodiaCvGenerationStore } from '../nodia-cv-generation.store.js';
import { NodiaCvPdfVersionsStore } from '../nodia-cv-pdf-versions.store.js';
import { composeCvApplicationDocument } from '../pdf/nodia-cv-application-document.js';
import {
  CV_PDF_RENDERER,
  NodiaCvPdfRenderer,
  snapshotCvPdfSource,
  type CvPdfSource,
  type CvPdfTemplate,
} from '../pdf/nodia-cv-pdf-renderer.service.js';
import { cvGenerationError } from '../policies/nodia-cv-generation-errors.js';
import {
  recoverableGeneration,
  requireLiveCvGeneration,
} from '../policies/nodia-cv-generation-status.js';
import { protectNodiaCvDelete } from '../policies/nodia-cv-protected-delete.js';
import {
  CV_VERSION_COPY_PURPOSE,
  prepareCvVersionDraft,
} from '../policies/nodia-cv-version-draft.js';
import type { CvGenerationRow } from '../types/nodia-cv-generation.types.js';

type RenderedPdf = Awaited<ReturnType<NodiaCvPdfRenderer['render']>>;
type CurrentDraft = CvGenerationRow & {
  profile_id: string;
  profile_snapshot: CvPdfSource['profile'];
  draft: CvPdfSource['draft'];
  review: CvPdfSource['review'];
  review_revision: number;
  offer_text: string;
};
type OwnerTransaction<T> = (
  manager: EntityManager,
  owner: string,
) => Promise<T>;

const sha256 = (input: string | Buffer) =>
  createHash('sha256').update(input).digest('hex');

function assertPdfIntegrity(pdf: { bytes: Buffer; sha256: string }) {
  if (sha256(pdf.bytes) !== pdf.sha256)
    cvGenerationError('pdf_integrity_failed', 500);
}

function sourceOf(draft: CurrentDraft): CvPdfSource {
  return {
    language: draft.language,
    profile: draft.profile_snapshot,
    draft: draft.draft,
    review: draft.review,
  };
}

@Injectable()
export class NodiaCvPdfVersionsUseCase {
  private readonly renders = new Map<string, Promise<RenderedPdf>>();

  constructor(
    private readonly scope: NodiaCvGenerationScope,
    private readonly generations: NodiaCvGenerationStore,
    private readonly store: NodiaCvPdfVersionsStore,
    private readonly renderer: NodiaCvPdfRenderer,
    @Optional() @Inject(NODIA_AI_DELETION_JOURNAL)
    private readonly deletionJournal?: NodiaAiDeletionJournalPort,
  ) {}

  async prepare(
    actor: ActorReference,
    id: string,
    input: PrepareNodiaCvPdfDto,
  ) {
    const identity = { template: input.template, renderer: CV_PDF_RENDERER };
    const admission = await this.authorized(actor, async (manager, owner) => {
      const draft = await this.draft(manager, owner, id, input.revision);
      const existing = await this.store.prepared(manager, draft, identity);
      if (existing)
        return { artifact: { ...existing, expires_at: draft.expires_at } };
      return { draft };
    });
    if (admission.artifact) return admission.artifact;

    // Rendering and reading never hold a PostgreSQL transaction or authority lock.
    const pdf = await this.render(admission.draft, input.template);
    return this.authorized(actor, async (manager, owner) => {
      const draft = await this.draft(
        manager,
        owner,
        admission.draft.id,
        input.revision,
      );
      const existing = await this.store.prepared(manager, draft, identity);
      const artifact =
        existing ??
        (await this.store.insertPrepared(
          manager,
          draft,
          randomUUID(),
          input.template,
          pdf,
        ));
      return { ...artifact, expires_at: draft.expires_at };
    });
  }

  draftPdf(actor: ActorReference, id: string, artifactId: string) {
    return this.authorized(actor, async (manager, owner) => {
      const draft = await this.draft(manager, owner, id);
      const pdf = await this.store.draftPdf(manager, draft, artifactId);
      if (!pdf) cvGenerationError('pdf_not_found', 404);
      assertPdfIntegrity(pdf);
      return {
        bytes: pdf.bytes,
        sha256: pdf.sha256,
        filename: `nodia-cv-${pdf.template}-${pdf.language}.pdf`,
      };
    });
  }

  async applicationDocumentPdf(
    actor: ActorReference,
    id: string,
    input: PrepareNodiaCvApplicationDocumentDto,
  ) {
    const language = await this.authorized(actor, async (manager, owner) =>
      (await this.draft(manager, owner, id, input.revision)).language,
    );
    const document = composeCvApplicationDocument(language, input);
    const pdf = await this.renderer.renderDocument(document, 'classic');
    if (pdf.page_count !== 1) cvGenerationError('pdf_limits', 422);
    assertPdfIntegrity(pdf);
    const filename =
      input.kind === 'cover'
        ? 'nodia-cover-letter.pdf'
        : 'nodia-recommendation-draft.pdf';
    return this.authorized(actor, async (manager, owner) => {
      await this.draft(manager, owner, id, input.revision);
      return { bytes: pdf.bytes, sha256: pdf.sha256, filename };
    });
  }

  list(actor: ActorReference, query: ListNodiaCvVersionsDto) {
    return this.authorized(actor, (manager, owner) =>
      this.store.list(manager, owner, query.page, query.limit),
    );
  }

  detail(actor: ActorReference, id: string) {
    return this.authorized(actor, (manager, owner) =>
      this.version(manager, owner, id),
    );
  }

  copy(actor: ActorReference, id: string, input: CopyNodiaCvVersionDto) {
    const sourceId = id.toLowerCase();
    const request = { key: input.request_key };
    const requestHash = sha256(
      JSON.stringify([CV_VERSION_COPY_PURPOSE, sourceId]),
    );
    const replay = (row: CvGenerationRow | null) => {
      if (!row) cvGenerationError('request_failed', 500);
      requireLiveCvGeneration(row);
      if (row.request_hash !== requestHash)
        cvGenerationError('request_key_conflict');
      return recoverableGeneration(row);
    };
    return this.scope.transaction(async (manager) => {
      const current = await this.scope.authorize(manager, actor);
      const previous = await this.generations.status(
        manager,
        current.actorId,
        request,
      );
      if (previous) return replay(previous);

      const version = await this.store.draftSource(
        manager,
        current.actorId,
        sourceId,
      );
      if (!version) cvGenerationError('version_not_found', 404);
      const row = await this.generations.copyVersion(manager, {
        ...prepareCvVersionDraft(version),
        id: randomUUID(),
        owner: current.actorId,
        sessionId: current.sessionId,
        requestKey: request.key,
        requestHash,
        vacancyTitle: version.vacancy_title,
        vacancyCompany: version.vacancy_company,
      });
      // The unique owner/request key pairs the originating receipt with its copy.
      return replay(
        row ??
          (await this.generations.status(manager, current.actorId, request)),
      );
    }, true);
  }

  versionPdf(actor: ActorReference, id: string) {
    return this.authorized(actor, async (manager, owner) => {
      const pdf = await this.store.versionPdf(manager, owner, id);
      if (!pdf) cvGenerationError('version_not_found', 404);
      assertPdfIntegrity(pdf);
      return {
        bytes: pdf.bytes,
        sha256: pdf.sha256,
        filename: `nodia-cv-${pdf.version_number}.pdf`,
      };
    });
  }

  save(actor: ActorReference, input: SaveNodiaCvVersionDto) {
    const hash = sha256(
      JSON.stringify([
        input.generation_id.toLowerCase(),
        input.revision,
        input.artifact_id.toLowerCase(),
        input.sha256,
      ]),
    );
    return this.authorized(actor, async (manager, owner) => {
      await this.store.lockVersions(manager, owner);
      const previous = await this.store.receipt(
        manager,
        owner,
        input.request_key,
      );
      if (previous) {
        if (previous.request_hash !== hash)
          cvGenerationError('idempotency_conflict');
        return this.version(manager, owner, previous.version_id);
      }

      const draft = await this.draft(
        manager,
        owner,
        input.generation_id,
        input.revision,
      );
      const pdf = await this.store.draftPdf(manager, draft, input.artifact_id);
      if (!pdf || pdf.sha256 !== input.sha256) cvGenerationError('pdf_stale');
      assertPdfIntegrity(pdf);

      let id = await this.store.versionByArtifact(manager, owner, pdf.id);
      if (!id) {
        id = randomUUID();
        const { requirements, selectedFacts, remainingFacts } = draft.draft;
        const evidenceIds = new Set(
          requirements.flatMap(({ evidenceIds }) => evidenceIds),
        );
        const requirementIds = new Set(requirements.map(({ id }) => id));
        await this.store.insertVersion(manager, draft, pdf, {
          id,
          profileName: draft.profile_snapshot.profile_name,
          analysis: {
            requirements,
            facts: [...selectedFacts, ...remainingFacts].filter(({ id }) =>
              evidenceIds.has(id),
            ),
            evidence: draft.review.evidence.filter(({ requirement_id }) =>
              requirementIds.has(requirement_id),
            ),
            ...(draft.draft.technologyOptions
              ? { technology_options: draft.draft.technologyOptions }
              : {}),
            ...(draft.review.technologies ? { technologies: draft.review.technologies } : {}),
          },
          snapshot: {
            ...snapshotCvPdfSource(sourceOf(draft)),
            profile_id: draft.profile_id,
            profile_revision: draft.profile_revision,
            review_revision: draft.review_revision,
            offer_sha256:
              draft.source_version?.offer_sha256 ?? sha256(draft.offer_text),
          },
        });
      }
      await this.store.addReceipt(manager, owner, input.request_key, id, hash);
      return this.version(manager, owner, id);
    });
  }

  remove(actor: ActorReference, id: string) {
    return protectNodiaCvDelete(
      this.deletionJournal,
      () => this.authorized(actor, async (manager, owner) => {
        const intent = await this.store.versionDeletionIntent(manager, owner, id);
        if (!intent) cvGenerationError('version_not_found', 404);
        return { resource: { kind: 'cv_version', version_id: intent.id }, now: intent.now };
      }),
      () => this.authorized(actor, async (manager, owner) => {
        await this.store.lockVersions(manager, owner);
        if (!(await this.store.deleteVersion(manager, owner, id)))
          cvGenerationError('version_not_found', 404);
      }),
    );
  }

  private authorized<T>(actor: ActorReference, work: OwnerTransaction<T>) {
    return this.scope.transaction(async (manager) => {
      const current = await this.scope.authorize(manager, actor);
      return work(manager, current.actorId);
    });
  }

  private async draft(
    manager: EntityManager,
    owner: string,
    id: string,
    revision?: number,
  ): Promise<CurrentDraft> {
    const row = await this.generations.status(manager, owner, { id }, true);
    if (!row || row.qualification)
      cvGenerationError('generation_not_found', 404);
    const profileId = requireLiveCvGeneration(row);
    if (
      row.state !== 'ready' ||
      !row.profile_snapshot ||
      !row.draft ||
      !row.review ||
      row.review_revision === null ||
      row.offer_text === null
    )
      cvGenerationError('draft_not_ready');
    if (revision !== undefined && row.review_revision !== revision)
      cvGenerationError('stale_draft');
    return {
      ...row,
      profile_id: profileId,
      profile_snapshot: row.profile_snapshot,
      draft: row.draft,
      review: row.review,
      review_revision: row.review_revision,
      offer_text: row.offer_text,
    };
  }

  private render(draft: CurrentDraft, template: CvPdfTemplate) {
    const key = JSON.stringify([
      draft.owner_user_id,
      draft.id,
      draft.review_revision,
      template,
      CV_PDF_RENDERER,
    ]);
    const existing = this.renders.get(key);
    if (existing) return existing;
    const work = this.renderer
      .render(sourceOf(draft), template)
      .then((pdf) => {
        if (pdf.renderer !== CV_PDF_RENDERER)
          cvGenerationError('pdf_integrity_failed', 500);
        assertPdfIntegrity(pdf);
        return pdf;
      })
      .finally(() => this.renders.delete(key));
    this.renders.set(key, work);
    return work;
  }

  private async version(manager: EntityManager, owner: string, id: string) {
    const detail = await this.store.detail(manager, owner, id);
    if (!detail) cvGenerationError('version_not_found', 404);
    return detail;
  }
}
