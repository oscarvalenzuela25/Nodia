import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTeacherStudyCalendar1793880000000 implements MigrationInterface {
  name = 'CreateTeacherStudyCalendar1793880000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE teacher_calendar_plans (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id bigint NOT NULL REFERENCES users(id),
        request_key uuid NOT NULL,
        request_hash char(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
        title varchar(120) NOT NULL CHECK (btrim(title) <> ''),
        schedule_kind text NOT NULL CHECK (schedule_kind IN ('numbered', 'dated')),
        day_count integer NOT NULL CHECK (day_count BETWEEN 1 AND 366),
        start_date date,
        end_date date,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (owner_user_id, id),
        UNIQUE (owner_user_id, request_key),
        CHECK (
          (schedule_kind = 'numbered' AND start_date IS NULL AND end_date IS NULL)
          OR (
            schedule_kind = 'dated' AND start_date IS NOT NULL AND end_date IS NOT NULL
            AND start_date >= DATE '0001-01-01' AND end_date <= DATE '9999-12-31'
            AND day_count = end_date - start_date + 1
          )
        )
      );
      CREATE INDEX teacher_calendar_plans_owner_order
        ON teacher_calendar_plans (owner_user_id, created_at DESC, id DESC);

      CREATE TABLE teacher_calendar_days (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id uuid NOT NULL REFERENCES teacher_calendar_plans(id) ON DELETE CASCADE,
        ordinal integer NOT NULL CHECK (ordinal BETWEEN 1 AND 366),
        title varchar(120) CHECK (btrim(title) <> ''),
        notes varchar(4000),
        minutes integer CHECK (minutes BETWEEN 1 AND 1440),
        revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
        UNIQUE (plan_id, ordinal)
      );

      CREATE TABLE teacher_calendar_activities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        day_id uuid NOT NULL REFERENCES teacher_calendar_days(id) ON DELETE CASCADE,
        position integer NOT NULL CHECK (position BETWEEN 1 AND 24),
        text varchar(512) NOT NULL CHECK (btrim(text) <> ''),
        source_label varchar(180) CHECK (btrim(source_label) <> ''),
        source_url varchar(2048) CHECK (source_url ~* '^https://'),
        completed boolean NOT NULL DEFAULT false,
        UNIQUE (day_id, position) DEFERRABLE INITIALLY DEFERRED,
        CHECK ((source_label IS NULL) = (source_url IS NULL))
      );

      CREATE TABLE teacher_calendar_categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id bigint NOT NULL REFERENCES users(id),
        name varchar(120) NOT NULL CHECK (btrim(name) <> ''),
        normalized_name text COLLATE "C" NOT NULL CHECK (normalized_name <> ''),
        color text NOT NULL CHECK (color IN ('violet', 'green', 'blue', 'amber')),
        active boolean NOT NULL DEFAULT true,
        UNIQUE (owner_user_id, id),
        UNIQUE (owner_user_id, normalized_name)
      );

      CREATE TABLE teacher_calendar_plan_categories (
        owner_user_id bigint NOT NULL,
        plan_id uuid NOT NULL,
        category_id uuid NOT NULL,
        PRIMARY KEY (owner_user_id, plan_id, category_id),
        FOREIGN KEY (owner_user_id, plan_id)
          REFERENCES teacher_calendar_plans (owner_user_id, id) ON DELETE CASCADE,
        FOREIGN KEY (owner_user_id, category_id)
          REFERENCES teacher_calendar_categories (owner_user_id, id)
      );
      CREATE INDEX teacher_calendar_plan_categories_filter
        ON teacher_calendar_plan_categories (owner_user_id, category_id, plan_id);
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE teacher_calendar_plans, teacher_calendar_days, teacher_calendar_activities,
        teacher_calendar_categories, teacher_calendar_plan_categories IN ACCESS EXCLUSIVE MODE;
      DO $guard$
      BEGIN
        IF EXISTS (SELECT 1 FROM teacher_calendar_plans)
          OR EXISTS (SELECT 1 FROM teacher_calendar_categories) THEN
          RAISE EXCEPTION 'Preserve the study calendars and categories before removing this migration';
        END IF;
      END $guard$;
      DROP TABLE teacher_calendar_plan_categories, teacher_calendar_categories,
        teacher_calendar_activities, teacher_calendar_days, teacher_calendar_plans;
    `);
  }
}
