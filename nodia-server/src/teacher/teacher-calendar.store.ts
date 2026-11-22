import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type {
  CalendarActivity,
  CalendarCategory,
  CalendarCategoryName,
  CalendarColor,
  CalendarDayDetail,
  CalendarDayFields,
  CalendarPlanDetail,
  CalendarPlanPage,
  CalendarPlanSummary,
  CalendarPlanWrite,
} from './types/teacher-calendar.types.js';

export const CALENDAR_PAGE_SIZE = 20;

type CategoryRow = CalendarCategory &
  Pick<CalendarCategoryName, 'normalized_name'>;
type FetchScope = { manager: EntityManager; owner: string };

const planColumns = `p.id, p.title, p.day_count,
  CASE WHEN p.schedule_kind = 'dated' THEN jsonb_build_object(
    'kind', 'dated', 'start', to_char(p.start_date, 'YYYY-MM-DD'),
    'end', to_char(p.end_date, 'YYYY-MM-DD')
  ) ELSE jsonb_build_object('kind', 'numbered', 'days', p.day_count) END AS schedule`;
const planCategories = `(
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'color', c.color, 'active', c.active
  ) ORDER BY c.normalized_name, c.id), '[]'::jsonb)
  FROM teacher_calendar_plan_categories pc
  JOIN teacher_calendar_categories c
    ON c.owner_user_id = pc.owner_user_id AND c.id = pc.category_id
  WHERE pc.owner_user_id = p.owner_user_id AND pc.plan_id = p.id
) AS categories`;
const dayColumns = `d.id, d.ordinal, d.title, d.minutes,
  to_char(p.start_date + (d.ordinal - 1), 'YYYY-MM-DD') AS date,
  count(a.id)::int AS activity_count,
  count(a.id) FILTER (WHERE a.completed)::int AS completed_activity_count,
  (count(a.id) > 0 AND bool_and(a.completed)) AS completed`;
const activityProjection = `COALESCE(jsonb_agg(
  jsonb_strip_nulls(jsonb_build_object(
    'id', a.id, 'text', a.text, 'completed', a.completed,
    'source', CASE WHEN a.source_url IS NOT NULL THEN
      jsonb_build_object('label', a.source_label, 'url', a.source_url) END
  )) ORDER BY a.position
) FILTER (WHERE a.id IS NOT NULL), '[]'::jsonb)`;
const categoryFields = 'id, name, color, active';

@Injectable()
export class TeacherCalendarStore {
  async listPlans(
    { manager, owner }: FetchScope,
    page: number,
    categoryId?: string,
  ): Promise<CalendarPlanPage> {
    const [result]: { data: CalendarPlanSummary[]; total: number }[] =
      await manager.query(
        `WITH filtered AS MATERIALIZED (
          SELECT p.*
          FROM teacher_calendar_plans p
          WHERE p.owner_user_id = $1 AND (
            $2::uuid IS NULL OR EXISTS (
              SELECT 1 FROM teacher_calendar_plan_categories pc
              WHERE pc.owner_user_id = p.owner_user_id
                AND pc.plan_id = p.id AND pc.category_id = $2
            )
          )
        ), page AS MATERIALIZED (
          SELECT * FROM filtered ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4
        ), completed_days AS (
          SELECT d.plan_id
          FROM page p
          JOIN teacher_calendar_days d ON d.plan_id = p.id
          JOIN teacher_calendar_activities a ON a.day_id = d.id
          GROUP BY d.id HAVING bool_and(a.completed)
        ), counts AS (
          SELECT plan_id, count(*)::int AS completed_count
          FROM completed_days GROUP BY plan_id
        ), projected AS (
          SELECT ${planColumns}, ${planCategories},
            COALESCE(counts.completed_count, 0) AS completed_count, p.created_at
          FROM page p LEFT JOIN counts ON counts.plan_id = p.id
        )
        SELECT COALESCE(jsonb_agg(to_jsonb(projected) - 'created_at'
          ORDER BY created_at DESC, id DESC), '[]'::jsonb) AS data,
          (SELECT count(*)::int FROM filtered) AS total
        FROM projected`,
        [
          owner,
          categoryId ?? null,
          CALENDAR_PAGE_SIZE,
          (page - 1) * CALENDAR_PAGE_SIZE,
        ],
      );
    return {
      data: result.data,
      meta: {
        page,
        total_pages: Math.ceil(result.total / CALENDAR_PAGE_SIZE),
        total: result.total,
      },
    };
  }

