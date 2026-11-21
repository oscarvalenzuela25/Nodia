import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVisitNotificationSettings1793850000000 implements MigrationInterface {
  name = 'CreateVisitNotificationSettings1793850000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE provider_visit_notification_preferences (
        user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        enabled boolean NOT NULL DEFAULT false,
        PRIMARY KEY (user_id, business_id)
      );
      CREATE INDEX idx_provider_visit_notification_business
        ON provider_visit_notification_preferences (business_id, user_id) WHERE enabled;

      CREATE TABLE web_push_installations (
        user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        installation_id uuid NOT NULL,
        session_id uuid NOT NULL,
        state text NOT NULL CHECK (state IN ('active', 'revoked', 'expired')),
        revision integer NOT NULL CHECK (revision > 0),
        key_id varchar(64),
        endpoint_fingerprint varchar(64),
        subscription_fingerprint varchar(64),
        subscription_ciphertext text,
        expires_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        PRIMARY KEY (user_id, installation_id),
        CHECK ((state = 'active') = (key_id IS NOT NULL)),
        CHECK ((state = 'active') = (endpoint_fingerprint IS NOT NULL)),
        CHECK ((state = 'active') = (subscription_fingerprint IS NOT NULL)),
        CHECK ((state = 'active') = (subscription_ciphertext IS NOT NULL)),
        CHECK (state = 'active' OR expires_at IS NULL)
      );
      CREATE UNIQUE INDEX uq_web_push_installations_active_endpoint
        ON web_push_installations (endpoint_fingerprint) WHERE state = 'active';
      CREATE INDEX idx_web_push_installations_active_session
        ON web_push_installations (user_id, session_id) WHERE state = 'active';
      CREATE INDEX idx_web_push_installations_expiration
        ON web_push_installations (expires_at) WHERE state = 'active' AND expires_at IS NOT NULL;
      CREATE INDEX idx_web_push_installations_retired
        ON web_push_installations (updated_at) WHERE state <> 'active';

      CREATE FUNCTION revoke_web_push_installations_for_session() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        UPDATE web_push_installations
           SET state='revoked', revision=revision+1, key_id=NULL,
               endpoint_fingerprint=NULL, subscription_fingerprint=NULL,
               subscription_ciphertext=NULL, expires_at=NULL,
               updated_at=clock_timestamp()
         WHERE user_id=NEW.user_id AND session_id=NEW.public_id AND state='active';
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER auth_session_revoke_web_push_installations
        AFTER UPDATE OF revoked_at ON auth_sessions
        FOR EACH ROW
        WHEN (OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL)
        EXECUTE FUNCTION revoke_web_push_installations_for_session();
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE auth_sessions, provider_visit_notification_preferences, web_push_installations IN ACCESS EXCLUSIVE MODE;
      DO $guard$
      BEGIN
        IF EXISTS (SELECT 1 FROM provider_visit_notification_preferences)
          OR EXISTS (SELECT 1 FROM web_push_installations) THEN
          RAISE EXCEPTION 'Web Push settings must be preserved before dropping these tables';
        END IF;
      END $guard$;
      DROP TRIGGER auth_session_revoke_web_push_installations ON auth_sessions;
      DROP FUNCTION revoke_web_push_installations_for_session();
      DROP TABLE web_push_installations, provider_visit_notification_preferences;
    `);
  }
}
