import { countQueuedCvGenerations } from './cv-generation-presence.js';
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../nodia-ai-runtime/config/runtime-policy.js';
import { teacherError } from '../teacher/policies/teacher-validation.js';
import type { TeacherSelection } from '../teacher/types/teacher.types.js';
import {
  FLASHCARD_IMAGE_QUALIFICATION_PROMPT,
  FlashcardLibraryTransport,
} from './flashcard-library-transport.service.js';

export type FlashcardProposalKind = 'text' | 'image';
export type FlashcardText = { question: string; answer: string };
type PartState = 'queued' | 'running' | 'ready' | 'failed' | 'unknown';
type PublicPart<Value> = {
  state: PartState | 'skipped';
  error_code: string | null;
  value: Value | null;
};
export type FlashcardLibraryProposal = {
  id: string;
  origin: Record<string, unknown>;
  text: PublicPart<FlashcardText>;
  image: PublicPart<{ mime: string }>;
  expires_at: string;
};
export type FlashcardLibraryAdmission = {
  id: string;
  owner: string;
  authSession: string;
  requestKey: string;
  requestHash: string;
  origin: Record<string, unknown>;
  textPrompt: string | null;
  imagePrompt: string | null;
  textSelection: TeacherSelection | null;
  imageSelection: TeacherSelection | null;
  /** Internal operator path only. No HTTP request may set this field. */
  qualification?: true;
};
export type FlashcardLibraryImage = {
  origin: Record<string, unknown>;
  bytes: Buffer;
  mime: string;
};

@Injectable()
export class FlashcardLibraryStore {
  constructor(
    private readonly transport: FlashcardLibraryTransport,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}

