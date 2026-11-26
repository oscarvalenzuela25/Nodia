import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type {
  NodiaCvPreparedPdfDto,
  NodiaCvVersionAnalysisDto,
  NodiaCvVersionDetailDto,
  NodiaCvVersionSummaryDto,
} from './dto/nodia-cv-pdf-version.dto.js';
import type {
  CvPdfTemplate,
  NodiaCvPdfRenderer,
} from './pdf/nodia-cv-pdf-renderer.service.js';
import type { CvSavedDraftSource } from './policies/nodia-cv-version-draft.js';
import type { CvGenerationRow } from './types/nodia-cv-generation.types.js';

type CvPdfArtifact = Omit<NodiaCvPreparedPdfDto, 'expires_at'>;
type RenderedPdf = Awaited<ReturnType<NodiaCvPdfRenderer['render']>>;
type DraftIdentity = Pick<
  CvGenerationRow,
  'id' | 'owner_user_id' | 'language'
> & {
  review_revision: number;
};
type PreparedIdentity = { template: CvPdfTemplate; renderer: string };
type CvDraftPdfBytes = CvPdfArtifact & { bytes: Buffer };
type CvSavedPdfBytes = {
  bytes: Buffer;
  sha256: string;
  version_number: number;
};
type CvVersionSummaryJson = Omit<NodiaCvVersionSummaryDto, 'created_at'> & {
  created_at: string;
};

const selection = `id,generation_id,review_revision AS revision,template,language,
  format,renderer,sha256,page_count,extracted_text,missing_contact`;
const summary = `v.id,v.version_number,v.profile_name,v.vacancy_title,v.vacancy_company,
  v.language,v.template,v.created_at`;
const diagnostic =
  'format,renderer,sha256,page_count,extracted_text,missing_contact';

@Injectable()
export class NodiaCvPdfVersionsStore {
  async prepared(
    manager: EntityManager,
    draft: DraftIdentity,
    input: PreparedIdentity,
  ) {
    const [row] = await manager.query<CvPdfArtifact[]>(
      `SELECT ${selection} FROM nodia_cv_draft_pdfs
       WHERE generation_id=$1 AND owner_user_id=$2 AND review_revision=$3 AND template=$4 AND renderer=$5`,
      [
        draft.id,
        draft.owner_user_id,
        draft.review_revision,
        input.template,
        input.renderer,
      ],
    );
    return row;
  }

  async insertPrepared(
    manager: EntityManager,
    draft: DraftIdentity,
    id: string,
    template: CvPdfTemplate,
    pdf: RenderedPdf,
  ) {
    const [row] = await manager.query<CvPdfArtifact[]>(
      `INSERT INTO nodia_cv_draft_pdfs
        (id,generation_id,owner_user_id,review_revision,template,language,
         renderer,sha256,page_count,extracted_text,missing_contact,bytes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING ${selection}`,
      [
        id,
        draft.id,
        draft.owner_user_id,
        draft.review_revision,
        template,
        draft.language,
        pdf.renderer,
        pdf.sha256,
        pdf.page_count,
        pdf.extracted_text,
        pdf.missing_contact,
        pdf.bytes,
      ],
    );
    return row;
  }

  async draftPdf(manager: EntityManager, draft: DraftIdentity, id: string) {
    const [row] = await manager.query<CvDraftPdfBytes[]>(
      `SELECT ${selection},bytes FROM nodia_cv_draft_pdfs
       WHERE generation_id=$1 AND owner_user_id=$2 AND review_revision=$3 AND id=$4`,
      [draft.id, draft.owner_user_id, draft.review_revision, id],
    );
    return row;
  }

  async list(
    manager: EntityManager,
    owner: string,
    page: number,
    limit: number,
  ) {
    const [result] = await manager.query<
      { total: number; items: CvVersionSummaryJson[] }[]
    >(
      `SELECT
        (SELECT count(*)::int FROM nodia_cv_versions WHERE owner_user_id=$1) AS total,
        ARRAY(SELECT row_to_json(page) FROM (
          SELECT ${summary} FROM nodia_cv_versions v WHERE v.owner_user_id=$1
          ORDER BY v.version_number DESC OFFSET $2 LIMIT $3
        ) page) AS items`,
      [owner, (page - 1) * limit, limit],
    );
    return {
      items: result.items.map((item) => ({
        ...item,
        created_at: new Date(item.created_at),
      })),
      total: result.total,
      page,
      limit,
    };
  }

  async detail(manager: EntityManager, owner: string, id: string) {
    const [row] = await manager.query<NodiaCvVersionDetailDto[]>(
      `SELECT ${summary},p.format,p.renderer,p.sha256,p.page_count,p.extracted_text,p.missing_contact,v.analysis
       FROM nodia_cv_versions v JOIN nodia_cv_version_pdfs p
         ON p.version_id=v.id AND p.owner_user_id=v.owner_user_id
       WHERE v.owner_user_id=$1 AND v.id=$2`,
      [owner, id],
    );
    return row;
  }

