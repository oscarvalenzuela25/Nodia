import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProviderVisitDeliveries1793870000000
  implements MigrationInterface
{
  name = 'CreateProviderVisitDeliveries1793870000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE provider_visit_deliveries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id uuid NOT NULL,
        provider_id bigint NOT NULL,
        contact_id bigint NOT NULL,
        visit_date date NOT NULL,
        user_id bigint NOT NULL,
        installation_id uuid NOT NULL,
        source_revision bigint NOT NULL CHECK (source_revision > 0),
        installation_revision integer NOT NULL CHECK (installation_revision > 0),
        state text NOT NULL CHECK (state IN (
          'pending', 'leased', 'sending', 'retry', 'accepted', 'failed',
          'expired', 'cancelled', 'unknown'
        )),
        attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
        expires_at timestamptz NOT NULL,
        next_attempt_at timestamptz,
        lease_token uuid,
        lease_expires_at timestamptz,
        last_http_status integer CHECK (last_http_status BETWEEN 100 AND 599),
        last_reason varchar(64),
        updated_at timestamptz NOT NULL,
        CONSTRAINT uq_provider_visit_delivery_installation UNIQUE (
          business_id, provider_id, contact_id, visit_date, user_id, installation_id
        ),
        CHECK ((lease_token IS NULL) = (lease_expires_at IS NULL)),
        CHECK ((state IN ('leased', 'sending')) = (lease_token IS NOT NULL)),
        CHECK ((state IN ('pending', 'retry')) = (next_attempt_at IS NOT NULL))
      );
      CREATE INDEX provider_visit_deliveries_ready
        ON provider_visit_deliveries (next_attempt_at, id) WHERE state IN ('pending', 'retry');
      CREATE INDEX provider_visit_deliveries_unarmed_expiry
        ON provider_visit_deliveries (expires_at, id) WHERE state IN ('pending', 'retry');
      CREATE INDEX provider_visit_deliveries_leases
        ON provider_visit_deliveries (lease_expires_at, id) WHERE state IN ('leased', 'sending');
      CREATE INDEX provider_visit_deliveries_retention
        ON provider_visit_deliveries (updated_at, id)
        WHERE state IN ('accepted', 'failed', 'expired', 'cancelled', 'unknown');
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE provider_visit_deliveries IN ACCESS EXCLUSIVE MODE;
      DO $guard$
      BEGIN
        IF EXISTS (SELECT 1 FROM provider_visit_deliveries) THEN
          RAISE EXCEPTION 'Preserve the Web Push delivery journal before removing this migration';
        END IF;
      END $guard$;
      DROP TABLE provider_visit_deliveries;
    `);
  }
}
