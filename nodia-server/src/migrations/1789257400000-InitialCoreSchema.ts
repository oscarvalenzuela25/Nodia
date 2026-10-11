import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Frozen initial schema; independent of live entity metadata. Existing complete schemas are preserved. */
export class InitialCoreSchema1789257400000 implements MigrationInterface {
  name = 'InitialCoreSchema1789257400000';

  async up(runner: QueryRunner): Promise<void> {
    const tables = [
      'users',
      'roles',
      'actions',
      'module_groups',
      'modules',
      'user_roles',
      'role_actions',
      'user_modules',
      'translations',
    ];
    const existing: Array<{ tablename: string }> = await runner.query(
      'SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename = ANY($1::text[])',
      [tables],
    );
    if (existing.length !== 0 && existing.length !== tables.length) {
      throw new Error(
        'InitialCoreSchema: partial schema; reconcile it before migrating.',
      );
    }
    if (existing.length === 0) {
      const statements = [
        `CREATE TABLE "module_groups" (
  "id" BIGSERIAL NOT NULL,
  "key" character varying NOT NULL,
  "icon" character varying(255),
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_4f8af3f23af0dcbc31732a98067" UNIQUE ("key"),
  CONSTRAINT "PK_0ab9a7b2b811832ffc4396d1339" PRIMARY KEY ("id")
)`,
        `CREATE TABLE "modules" (
  "id" BIGSERIAL NOT NULL,
  "module_group_id" bigint NOT NULL,
  "link" character varying(255) NOT NULL,
  "icon" character varying(255),
  "key" character varying NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_a57f2b3bd9ebb022212e634f601" UNIQUE ("key"),
  CONSTRAINT "PK_7dbefd488bd96c5bf31f0ce0c95" PRIMARY KEY ("id")
)`,
        'CREATE INDEX "idx_modules_module_group_id" ON "modules"  ("module_group_id") ',
        `CREATE TABLE "user_modules" (
  "id" BIGSERIAL NOT NULL,
  "user_id" bigint NOT NULL,
  "module_id" bigint NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_01ede6942013a660f81c456031e" PRIMARY KEY ("id")
)`,
        'CREATE UNIQUE INDEX "uq_user_module" ON "user_modules"  ("user_id",\n  "module_id") ',
        `CREATE TABLE "users" (
  "id" BIGSERIAL NOT NULL,
  "name" character varying,
  "email" text NOT NULL,
  "image_url" text,
  "google_sub" character varying,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
  CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
)`,
        'CREATE UNIQUE INDEX "uq_users_google_sub" ON "users"  ("google_sub") ',
        `CREATE TABLE "user_roles" (
  "id" BIGSERIAL NOT NULL,
  "user_id" bigint NOT NULL,
  "role_id" bigint NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_8acd5cf26ebd158416f477de799" PRIMARY KEY ("id")
)`,
        `CREATE TABLE "roles" (
  "id" BIGSERIAL NOT NULL,
  "key" character varying NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_a87cf0659c3ac379b339acf36a2" UNIQUE ("key"),
  CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id")
)`,
        `CREATE TABLE "role_actions" (
  "id" BIGSERIAL NOT NULL,
  "role_id" bigint NOT NULL,
  "action_id" bigint NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_5ee58f1e3c6236c691f190e0781" PRIMARY KEY ("id")
)`,
        `CREATE TABLE "actions" (
  "id" BIGSERIAL NOT NULL,
  "key" character varying NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_577192f12af5677b0f83478994c" UNIQUE ("key"),
  CONSTRAINT "PK_7bfb822f56be449c0b8adbf83cf" PRIMARY KEY ("id")
)`,
        `CREATE TABLE "translations" (
  "id" BIGSERIAL NOT NULL,
  "source_entity" character varying(255) NOT NULL,
  "source_id" character varying(255) NOT NULL,
  "source_key" character varying(255) NOT NULL,
  "locale" character varying(10) NOT NULL,
  "value" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_aca248c72ae1fb2390f1bf4cd87" PRIMARY KEY ("id")
)`,
        'CREATE INDEX "idx_translation_lookup" ON "translations"  ("locale",\n  "source_entity",\n  "source_id") ',
        'CREATE UNIQUE INDEX "uq_translation_entity_id_key_locale" ON "translations"  ("source_entity",\n  "source_id",\n  "source_key",\n  "locale") ',
        'ALTER TABLE "modules" ADD CONSTRAINT "FK_3b4004634b916bac96b1dc57e6a" FOREIGN KEY ("module_group_id") REFERENCES "module_groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
        'ALTER TABLE "user_modules" ADD CONSTRAINT "FK_5842b0e6bae3cf2f28d36f5b35f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
        'ALTER TABLE "user_modules" ADD CONSTRAINT "FK_8d557af52554a188e079b198e98" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
        'ALTER TABLE "user_roles" ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
        'ALTER TABLE "user_roles" ADD CONSTRAINT "FK_b23c65e50a758245a33ee35fda1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
        'ALTER TABLE "role_actions" ADD CONSTRAINT "FK_2ed4344d4ad234b70b11e3014ed" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
        'ALTER TABLE "role_actions" ADD CONSTRAINT "FK_44d5d313574bc10682b67004239" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
      ];
      for (const sql of statements) await runner.query(sql);
    }
    // Stable Core defaults only. Never create users or promote an account in a migration.
    await runner.query(
      `INSERT INTO roles (key,is_active) VALUES ('super_admin',true) ON CONFLICT(key) DO NOTHING`,
    );
    await runner.query(
      `INSERT INTO module_groups (key,is_active) VALUES ('general_settings',true) ON CONFLICT(key) DO NOTHING`,
    );
    await runner.query(`INSERT INTO modules (key,link,module_group_id,is_active)
      SELECT defaults.key,defaults.link,g.id,true FROM module_groups g
      CROSS JOIN (VALUES ('actions','/settings/actions'),('roles','/settings/roles'),('users','/settings/users'),('modules','/settings/modules')) defaults(key,link)
      WHERE g.key='general_settings' ON CONFLICT(key) DO NOTHING`);
    await runner.query(`INSERT INTO translations (source_entity,source_id,source_key,locale,value,is_active)
      SELECT source.entity,source.id::text,'key',labels.locale,
        CASE labels.locale WHEN 'es' THEN source.es ELSE source.en END,true
      FROM (
        SELECT 'roles' AS entity,id,'Super Administrador' AS es,'Super Administrator' AS en FROM roles WHERE key='super_admin'
        UNION ALL SELECT 'module_groups',id,'Administrador General','General Administration' FROM module_groups WHERE key='general_settings'
        UNION ALL SELECT 'modules',m.id,labels.es,labels.en FROM modules m
          JOIN (VALUES ('actions','Acciones','Actions'),('roles','Roles','Roles'),('users','Usuarios','Users'),('modules','Módulos','Modules')) labels(key,es,en) ON labels.key=m.key
      ) source CROSS JOIN (VALUES ('es'),('en')) labels(locale)
      ON CONFLICT(source_entity,source_id,source_key,locale) DO NOTHING`);
  }

  async down(): Promise<void> {
    throw new Error(
      'InitialCoreSchema is an initial baseline; rollback requires an explicitly verified backup.',
    );
  }
}
