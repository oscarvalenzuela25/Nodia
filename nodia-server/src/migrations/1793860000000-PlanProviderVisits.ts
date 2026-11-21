import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PlanProviderVisits1793860000000 implements MigrationInterface {
  name = 'PlanProviderVisits1793860000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE provider_visit_planning_queue (
        provider_id bigint PRIMARY KEY,
        source_revision bigint NOT NULL DEFAULT 1 CHECK (source_revision > 0),
        contact_cursor bigint NOT NULL DEFAULT 0 CHECK (contact_cursor >= 0),
        run_at timestamptz DEFAULT clock_timestamp()
      );
      CREATE INDEX provider_visit_planning_due
        ON provider_visit_planning_queue(run_at, provider_id) WHERE run_at IS NOT NULL;

      CREATE TABLE provider_visit_occurrences (
        business_id uuid NOT NULL,
        provider_id bigint NOT NULL,
        contact_id bigint NOT NULL,
        visit_date date NOT NULL,
        start_at timestamptz,
        send_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL,
        alarm_basis text NOT NULL CHECK (alarm_basis IN (
          'provider_alarm', 'visit_start', 'late_alarm_fallback', 'default_hour'
        )),
        status text NOT NULL CHECK (status IN ('planned', 'cancelled', 'expired')),
        source_revision bigint NOT NULL CHECK (source_revision > 0),
        PRIMARY KEY (business_id, provider_id, contact_id, visit_date),
        CHECK (send_at < expires_at AND (start_at IS NULL OR expires_at <= start_at))
      );
      CREATE INDEX provider_visit_occurrences_by_source
        ON provider_visit_occurrences(provider_id, contact_id) WHERE status = 'planned';
      CREATE INDEX provider_visit_occurrences_due
        ON provider_visit_occurrences(send_at) WHERE status = 'planned';
      CREATE INDEX provider_visit_occurrences_expiry
        ON provider_visit_occurrences(expires_at, business_id, provider_id, contact_id, visit_date);

      CREATE FUNCTION enqueue_provider_visit_planning(target_provider_id bigint)
      RETURNS void LANGUAGE sql AS $$
        INSERT INTO provider_visit_planning_queue(provider_id) VALUES (target_provider_id)
        ON CONFLICT (provider_id) DO UPDATE
          SET source_revision = provider_visit_planning_queue.source_revision + 1,
              contact_cursor = 0, run_at = clock_timestamp()
      $$;

      CREATE FUNCTION mark_provider_visit_planning() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          PERFORM enqueue_provider_visit_planning(OLD.id);
        ELSIF TG_OP = 'INSERT' OR (NEW.business_id, NEW.is_active, NEW.visit_alarm_time)
          IS DISTINCT FROM (OLD.business_id, OLD.is_active, OLD.visit_alarm_time) THEN
          PERFORM enqueue_provider_visit_planning(NEW.id);
        END IF;
        RETURN NULL;
      END
      $$;
      CREATE TRIGGER provider_visit_planning_provider_write
        AFTER INSERT OR DELETE OR UPDATE OF business_id, is_active, visit_alarm_time ON providers
        FOR EACH ROW EXECUTE FUNCTION mark_provider_visit_planning();

      CREATE FUNCTION mark_contact_visit_planning() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'UPDATE' AND (NEW.provider_id, NEW.is_active, NEW.schedule)
          IS NOT DISTINCT FROM (OLD.provider_id, OLD.is_active, OLD.schedule) THEN
          RETURN NULL;
        END IF;
        IF TG_OP = 'UPDATE' AND NEW.provider_id <> OLD.provider_id THEN
          PERFORM enqueue_provider_visit_planning(LEAST(OLD.provider_id, NEW.provider_id));
          PERFORM enqueue_provider_visit_planning(GREATEST(OLD.provider_id, NEW.provider_id));
        ELSIF TG_OP = 'DELETE' THEN
          PERFORM enqueue_provider_visit_planning(OLD.provider_id);
        ELSE
          PERFORM enqueue_provider_visit_planning(NEW.provider_id);
        END IF;
        IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.provider_id <> OLD.provider_id) THEN
          UPDATE provider_visit_occurrences SET status = 'cancelled'
          WHERE provider_id = OLD.provider_id AND contact_id = OLD.id AND status = 'planned';
        END IF;
        RETURN NULL;
      END
      $$;
      CREATE TRIGGER provider_visit_planning_contact_write
        AFTER INSERT OR DELETE OR UPDATE OF provider_id, is_active, schedule ON personal_info_provider
        FOR EACH ROW EXECUTE FUNCTION mark_contact_visit_planning();

      CREATE FUNCTION mark_business_visit_planning() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO provider_visit_planning_queue(provider_id)
          SELECT id FROM providers WHERE business_id = NEW.id ORDER BY id
        ON CONFLICT (provider_id) DO UPDATE
          SET source_revision = provider_visit_planning_queue.source_revision + 1,
              contact_cursor = 0, run_at = clock_timestamp();
        RETURN NULL;
      END
      $$;
      CREATE TRIGGER provider_visit_planning_business_write
        AFTER UPDATE OF is_active ON businesses FOR EACH ROW
        WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
        EXECUTE FUNCTION mark_business_visit_planning();

      INSERT INTO provider_visit_planning_queue(provider_id)
      SELECT provider.id FROM providers provider
      JOIN businesses business ON business.id = provider.business_id AND business.is_active
      WHERE provider.is_active AND EXISTS (
        SELECT 1 FROM personal_info_provider contact
        WHERE contact.provider_id = provider.id AND contact.is_active AND contact.schedule <> '{}'::jsonb
      );
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      DROP TRIGGER provider_visit_planning_business_write ON businesses;
      DROP TRIGGER provider_visit_planning_contact_write ON personal_info_provider;
      DROP TRIGGER provider_visit_planning_provider_write ON providers;
      DROP FUNCTION mark_business_visit_planning();
      DROP FUNCTION mark_contact_visit_planning();
      DROP FUNCTION mark_provider_visit_planning();
      DROP FUNCTION enqueue_provider_visit_planning(bigint);
      DROP TABLE provider_visit_occurrences;
      DROP TABLE provider_visit_planning_queue;
    `);
  }
}