  async plan({ manager, owner }: FetchScope, planId: string) {
    const [plan]: CalendarPlanDetail[] = await manager.query(
      `SELECT ${planColumns}, ${planCategories}, details.days, details.completed_count
      FROM teacher_calendar_plans p
      CROSS JOIN LATERAL (
        SELECT COALESCE(jsonb_agg(to_jsonb(progress) ORDER BY ordinal), '[]'::jsonb) AS days,
          count(*) FILTER (WHERE completed)::int AS completed_count
        FROM (
          SELECT ${dayColumns}
          FROM teacher_calendar_days d
          LEFT JOIN teacher_calendar_activities a ON a.day_id = d.id
          WHERE d.plan_id = p.id GROUP BY d.id
        ) progress
      ) details
      WHERE p.owner_user_id = $1 AND p.id = $2`,
      [owner, planId],
    );
    return plan;
  }

  async day({ manager, owner }: FetchScope, planId: string, dayId: string) {
    const [day]: CalendarDayDetail[] = await manager.query(
      `SELECT ${dayColumns}, d.notes, d.revision, ${activityProjection} AS activities
      FROM teacher_calendar_plans p
      JOIN teacher_calendar_days d ON d.plan_id = p.id
      LEFT JOIN teacher_calendar_activities a ON a.day_id = d.id
      WHERE p.owner_user_id = $1 AND p.id = $2 AND d.id = $3
      GROUP BY p.id, d.id`,
      [owner, planId, dayId],
    );
    return day;
  }

