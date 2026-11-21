import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type { ContactSchedule } from '../../provider-contact/types/provider-contact.types.js';
import { planVisitOccurrences } from '../policies/provider-visit-occurrence.js';

const pageSize = 48;
const desiredOccurrences = `
  SELECT * FROM jsonb_to_recordset($1::jsonb) AS desired(
    contact_id bigint, visit_date date, start_at timestamptz, send_at timestamptz,
    expires_at timestamptz, alarm_basis text
  )`;

interface PlanningWork {
  provider_id: string;
  source_revision: string;
  contact_cursor: string;
}

interface ProviderSource {
  business_id: string;
  visit_alarm_time: string | null;
  active: boolean;
}

interface ContactSource {
  id: string;
  is_active: boolean;
  schedule: ContactSchedule;
}

async function updatePage(
  manager: EntityManager,
  work: PlanningWork,
  provider: ProviderSource,
  contacts: ContactSource[],
  now: Date,
): Promise<void> {
  const planned = provider.active
    ? contacts.flatMap((contact) =>
        contact.is_active
          ? planVisitOccurrences(
              contact.schedule,
              provider.visit_alarm_time,
              now,
            ).map((visit) => ({
              contact_id: contact.id,
              visit_date: visit.visitDate,
              start_at: visit.visitStartsAt,
              send_at: visit.sendAt,
              expires_at: visit.expiresAt,
              alarm_basis: visit.alarmBasis,
            }))
          : [],
      )
    : [];
  const desired = JSON.stringify(planned);
  await manager.query(
    `UPDATE provider_visit_occurrences occurrence
     SET status = CASE WHEN occurrence.expires_at <= $5 THEN 'expired' ELSE 'cancelled' END
     WHERE occurrence.provider_id = $2 AND occurrence.contact_id = ANY($4::bigint[])
       AND occurrence.status = 'planned'
       AND NOT EXISTS (
         SELECT 1 FROM (${desiredOccurrences}) desired
         WHERE occurrence.business_id = $3
           AND occurrence.contact_id = desired.contact_id
           AND occurrence.visit_date = desired.visit_date
       )`,
    [
      desired,
      work.provider_id,
      provider.business_id,
      contacts.map((contact) => contact.id),
      now,
    ],
  );
  if (!planned.length) return;
  await manager.query(
    `INSERT INTO provider_visit_occurrences (
       business_id, provider_id, contact_id, visit_date, start_at, send_at,
       expires_at, alarm_basis, status, source_revision
     )
     SELECT $3, $2, contact_id, visit_date, start_at, send_at, expires_at,
       alarm_basis, 'planned', $4
     FROM (${desiredOccurrences}) desired
     ON CONFLICT (business_id, provider_id, contact_id, visit_date) DO UPDATE SET
       start_at = EXCLUDED.start_at, send_at = EXCLUDED.send_at,
       expires_at = EXCLUDED.expires_at, alarm_basis = EXCLUDED.alarm_basis,
       status = 'planned', source_revision = EXCLUDED.source_revision
     WHERE (provider_visit_occurrences.start_at, provider_visit_occurrences.send_at,
       provider_visit_occurrences.expires_at, provider_visit_occurrences.alarm_basis,
       provider_visit_occurrences.status, provider_visit_occurrences.source_revision)
       IS DISTINCT FROM (EXCLUDED.start_at, EXCLUDED.send_at, EXCLUDED.expires_at,
         EXCLUDED.alarm_basis, EXCLUDED.status, EXCLUDED.source_revision)`,
    [desired, work.provider_id, provider.business_id, work.source_revision],
  );
}

@Injectable()
export class ReconcileProviderVisitPlanningUseCase {
  constructor(private readonly dataSource: DataSource) {}

