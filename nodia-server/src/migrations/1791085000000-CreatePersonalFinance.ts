import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Incremental migration; requires the existing users table, never synchronizes it. */
export class CreatePersonalFinance1791085000000 implements MigrationInterface {
  name = 'CreatePersonalFinance1791085000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['finance_categories', 'finance_category_groups']) {
      await queryRunner.query(`CREATE TABLE ${table} (
        id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL,
        name VARCHAR(255) NOT NULL, key VARCHAR(255) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_${table}_user_key UNIQUE (user_id,key),
        CONSTRAINT uq_${table}_user_id UNIQUE (user_id,id),
        CONSTRAINT fk_${table}_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION
      )`);
    }
    await queryRunner.query(`CREATE TABLE finance_category_group_memberships (
      id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL,
      category_group_id BIGINT NOT NULL, category_id BIGINT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_finance_memberships_user_group_category UNIQUE (user_id,category_group_id,category_id),
      CONSTRAINT fk_finance_memberships_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION,
      CONSTRAINT fk_finance_memberships_group FOREIGN KEY (user_id,category_group_id) REFERENCES finance_category_groups(user_id,id) ON DELETE NO ACTION,
      CONSTRAINT fk_finance_memberships_category FOREIGN KEY (user_id,category_id) REFERENCES finance_categories(user_id,id) ON DELETE NO ACTION
    )`);
    await queryRunner.query(`CREATE INDEX idx_finance_memberships_user_category_group
      ON finance_category_group_memberships(user_id,category_id,category_group_id)`);
    await queryRunner.query(`CREATE TABLE finance_obligations (
      id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL,
      name VARCHAR(255) NOT NULL, key VARCHAR(255) NOT NULL,
      type VARCHAR(255) NOT NULL, amount BIGINT NOT NULL, description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_finance_obligations_user_key UNIQUE (user_id,key),
      CONSTRAINT uq_finance_obligations_user_id UNIQUE (user_id,id),
      CONSTRAINT ck_finance_obligations_type CHECK (type IN ('loan','debt')),
      CONSTRAINT ck_finance_obligations_amount CHECK (amount > 0),
      CONSTRAINT fk_finance_obligations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION
    )`);
    await queryRunner.query(`CREATE TABLE finance_movements (
      id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL,
      category_id BIGINT NOT NULL, obligation_id BIGINT,
      name VARCHAR(255) NOT NULL, amount BIGINT NOT NULL,
      type VARCHAR(255) NOT NULL, status VARCHAR(255) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT ck_finance_movements_amount CHECK (amount > 0),
      CONSTRAINT ck_finance_movements_type CHECK (type IN ('income','expense')),
      CONSTRAINT ck_finance_movements_status CHECK (
        (type='income' AND status IN ('pending','received','cancelled')) OR
        (type='expense' AND status IN ('pending','paid','cancelled'))),
      CONSTRAINT fk_finance_movements_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION,
      CONSTRAINT fk_finance_movements_category FOREIGN KEY (user_id,category_id) REFERENCES finance_categories(user_id,id) ON DELETE NO ACTION,
      CONSTRAINT fk_finance_movements_obligation FOREIGN KEY (user_id,obligation_id) REFERENCES finance_obligations(user_id,id) ON DELETE NO ACTION
    )`);
    await queryRunner.query(`CREATE INDEX idx_finance_movements_user_created
      ON finance_movements(user_id,created_at DESC,id DESC)`);
    await queryRunner.query(`CREATE INDEX idx_finance_movements_user_category_created
      ON finance_movements(user_id,category_id,created_at DESC,id DESC)`);
    await queryRunner.query(`CREATE INDEX idx_finance_movements_user_obligation_type_status
      ON finance_movements(user_id,obligation_id,type,status) WHERE obligation_id IS NOT NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Destructive for finance data only: take a backup before applying rollback.
    for (const table of [
      'finance_movements',
      'finance_obligations',
      'finance_category_group_memberships',
      'finance_category_groups',
      'finance_categories',
    ]) {
      await queryRunner.query(`DROP TABLE ${table}`);
    }
  }
}