  lockCreationRequest({ manager, owner }: FetchScope, requestKey: string) {
    return manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`teacher-calendar-create:${owner}:${requestKey}`],
    );
  }

  async findCreation({ manager, owner }: FetchScope, requestKey: string) {
    const [receipt]: { id: string; request_hash: string }[] =
      await manager.query(
        `SELECT id, request_hash FROM teacher_calendar_plans
         WHERE owner_user_id = $1 AND request_key = $2`,
        [owner, requestKey],
      );
    return receipt;
  }

  async createPlan(
    { manager, owner }: FetchScope,
    key: string,
    hash: string,
    plan: CalendarPlanWrite,
    categoryIds: string[],
  ): Promise<string> {
    const schedule = plan.schedule;
    const [created]: { id: string }[] = await manager.query(
      `INSERT INTO teacher_calendar_plans
        (owner_user_id, request_key, request_hash, title, schedule_kind, day_count, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        owner,
        key,
        hash,
        plan.title,
        schedule.kind,
        plan.dayCount,
        schedule.kind === 'dated' ? schedule.start : null,
        schedule.kind === 'dated' ? schedule.end : null,
      ],
    );
    const importedDays = new Map(plan.days.map((day) => [day.ordinal, day]));
    const days = Array.from({ length: plan.dayCount }, (_, index) => {
      const ordinal = index + 1;
      const imported = importedDays.get(ordinal);
      return {
        id: randomUUID(),
        ordinal,
        title: imported?.title ?? null,
        notes: imported?.notes ?? null,
        minutes: imported?.minutes ?? null,
      };
    });
    await manager.query(
      `INSERT INTO teacher_calendar_days (id, plan_id, ordinal, title, notes, minutes)
      SELECT body.id, $1, body.ordinal, body.title, body.notes, body.minutes
      FROM jsonb_to_recordset($2) AS body(id uuid, ordinal int, title text, notes text, minutes int)`,
      [created.id, JSON.stringify(days)],
    );
    const activities = plan.days.flatMap((day) =>
      day.activities.map((activity, index) => ({
        day_id: days[day.ordinal - 1].id,
        position: index + 1,
        text: activity.text,
        source_label: activity.source?.label ?? null,
        source_url: activity.source?.url ?? null,
      })),
    );
    if (activities.length > 0)
      await manager.query(
        `INSERT INTO teacher_calendar_activities (day_id, position, text, source_label, source_url)
        SELECT body.day_id, body.position, body.text, body.source_label, body.source_url
        FROM jsonb_to_recordset($1) AS body(day_id uuid, position int, text text, source_label text, source_url text)`,
        [JSON.stringify(activities)],
      );
    if (categoryIds.length > 0)
      await manager.query(
        `INSERT INTO teacher_calendar_plan_categories (owner_user_id, plan_id, category_id)
        SELECT $1, $2, category_id FROM unnest($3::uuid[]) AS category_id`,
        [owner, created.id, categoryIds],
      );
    return created.id;
  }

  async lockDay({ manager, owner }: FetchScope, planId: string, dayId: string) {
    const [day]: { revision: number }[] = await manager.query(
      `SELECT d.revision FROM teacher_calendar_days d
      JOIN teacher_calendar_plans p ON p.id = d.plan_id
      WHERE p.owner_user_id = $1 AND p.id = $2 AND d.id = $3 FOR UPDATE OF d`,
      [owner, planId, dayId],
    );
    return day;
  }

  async activityIds({ manager }: FetchScope, dayId: string): Promise<string[]> {
    const rows: { id: string }[] = await manager.query(
      'SELECT id FROM teacher_calendar_activities WHERE day_id = $1',
      [dayId],
    );
    return rows.map((row) => row.id);
  }

  async updateDay(
    { manager, owner }: FetchScope,
    planId: string,
    dayId: string,
    revision: number,
    fields: CalendarDayFields,
    activities: CalendarActivity[],
  ): Promise<boolean> {
    const changed: { id: string }[] = await manager.query(
      `WITH updated AS (
        UPDATE teacher_calendar_days d SET title = $5, notes = $6, minutes = $7, revision = d.revision + 1
        FROM teacher_calendar_plans p
        WHERE p.id = $2 AND p.owner_user_id = $1 AND d.plan_id = p.id
          AND d.id = $3 AND d.revision = $4 RETURNING d.id
      ) SELECT id FROM updated`,
      [
        owner,
        planId,
        dayId,
        revision,
        fields.title,
        fields.notes,
        fields.minutes,
      ],
    );
    if (changed.length !== 1) return false;
    await manager.query(
      `DELETE FROM teacher_calendar_activities WHERE day_id = $1 AND NOT (id = ANY($2::uuid[]))`,
      [dayId, activities.map((activity) => activity.id)],
    );
    if (activities.length === 0) return true;
    const rows = activities.map((activity, index) => ({
      id: activity.id,
      position: index + 1,
      text: activity.text,
      source_label: activity.source?.label ?? null,
      source_url: activity.source?.url ?? null,
      completed: activity.completed,
    }));
    await manager.query(
      `INSERT INTO teacher_calendar_activities (id, day_id, position, text, source_label, source_url, completed)
      SELECT body.id, $1, body.position, body.text, body.source_label, body.source_url, body.completed
      FROM jsonb_to_recordset($2) AS body(
        id uuid, position int, text text, source_label text, source_url text, completed boolean
      )
      ON CONFLICT (id) DO UPDATE SET position = EXCLUDED.position, text = EXCLUDED.text,
        source_label = EXCLUDED.source_label, source_url = EXCLUDED.source_url, completed = EXCLUDED.completed
      WHERE teacher_calendar_activities.day_id = EXCLUDED.day_id`,
      [dayId, JSON.stringify(rows)],
    );
    return true;
  }

  lockCategories({ manager, owner }: FetchScope) {
    return manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`teacher-calendar-categories:${owner}`],
    );
  }

  categories({ manager, owner }: FetchScope): Promise<CalendarCategory[]> {
    return manager.query(
      `SELECT ${categoryFields} FROM teacher_calendar_categories
      WHERE owner_user_id = $1 ORDER BY normalized_name, id`,
      [owner],
    );
  }

  categoriesByNames(
    { manager, owner }: FetchScope,
    names: string[],
  ): Promise<CategoryRow[]> {
    return manager.query(
      `SELECT ${categoryFields}, normalized_name FROM teacher_calendar_categories
      WHERE owner_user_id = $1 AND normalized_name = ANY($2::text[])`,
      [owner, names],
    );
  }

  async category({ manager, owner }: FetchScope, categoryId: string) {
    const [row]: CategoryRow[] = await manager.query(
      `SELECT ${categoryFields}, normalized_name
      FROM teacher_calendar_categories WHERE owner_user_id = $1 AND id = $2`,
      [owner, categoryId],
    );
    return row;
  }

  async createCategory(
    { manager, owner }: FetchScope,
    name: CalendarCategoryName,
    color: CalendarColor,
  ) {
    const [category]: CalendarCategory[] = await manager.query(
      `INSERT INTO teacher_calendar_categories (owner_user_id, name, normalized_name, color)
      VALUES ($1, $2, $3, $4) ON CONFLICT (owner_user_id, normalized_name) DO NOTHING
      RETURNING ${categoryFields}`,
      [owner, name.name, name.normalized_name, color],
    );
    return category;
  }

  async updateCategory(
    { manager, owner }: FetchScope,
    categoryId: string,
    name: CalendarCategoryName,
    color: CalendarColor,
    active: boolean,
  ) {
    const [category]: CalendarCategory[] = await manager.query(
      `WITH updated AS (
        UPDATE teacher_calendar_categories
        SET name = $3, normalized_name = $4, color = $5, active = $6
        WHERE owner_user_id = $1 AND id = $2
        RETURNING ${categoryFields}
      ) SELECT ${categoryFields} FROM updated`,
      [owner, categoryId, name.name, name.normalized_name, color, active],
    );
    return category;
  }
}