  async draftSource(manager: EntityManager, owner: string, id: string) {
    const [row] = await manager.query<CvSavedDraftSource[]>(
      `SELECT ${summary},v.snapshot,v.analysis FROM nodia_cv_versions v
       WHERE v.owner_user_id=$1 AND v.id=$2 FOR SHARE OF v`,
      [owner, id],
    );
    return row;
  }

  async versionPdf(manager: EntityManager, owner: string, id: string) {
    const [row] = await manager.query<CvSavedPdfBytes[]>(
      `SELECT p.bytes,p.sha256,v.version_number
       FROM nodia_cv_versions v JOIN nodia_cv_version_pdfs p
         ON p.version_id=v.id AND p.owner_user_id=v.owner_user_id
       WHERE v.owner_user_id=$1 AND v.id=$2`,
      [owner, id],
    );
    return row;
  }

  async lockVersions(manager: EntityManager, owner: string) {
    await manager.query(
      `INSERT INTO nodia_cv_version_counters(owner_user_id) VALUES ($1)
       ON CONFLICT DO NOTHING`,
      [owner],
    );
    await manager.query(
      'SELECT last_number FROM nodia_cv_version_counters WHERE owner_user_id=$1 FOR UPDATE',
      [owner],
    );
  }

  async receipt(manager: EntityManager, owner: string, key: string) {
    const [row] = await manager.query<
      { version_id: string; request_hash: string }[]
    >(
      'SELECT version_id,request_hash FROM nodia_cv_version_save_receipts WHERE owner_user_id=$1 AND request_key=$2',
      [owner, key],
    );
    return row;
  }

  async addReceipt(
    manager: EntityManager,
    owner: string,
    key: string,
    id: string,
    hash: string,
  ) {
    await manager.query(
      `INSERT INTO nodia_cv_version_save_receipts (owner_user_id,request_key,version_id,request_hash)
       VALUES ($1,$2,$3,$4)`,
      [owner, key, id, hash],
    );
  }

  async versionByArtifact(
    manager: EntityManager,
    owner: string,
    artifact: string,
  ) {
    const [row] = await manager.query<{ id: string }[]>(
      'SELECT id FROM nodia_cv_versions WHERE owner_user_id=$1 AND source_artifact_id=$2',
      [owner, artifact],
    );
    return row?.id;
  }

  async insertVersion(
    manager: EntityManager,
    draft: DraftIdentity &
      Pick<CvGenerationRow, 'vacancy_title' | 'vacancy_company'>,
    pdf: CvPdfArtifact,
    version: {
      id: string;
      profileName: string;
      snapshot: unknown;
      analysis: NodiaCvVersionAnalysisDto;
    },
  ) {
    await manager.query(
      `WITH next AS (
        UPDATE nodia_cv_version_counters SET last_number=last_number+1 WHERE owner_user_id=$2
        RETURNING last_number
      )
      INSERT INTO nodia_cv_versions
        (id,owner_user_id,version_number,source_artifact_id,profile_name,
         vacancy_title,vacancy_company,language,template,snapshot,analysis)
      SELECT $1,$2,next.last_number,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb FROM next`,
      [
        version.id,
        draft.owner_user_id,
        pdf.id,
        version.profileName,
        draft.vacancy_title,
        draft.vacancy_company,
        draft.language,
        pdf.template,
        JSON.stringify(version.snapshot),
        JSON.stringify(version.analysis),
      ],
    );
    await manager.query(
      `INSERT INTO nodia_cv_version_pdfs (version_id,owner_user_id,${diagnostic},bytes)
       SELECT $1,$2,${diagnostic},bytes FROM nodia_cv_draft_pdfs
       WHERE id=$3 AND generation_id=$4 AND owner_user_id=$2 AND review_revision=$5`,
      [
        version.id,
        draft.owner_user_id,
        pdf.id,
        draft.id,
        draft.review_revision,
      ],
    );
  }

  async versionDeletionIntent(manager: EntityManager, owner: string, id: string) {
    const [row] = await manager.query<{ id: string; now: Date }[]>(
      'SELECT id,clock_timestamp() AS now FROM nodia_cv_versions WHERE owner_user_id=$1 AND id=$2',
      [owner, id],
    );
    return row;
  }

  async deleteVersion(manager: EntityManager, owner: string, id: string) {
    const [row] = await manager.query<{ id: string }[]>(
      `WITH deleted AS (DELETE FROM nodia_cv_versions WHERE owner_user_id=$1 AND id=$2 RETURNING id)
       SELECT id FROM deleted`,
      [owner, id],
    );
    return Boolean(row);
  }
}
