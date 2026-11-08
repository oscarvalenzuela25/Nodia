import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type {
  AssessmentPolicy,
  BlueprintSlot,
  TeacherGenerationJob,
  TeacherSessionRow,
} from '../types/teacher.types.js';
import {
  assessment,
  guide,
  hash,
  object,
  outline,
  packet,
  parseJsonOutput,
  canonical,
  teacherError,
  text,
} from '../policies/teacher-validation.js';
import { validateWrittenFeedback } from '../policies/teacher-assessment.js';
import {
  outlineIds,
  saveProposal,
  type PlanRevisionRow,
} from './teacher-plan-persistence.js';
import {
  publishAssessment,
  startStoredAttempt,
  updateAttemptGrade,
} from './teacher-attempt-persistence.js';

@Injectable()
export class PublishTeacherUseCase {
  async publish(
    m: EntityManager,
    job: TeacherGenerationJob,
    output: string,
  ): Promise<Record<string, unknown>> {
    const [s]: TeacherSessionRow[] = await m.query(
      'SELECT * FROM teacher_sessions WHERE id=$1 FOR UPDATE',
      [job.session_id],
    );
    if (!s) teacherError('not_found', 404);
    const data = parseJsonOutput(output),
      input = job.input_snapshot;
    if (job.purpose === 'setup_reply') {
      const v = object(data, [
        'schema_version',
        'text',
        'brief',
        'questions',
        'organization_options',
      ]);
      if (
        v.schema_version !== 1 ||
        !Array.isArray(v.questions) ||
        v.questions.length > 8 ||
        !Array.isArray(v.organization_options) ||
        v.organization_options.some((o) => o !== 'days' && o !== 'topics')
      )
        teacherError('invalid_generated_content', 422);
      const brief = object(v.brief, ['topic', 'objective']);
      text(brief.topic, 1, 240);
      text(brief.objective, 1, 2000);
      v.questions.forEach((q) => text(q, 1, 1000));
      const [last]: { n: string }[] = await m.query(
        'SELECT coalesce(max(seq),0)::text AS n FROM teacher_setup_messages WHERE session_id=$1',
        [s.id],
      );
      if (BigInt(last.n) >= 100n) teacherError('message_limit', 409);
      const id = randomUUID();
      await m.query(
        "INSERT INTO teacher_setup_messages(id,session_id,seq,role,actor_id,text,generation_job_id) VALUES($1,$2,$3,'assistant',NULL,$4,$5)",
        [
          id,
          s.id,
          (BigInt(last.n) + 1n).toString(),
          text(v.text, 1, 4000),
          job.id,
        ],
      );
      const setupSummary = {
        schema_version: 1,
        revision: Number(BigInt(last.n) + 1n),
        source_message_id: id,
        source_message_seq: (BigInt(last.n) + 1n).toString(),
        brief: {
          topic: text(brief.topic, 1, 240),
          objective: text(brief.objective, 1, 2000),
        },
        questions: v.questions.map((q) => text(q, 1, 1000)),
        organization_options: v.organization_options,
      };
      if (Buffer.byteLength(canonical(setupSummary)) > 32768)
        teacherError('invalid_generated_content', 422);
      return { message_id: id, setup_summary: setupSummary };
    }
    if (job.purpose === 'plan_outline' || job.purpose === 'plan_adjustment') {
      const v = object(data, ['schema_version', 'outline', 'guide']);
      if (v.schema_version !== 1)
        teacherError('invalid_generated_content', 422);
      const [base]: PlanRevisionRow[] = job.plan_revision_id
        ? await m.query(
            'SELECT * FROM teacher_plan_revisions WHERE session_id=$1 AND id=$2',
            [s.id, job.plan_revision_id],
          )
        : [];
      const plan = outline(
        v.outline,
        base ? outlineIds(base.outline) : new Set(),
      );
      const g = guide(v.guide);
      const saved = await saveProposal(
        m,
        s,
        job.actor_id,
        plan,
        g,
        base ?? null,
        job.id,
        true,
      );
      return {
        proposal_revision_id: saved.id,
        content_hash: saved.content_hash,
      };
    }
    if (job.purpose === 'written_feedback') {
      const [a] = await m.query(
        'SELECT * FROM teacher_attempts WHERE session_id=$1 AND id=$2 FOR UPDATE',
        [s.id, job.attempt_id],
      );
      if (
        !a ||
        !a.is_active ||
        !['in_progress', 'grading_pending'].includes(a.state)
      )
        return { attempt_id: job.attempt_id, publication_state: 'obsolete' };
      const requested = (input.responses as { response_id: string }[]).map(
        (r) => r.response_id,
      );
      const rows = await m.query(
        "SELECT r.id AS response_id,r.frozen_answer,k.private_key,k.expected_explanation FROM teacher_responses r JOIN teacher_assessment_keys k ON k.item_id=r.item_id WHERE r.attempt_id=$1 AND r.grade_state='pending' AND r.id=ANY($2::uuid[]) ORDER BY r.id",
        [a.id, requested],
      );
      const expected = rows.map(
        (r: {
          response_id: string;
          private_key: { criteria: { criterion_id: string }[] };
        }) => ({
          response_id: r.response_id,
          criterion_ids: r.private_key.criteria.map((c) => c.criterion_id),
        }),
      );
      const feedback = validateWrittenFeedback(data, expected);
      for (const r of feedback) {
        const original = rows.find(
          (row: { response_id: string }) => row.response_id === r.response_id,
        );
        await m.query(
          "UPDATE teacher_responses SET grade_state=$2,earned_points=$3,feedback=$4,explanation_state='ready',revision=revision+1,updated_at=clock_timestamp() WHERE id=$1 AND grade_state='pending'",
          [
            r.response_id,
            r.uncertain ? 'needs_review' : 'graded',
            r.uncertain ? null : r.points,
            {
              criteria: r.criteria,
              explanation: r.explanation,
              correct_answer: original.private_key,
              expected_explanation: original.expected_explanation,
            },
          ],
        );
      }
      if (a.state === 'grading_pending') await updateAttemptGrade(m, s, a.id);
      return { attempt_id: a.id };
    }
    const slots = input.blueprint as BlueprintSlot[],
      policy = input.policy as AssessmentPolicy;
    if (!Array.isArray(slots) || !policy)
      teacherError('invalid_generated_content', 422);
    const current = s.current_plan_revision_id === job.plan_revision_id;
    if (job.purpose === 'learning_packet') {
      const parsed = packet(data, slots, {
        unit_id: job.unit_id!,
        plan_revision_id: job.plan_revision_id!,
        section_id: job.section_id!,
      });
      const [last]: { n: number }[] = await m.query(
        'SELECT coalesce(max(version_no),0)::integer AS n FROM teacher_content_versions WHERE session_id=$1 AND plan_revision_id=$2 AND unit_id=$3',
        [s.id, job.plan_revision_id, job.unit_id],
      );
      if (current)
        await m.query(
          "UPDATE teacher_content_versions SET publication_state='superseded' WHERE session_id=$1 AND plan_revision_id=$2 AND unit_id=$3 AND publication_state='current'",
          [s.id, job.plan_revision_id, job.unit_id],
        );
      const id = randomUUID();
      await m.query(
        'INSERT INTO teacher_content_versions(id,session_id,plan_revision_id,unit_id,version_no,generation_job_id,context_hash,public_blocks,content_hash,publication_state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [
          id,
          s.id,
          job.plan_revision_id,
          job.unit_id,
          last.n + 1,
          job.id,
          job.input_hash,
          JSON.stringify(parsed.blocks),
          hash(parsed),
          current ? 'current' : 'superseded',
        ],
      );
      const assessmentId = await publishAssessment(
        m,
        s,
        job.id,
        parsed.practice_assessment,
        slots,
        policy,
        id,
      );
      if (current && input.start_attempt === true) {
        const attempt = await startStoredAttempt(
          m,
          s,
          assessmentId,
          'practice',
        );
        return {
          ...attempt,
          content_version_id: id,
          publication_state: 'current',
        };
      }
      return {
        kind: 'material',
        resource_id: id,
        content_version_id: id,
        assessment_id: assessmentId,
        publication_state: current ? 'current' : 'superseded',
      };
    }
    const target = {
      scope: input.scope as 'section_final' | 'diagnostic',
      plan_revision_id: job.plan_revision_id,
      section_id: job.section_id,
      unit_id: null,
    };
    const parsed = assessment(data, slots, target);
    const assessmentId = await publishAssessment(
      m,
      s,
      job.id,
      parsed,
      slots,
      policy,
      null,
    );
    if (
      (current || target.scope === 'diagnostic') &&
      input.start_attempt === true
    ) {
      if (target.scope === 'section_final') {
        const [blocked]: { n: string }[] = await m.query(
          'SELECT count(*)::text AS n FROM teacher_section_prerequisites p WHERE p.session_id=$1 AND p.plan_revision_id=$2 AND p.section_id=$3 AND NOT EXISTS(SELECT 1 FROM teacher_section_verifications v WHERE v.session_id=p.session_id AND v.plan_revision_id=p.plan_revision_id AND v.section_id=p.required_section_id)',
          [s.id, job.plan_revision_id, job.section_id],
        );
        if (Number(blocked.n) > 0)
          return {
            assessment_id: assessmentId,
            publication_state: 'prerequisite_obsolete',
          };
      }
      return {
        ...(await startStoredAttempt(
          m,
          s,
          assessmentId,
          String(input.entry_route),
        )),
        assessment_id: assessmentId,
      };
    }
    return {
      assessment_id: assessmentId,
      publication_state: current ? 'current' : 'superseded',
    };
  }
}