  /** Admission uses the caller's authority and the shared queue lock. */
  async admit(
    manager: EntityManager,
    input: FlashcardLibraryAdmission,
  ): Promise<{ id: string }> {
    const [receipt]: { id: string; request_hash: string }[] =
      await manager.query(
        'SELECT id,request_hash FROM teacher_flashcard_library_proposals WHERE owner_user_id=$1 AND request_key=$2',
        [input.owner, input.requestKey],
      );
    if (receipt) {
      if (receipt.request_hash !== input.requestHash)
        teacherError('idempotency_conflict');
      return { id: receipt.id };
    }
    const textSelection = input.textSelection;
    const imageSelection = input.imageSelection;
    const textPrompt = input.textPrompt;
    const imagePrompt = input.imagePrompt;
    if (
      (!textSelection && !imageSelection) ||
      Boolean(textSelection) !== Boolean(textPrompt) ||
      Boolean(imagePrompt) !== Boolean(imageSelection && !textSelection) ||
      [textPrompt, imagePrompt].some(
        (prompt) => prompt !== null && Buffer.byteLength(prompt) > 49152,
      )
    ) {
      teacherError('invalid_input', 400);
    }
    if (
      input.qualification &&
      (textSelection ||
        input.origin.kind !== 'notes' ||
        Object.keys(input.origin).length !== 1 ||
        imagePrompt !== FLASHCARD_IMAGE_QUALIFICATION_PROMPT)
    ) {
      teacherError('invalid_input', 400);
    }
    const [duplicate]: { state: 'unknown' | 'queued' | 'running' }[] =
      await manager.query(
        `SELECT part.state FROM teacher_flashcard_library_proposals proposal
       JOIN teacher_flashcard_library_parts part ON part.proposal_id=proposal.id
       WHERE proposal.owner_user_id=$1 AND proposal.request_hash=$2 AND proposal.qualification=$3
         AND part.state IN ('queued','running','unknown')
       ORDER BY (part.state='unknown') DESC LIMIT 1`,
        [input.owner, input.requestHash, Boolean(input.qualification)],
      );
    if (duplicate)
      teacherError(
        duplicate.state === 'unknown'
          ? 'flashcard_proposal_outcome_unknown'
          : 'flashcard_proposal_already_pending',
      );
    const [capacity]: {
      requested: number;
      pending: number;
      global_waiting: number;
    }[] = await manager.query(
      `SELECT
         (SELECT coalesce(sum(budget_parts),0)::int FROM teacher_flashcard_library_proposals
          WHERE owner_user_id=$1 AND created_at>clock_timestamp()-interval '24 hours') AS requested,
         (SELECT count(DISTINCT proposal.id)::int FROM teacher_flashcard_library_proposals proposal
          JOIN teacher_flashcard_library_parts part ON part.proposal_id=proposal.id
          WHERE proposal.owner_user_id=$1 AND part.state IN ('queued','running')) AS pending,
         ((SELECT count(*) FROM teacher_flashcard_library_parts WHERE state='queued')
         +(SELECT count(*) FROM teacher_generation_jobs WHERE state='queued')
         +(SELECT count(*) FROM nodia_ai_jobs WHERE state='ready'))::int AS global_waiting`,
      [input.owner],
    );
    const budgetParts =
      Number(Boolean(textSelection)) + Number(Boolean(imageSelection));
    if (capacity.requested + budgetParts > 20)
      teacherError('flashcard_proposal_budget_exhausted', 429);
    if (
      capacity.pending >= 2 ||
      capacity.global_waiting + budgetParts + (await countQueuedCvGenerations(manager)) >
        this.policy.queue.waiting_global
    ) {
      teacherError('capacity_unavailable', 429);
    }
    // Resolve both exact selections first. Rejected configuration never leaves a half-admitted proposal.
    const textConfig = textSelection
      ? await this.transport.configure(textSelection, 'text', manager)
      : null;
    const imageConfig = imageSelection
      ? await this.transport.configure(
          imageSelection,
          'image',
          manager,
          input.qualification,
        )
      : null;
    await manager.query(
      `INSERT INTO teacher_flashcard_library_proposals
       (id,owner_user_id,auth_session_public_id,request_key,request_hash,origin,budget_parts,qualification)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
      [
        input.id,
        input.owner,
        input.authSession,
        input.requestKey,
        input.requestHash,
        JSON.stringify(input.origin),
        budgetParts,
        Boolean(input.qualification),
      ],
    );
    for (const part of [
      {
        kind: 'text',
        selection: textSelection,
        config: textConfig,
        prompt: textPrompt,
      },
      {
        kind: 'image',
        selection: imageSelection,
        config: imageConfig,
        prompt: imagePrompt,
      },
    ]) {
      if (!part.selection || !part.config) continue;
      await manager.query(
        `INSERT INTO teacher_flashcard_library_parts
         (id,proposal_id,kind,selection_snapshot,configuration_generation,session_generation,resource_key,prompt)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)`,
        [
          randomUUID(),
          input.id,
          part.kind,
          JSON.stringify(part.selection),
          part.config.configurationGeneration,
          part.config.sessionGeneration,
          part.config.resourceKey,
          part.prompt,
        ],
      );
    }
    return { id: input.id };
  }

  byId(manager: EntityManager, owner: string, id: string) {
    return this.read(manager, owner, id, 'id');
  }

  byRequest(manager: EntityManager, owner: string, key: string) {
    return this.read(manager, owner, key, 'request_key');
  }

  async image(
    manager: EntityManager,
    owner: string,
    id: string,
  ): Promise<FlashcardLibraryImage | null> {
    const [row]: FlashcardLibraryImage[] = await manager.query(
      `SELECT proposal.origin,part.image_bytes AS bytes,part.image_mime AS mime
       FROM teacher_flashcard_library_proposals proposal
       JOIN teacher_flashcard_library_parts part ON part.proposal_id=proposal.id
       WHERE proposal.owner_user_id=$1 AND proposal.id=$2 AND NOT proposal.qualification
         AND proposal.expires_at>clock_timestamp() AND part.kind='image' AND part.state='ready'`,
      [owner, id],
    );
    return row ?? null;
  }

  private async read(
    manager: EntityManager,
    owner: string,
    key: string,
    field: 'id' | 'request_key',
  ) {
    const rows: {
      id: string;
      origin: Record<string, unknown>;
      expires_at: Date;
      kind: FlashcardProposalKind;
      state: PartState;
      error_code: string | null;
      text_value: FlashcardText | null;
      image_mime: string | null;
    }[] = await manager.query(
      `SELECT proposal.id,proposal.origin,proposal.expires_at,part.kind,part.state,part.error_code,
              part.text_value,part.image_mime
       FROM teacher_flashcard_library_proposals proposal
       JOIN teacher_flashcard_library_parts part ON part.proposal_id=proposal.id
       WHERE proposal.owner_user_id=$1 AND proposal.${field}=$2 AND NOT proposal.qualification
         AND proposal.expires_at>clock_timestamp()`,
      [owner, key],
    );
    if (!rows[0]) return null;
    const { id, origin, expires_at } = rows[0];
    const text = rows.find((row) => row.kind === 'text');
    const image = rows.find((row) => row.kind === 'image');
    return {
      id,
      origin,
      expires_at: expires_at.toISOString(),
      text: {
        state: text?.state ?? 'skipped',
        error_code: text?.error_code ?? null,
        value: text?.text_value ?? null,
      },
      image: {
        state: image?.state ?? 'skipped',
        error_code: image?.error_code ?? null,
        value: image?.image_mime ? { mime: image.image_mime } : null,
      },
    } satisfies FlashcardLibraryProposal;
  }
}
