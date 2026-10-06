import type { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateProviderContacts1791220000000 implements MigrationInterface {
  name = 'CreateProviderContacts1791220000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE personal_info_provider (
      id bigserial PRIMARY KEY,
      provider_id bigint NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
      name varchar(255) NOT NULL CHECK (length(trim(name)) > 0),
      phone jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(phone) = 'array' AND jsonb_array_length(phone) <= 10),
      email varchar(254),
      schedule jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(schedule) = 'object'),
      description text CHECK (length(description) <= 2000),
      is_active boolean NOT NULL DEFAULT true,
      version integer NOT NULL DEFAULT 1 CHECK (version > 0),
      creation_key uuid NOT NULL,
      creation_hash char(64) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      'CREATE INDEX idx_provider_contact_provider ON personal_info_provider (provider_id, id)',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX uq_provider_contact_creation ON personal_info_provider (provider_id, creation_key)',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE personal_info_provider');
  }
}