  executeNext(now = new Date()): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SET LOCAL statement_timeout TO '3s'`);
      await manager.query(`SET LOCAL lock_timeout TO '1s'`);
      const [work]: PlanningWork[] = await manager.query(
        `SELECT provider_id, source_revision, contact_cursor FROM provider_visit_planning_queue
         WHERE run_at <= $1 ORDER BY run_at, provider_id LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [now],
      );
      if (!work) return false;

      // Source edits enqueue under this same lock and become visible with their new revision.
      const [provider]: ProviderSource[] = await manager.query(
        `SELECT provider.business_id, provider.visit_alarm_time,
           (provider.is_active AND business.is_active IS TRUE) AS active
         FROM providers provider LEFT JOIN businesses business ON business.id = provider.business_id
         WHERE provider.id = $1`,
        [work.provider_id],
      );
      if (!provider) {
        const [{ closed }]: { closed: number }[] = await manager.query(
          `WITH obsolete AS (
             SELECT business_id, contact_id, visit_date FROM provider_visit_occurrences
             WHERE provider_id = $1 AND status = 'planned'
             ORDER BY contact_id, visit_date LIMIT 512 FOR UPDATE
           ), closed AS (
             UPDATE provider_visit_occurrences AS occurrence
             SET status = CASE WHEN occurrence.expires_at <= $2 THEN 'expired' ELSE 'cancelled' END
             FROM obsolete WHERE occurrence.provider_id = $1
               AND (occurrence.business_id, occurrence.contact_id, occurrence.visit_date)
                 = (obsolete.business_id, obsolete.contact_id, obsolete.visit_date)
             RETURNING 1
           ) SELECT count(*)::int AS closed FROM closed`,
          [work.provider_id, now],
        );
        if (closed < 512) {
          await manager.query(
            `DELETE FROM provider_visit_planning_queue WHERE provider_id = $1`,
            [work.provider_id],
          );
        }
        return true;
      }

      const contacts: ContactSource[] = await manager.query(
        `SELECT id, is_active, schedule FROM personal_info_provider
         WHERE provider_id = $1 AND id > $2 ORDER BY id LIMIT $3`,
        [work.provider_id, work.contact_cursor, pageSize + 1],
      );
      const page = contacts.slice(0, pageSize);
      if (page.length) await updatePage(manager, work, provider, page, now);

      if (contacts.length > pageSize) {
        await manager.query(
          `UPDATE provider_visit_planning_queue SET contact_cursor = $2, run_at = $3
           WHERE provider_id = $1`,
          [work.provider_id, page[pageSize - 1].id, now],
        );
      } else {
        await manager.query(
          `UPDATE provider_visit_planning_queue SET contact_cursor = 0, run_at = CASE
             WHEN $2 AND EXISTS (
               SELECT 1 FROM personal_info_provider
               WHERE provider_id = $1 AND is_active AND schedule <> '{}'::jsonb
             ) THEN $3::timestamptz + interval '24 hours' ELSE NULL END
           WHERE provider_id = $1`,
          [work.provider_id, provider.active, now],
        );
      }
      return true;
    });
  }

  async sweepOccurrences(now = new Date()): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`SET LOCAL statement_timeout TO '3s'`);
      await manager.query(
        `WITH expired AS (
           SELECT business_id, provider_id, contact_id, visit_date FROM provider_visit_occurrences
           WHERE expires_at <= $1 AND status = 'planned'
           ORDER BY expires_at, business_id, provider_id, contact_id, visit_date
           LIMIT 512 FOR UPDATE SKIP LOCKED
         ) UPDATE provider_visit_occurrences AS occurrence SET status = 'expired' FROM expired
         WHERE (occurrence.business_id, occurrence.provider_id, occurrence.contact_id, occurrence.visit_date)
           = (expired.business_id, expired.provider_id, expired.contact_id, expired.visit_date)`,
        [now],
      );
      await manager.query(
        `WITH old AS (
           SELECT business_id, provider_id, contact_id, visit_date FROM provider_visit_occurrences
           WHERE expires_at < $1::timestamptz - interval '720 hours'
           ORDER BY expires_at, business_id, provider_id, contact_id, visit_date
           LIMIT 512 FOR UPDATE SKIP LOCKED
         ) DELETE FROM provider_visit_occurrences AS occurrence USING old
         WHERE (occurrence.business_id, occurrence.provider_id, occurrence.contact_id, occurrence.visit_date)
           = (old.business_id, old.provider_id, old.contact_id, old.visit_date)`,
        [now],
      );
    });
  }
}
