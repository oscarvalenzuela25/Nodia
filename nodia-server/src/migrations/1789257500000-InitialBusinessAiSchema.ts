import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Frozen initial schema; independent of live entity metadata. Existing complete schemas are preserved. */
export class InitialBusinessAiSchema1789257500000 implements MigrationInterface {
  name = 'InitialBusinessAiSchema1789257500000';

  async up(runner: QueryRunner): Promise<void> {
    const tables = [
      'businesses',
      'business_collaborators',
      'business_actions',
      'providers',
      'products',
      'product_logs',
      'invoices',
      'ai_providers',
      'ai_api_keys',
      'ai_provider_events',
    ];
    const existing: Array<{ tablename: string }> = await runner.query(
      'SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename = ANY($1::text[])',
      [tables],
    );
    if (existing.length !== 0 && existing.length !== tables.length) {
      throw new Error(
        'InitialBusinessAiSchema: partial schema; reconcile it before migrating.',
      );
    }
    if (existing.length === 0) {
      const statements = [
        'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
        "CREATE TYPE \"public\".\"ai_api_keys_health_state_enum\" AS ENUM('untested', 'valid', 'needs_review', 'cooldown')",
        `CREATE TABLE "ai_api_keys" (
  "id" BIGSERIAL NOT NULL,
  "provider_id" bigint NOT NULL,
  "label" character varying(100) NOT NULL,
  "secret_ciphertext" text NOT NULL,
  "secret_fingerprint" character varying(64) NOT NULL,
  "display_hint" character varying(16) NOT NULL,
  "sort_order" integer NOT NULL DEFAULT '0',
  "is_selected" boolean NOT NULL DEFAULT false,
  "health_state" "public"."ai_api_keys_health_state_enum" NOT NULL DEFAULT 'untested',
  "last_error_code" character varying(64),
  "last_error_message" text,
  "last_error_at" TIMESTAMP WITH TIME ZONE,
  "last_success_at" TIMESTAMP WITH TIME ZONE,
  "cooldown_until" TIMESTAMP WITH TIME ZONE,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_973805dc2f4b86e39671aba3b13" PRIMARY KEY ("id")
)`,
        'CREATE INDEX "idx_ai_api_key_selection" ON "ai_api_keys"  ("provider_id",\n  "is_selected") ',
        'CREATE INDEX "idx_ai_api_key_rotation" ON "ai_api_keys"  ("provider_id",\n  "sort_order",\n  "id") ',
        'CREATE UNIQUE INDEX "uq_ai_api_key_fingerprint" ON "ai_api_keys"  ("provider_id",\n  "secret_fingerprint") ',
        `CREATE TABLE "ai_providers" (
  "id" BIGSERIAL PRIMARY KEY,
  "key" varchar,
  "fields" jsonb NOT NULL DEFAULT '{}',
  "auto_rotate_api_keys" boolean NOT NULL DEFAULT true,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
)`,
        `CREATE TABLE "ai_provider_events" (
  "id" BIGSERIAL NOT NULL,
  "provider_id" bigint NOT NULL,
  "api_key_id" bigint,
  "actor_user_id" bigint,
  "event_type" character varying(64) NOT NULL,
  "reason_code" character varying(64),
  "message" text,
  "metadata" jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_9f45923e70ff30fa266f9b71801" PRIMARY KEY ("id")
)`,
        'CREATE INDEX "idx_ai_api_key_events_recent" ON "ai_provider_events"  ("api_key_id",\n  "created_at") ',
        'CREATE INDEX "idx_ai_provider_events_recent" ON "ai_provider_events"  ("provider_id",\n  "created_at") ',
        `CREATE TABLE "businesses" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "name" character varying(255) NOT NULL,
  "owner_id" bigint NOT NULL,
  "has_description" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_bc1bf63498dd2368ce3dc8686e8" PRIMARY KEY ("id")
)`,
        'CREATE INDEX "idx_businesses_owner_id" ON "businesses"  ("owner_id") ',
        `CREATE TABLE "business_collaborators" (
  "id" BIGSERIAL NOT NULL,
  "position" character varying(255),
  "user_id" bigint NOT NULL,
  "business_id" uuid NOT NULL,
  "action_ids" bigint array NOT NULL DEFAULT '{}',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_255f69a401c4b42d9156cd51eef" PRIMARY KEY ("id")
)`,
        'CREATE UNIQUE INDEX "uq_business_collaborator_user" ON "business_collaborators"  ("business_id",\n  "user_id") ',
        `CREATE TABLE "business_actions" (
  "id" BIGSERIAL NOT NULL,
  "key" character varying(255) NOT NULL,
  "has_description" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_d7c6d19463f12a9468b9c345b14" UNIQUE ("key"),
  CONSTRAINT "PK_51fa5bc9a64467b92a1f327a2bb" PRIMARY KEY ("id")
)`,
        `CREATE TABLE "providers" (
  "id" BIGSERIAL NOT NULL,
  "business_id" uuid NOT NULL,
  "name" character varying(255) NOT NULL,
  "tax" integer NOT NULL DEFAULT '19',
  "fields" jsonb NOT NULL DEFAULT '{}',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_af13fc2ebf382fe0dad2e4793aa" PRIMARY KEY ("id")
)`,
        'CREATE INDEX "idx_providers_business_id" ON "providers"  ("business_id") ',
        `CREATE TABLE "invoices" (
  "id" BIGSERIAL NOT NULL,
  "business_id" uuid NOT NULL,
  "provider_id" bigint,
  "code" character varying(255) NOT NULL,
  "total_amount" integer NOT NULL DEFAULT '0',
  "path_storage" character varying(255) NOT NULL DEFAULT '',
  "data" jsonb NOT NULL DEFAULT '{}',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id")
)`,
        'CREATE INDEX "idx_invoices_business_id" ON "invoices"  ("business_id") ',
        'CREATE INDEX "idx_invoices_provider_id" ON "invoices"  ("provider_id") ',
        `CREATE TABLE "product_logs" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "product_id" bigint NOT NULL,
  "code" character varying(255) NOT NULL,
  "name" character varying(255) NOT NULL,
  "cost_price" integer NOT NULL,
  "cost_price_tax" integer NOT NULL,
  "profit_percentage" integer NOT NULL,
  "sale_price" integer NOT NULL,
  "stock" integer NOT NULL DEFAULT '0',
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_ad37f6de95ac979cc3d3468f29f" PRIMARY KEY ("id")
)`,
        'CREATE INDEX "idx_product_logs_product_id" ON "product_logs"  ("product_id") ',
        `CREATE TABLE "products" (
  "id" BIGSERIAL NOT NULL,
  "business_id" uuid NOT NULL,
  "provider_id" bigint,
  "code" character varying(255) NOT NULL,
  "name" character varying(255) NOT NULL,
  "cost_price" integer NOT NULL,
  "cost_price_tax" integer NOT NULL,
  "profit_percentage" integer NOT NULL,
  "sale_price" integer NOT NULL,
  "stock" integer NOT NULL DEFAULT '0',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id")
)`,
        'CREATE INDEX "idx_products_business_id" ON "products"  ("business_id") ',
        'CREATE INDEX "idx_products_provider_id" ON "products"  ("provider_id") ',
        'CREATE UNIQUE INDEX "uq_business_product_code" ON "products"  ("business_id",\n  "code") ',
        'ALTER TABLE "ai_api_keys" ADD CONSTRAINT "FK_9df6b926cb0f3b53bfa2ee2e915" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
        'ALTER TABLE "ai_provider_events" ADD CONSTRAINT "FK_9324a669d2b8984677fed79f8a2" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
        'ALTER TABLE "ai_provider_events" ADD CONSTRAINT "FK_387ea59a410771844404f33a9d6" FOREIGN KEY ("api_key_id") REFERENCES "ai_api_keys"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
        'ALTER TABLE "ai_provider_events" ADD CONSTRAINT "FK_42a9f052d9544b09e8ea59f5b1f" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
        'ALTER TABLE "businesses" ADD CONSTRAINT "FK_8881b96819252080592fe1592ea" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
        'ALTER TABLE "business_collaborators" ADD CONSTRAINT "FK_90dd95f2d55be7af5104eb01403" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
        'ALTER TABLE "business_collaborators" ADD CONSTRAINT "FK_72d3b8db0c497757a835bda5181" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
        'ALTER TABLE "providers" ADD CONSTRAINT "FK_92ed3a8179380f5acbc400d37b8" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
        'ALTER TABLE "invoices" ADD CONSTRAINT "FK_8f96c84343bd7d6cb4374e9788f" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
        'ALTER TABLE "invoices" ADD CONSTRAINT "FK_8cab41f81fdc5629bfc92f1bdaf" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
        'ALTER TABLE "product_logs" ADD CONSTRAINT "FK_3508cbbf6e40f50ce23a3255708" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
        'ALTER TABLE "products" ADD CONSTRAINT "FK_6706ea94d32be01f9272ccc3512" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
        'ALTER TABLE "products" ADD CONSTRAINT "FK_487f08da85a58f1fa47863a9474" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
      ];
      for (const sql of statements) await runner.query(sql);
    }
  }

  async down(): Promise<void> {
    throw new Error(
      'InitialBusinessAiSchema is an initial baseline; rollback requires an explicitly verified backup.',
    );
  }
}
