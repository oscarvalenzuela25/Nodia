-- ==============================================================================
-- Nodia Database Seed
-- ==============================================================================

BEGIN;

-- 1. Usuario: Oscar (oavr.18@gmail.com)
INSERT INTO "users" ("id", "name", "email", "image_url", "is_active", "created_at", "updated_at")
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Oscar',
    'oavr.18@gmail.com',
    NULL,
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT ("email") DO UPDATE 
SET 
    "name" = EXCLUDED."name",
    "is_active" = EXCLUDED."is_active",
    "updated_at" = NOW();

-- 2. Rol: superAdmin
INSERT INTO "roles" ("id", "key", "is_active", "created_at", "updated_at")
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'superAdmin',
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT ("key") DO UPDATE
SET 
    "is_active" = EXCLUDED."is_active",
    "updated_at" = NOW();

-- 3. Módulo Padre: generalSettings
INSERT INTO "modules" ("id", "key", "type", "parent_id", "is_active", "created_at", "updated_at")
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'generalSettings',
    'module',
    NULL,
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT ("key") DO UPDATE
SET 
    "type" = EXCLUDED."type",
    "is_active" = EXCLUDED."is_active",
    "updated_at" = NOW();

-- 4. Submódulo: users (asociado a generalSettings)
INSERT INTO "modules" ("id", "key", "type", "parent_id", "is_active", "created_at", "updated_at")
VALUES (
    'c0000000-0000-0000-0000-000000000002',
    'users',
    'subModule',
    (SELECT "id" FROM "modules" WHERE "key" = 'generalSettings' LIMIT 1),
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT ("key") DO UPDATE
SET 
    "parent_id" = EXCLUDED."parent_id",
    "type" = EXCLUDED."type",
    "is_active" = EXCLUDED."is_active",
    "updated_at" = NOW();

-- 5. Acción: viewUsersPage (asociada al submódulo users)
INSERT INTO "actions" ("id", "module_id", "key", "description", "is_active", "created_at", "updated_at")
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    (SELECT "id" FROM "modules" WHERE "key" = 'users' LIMIT 1),
    'viewUsersPage',
    NULL,
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT ("key") DO UPDATE
SET 
    "module_id" = EXCLUDED."module_id",
    "is_active" = EXCLUDED."is_active",
    "updated_at" = NOW();

-- 6. Pivote user_roles: Asignar superAdmin a Oscar
INSERT INTO "user_roles" ("user_id", "role_id", "is_active", "created_at", "updated_at")
VALUES (
    (SELECT "id" FROM "users" WHERE "email" = 'oavr.18@gmail.com' LIMIT 1),
    (SELECT "id" FROM "roles" WHERE "key" = 'superAdmin' LIMIT 1),
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT ("user_id", "role_id") DO UPDATE
SET 
    "is_active" = EXCLUDED."is_active",
    "updated_at" = NOW();

-- 7. Pivote role_actions: Asignar viewUsersPage a superAdmin
INSERT INTO "role_actions" ("role_id", "action_id", "is_active", "created_at", "updated_at")
VALUES (
    (SELECT "id" FROM "roles" WHERE "key" = 'superAdmin' LIMIT 1),
    (SELECT "id" FROM "actions" WHERE "key" = 'viewUsersPage' LIMIT 1),
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT ("role_id", "action_id") DO UPDATE
SET 
    "is_active" = EXCLUDED."is_active",
    "updated_at" = NOW();

COMMIT;
