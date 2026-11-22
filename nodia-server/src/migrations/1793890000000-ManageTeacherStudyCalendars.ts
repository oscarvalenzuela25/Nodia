import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ManageTeacherStudyCalendars1793890000000 implements MigrationInterface {
  name = 'ManageTeacherStudyCalendars1793890000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE teacher_calendar_plans
        ADD COLUMN active boolean NOT NULL DEFAULT true;
      CREATE INDEX teacher_calendar_plans_owner_active_order
        ON teacher_calendar_plans (owner_user_id, active, created_at DESC, id DESC);
      CREATE TABLE teacher_calendar_deleted_plans (
        owner_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        request_key uuid NOT NULL,
        plan_id uuid NOT NULL,
        PRIMARY KEY (owner_user_id, request_key),
        UNIQUE (owner_user_id, plan_id)
      );
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE teacher_calendar_plans, teacher_calendar_deleted_plans
        IN ACCESS EXCLUSIVE MODE;
      DO $guard$
      BEGIN
        IF EXISTS (SELECT 1 FROM teacher_calendar_plans WHERE NOT active)
          OR EXISTS (SELECT 1 FROM teacher_calendar_deleted_plans) THEN
          RAISE EXCEPTION 'Preserve calendar states and deleted request identities before removing this migration';
        END IF;
      END $guard$;
      DROP TABLE teacher_calendar_deleted_plans;
      DROP INDEX teacher_calendar_plans_owner_active_order;
      ALTER TABLE teacher_calendar_plans DROP COLUMN active;
    `);
  }
}
