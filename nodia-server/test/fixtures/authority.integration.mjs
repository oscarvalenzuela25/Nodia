// Test-only authority tables for legacy partial-schema harnesses, never configured DBs.
// AI-08's separate integration harness uses real Core/Auth migrations instead.
import { randomUUID } from 'node:crypto';

export async function installAuthorityFixture(database, userIds) {
  await database.query(`
    CREATE TABLE IF NOT EXISTS users(id bigint PRIMARY KEY, name varchar, email varchar, is_active boolean DEFAULT true);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS name varchar;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email varchar;
    CREATE TABLE IF NOT EXISTS roles(id bigint PRIMARY KEY, key varchar, is_active boolean DEFAULT true);
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS key varchar;
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
    CREATE TABLE IF NOT EXISTS user_roles(id bigserial PRIMARY KEY, user_id bigint, role_id bigint, is_active boolean DEFAULT true);
    ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
    CREATE TABLE IF NOT EXISTS actions(id bigint PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS role_actions(id bigserial PRIMARY KEY, role_id bigint, action_id bigint);
    CREATE TABLE IF NOT EXISTS modules(id bigint PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS module_groups(id bigint PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS user_modules(id bigserial PRIMARY KEY,user_id bigint,module_id bigint);
    CREATE TABLE IF NOT EXISTS auth_sessions(id bigserial PRIMARY KEY,public_id uuid UNIQUE NOT NULL,user_id bigint NOT NULL,revoked_at timestamptz,expires_at timestamptz NOT NULL);
  `);
  const identities = new Map();
  for (const id of userIds) {
    await database.query(
      "INSERT INTO users(id,name,email,is_active) VALUES($1,'Synthetic authority fixture',$2,true) ON CONFLICT(id) DO NOTHING",
      [id, `authority${id}@example.invalid`],
    );
    const sessionId = randomUUID();
    await database.query(
      "INSERT INTO auth_sessions(public_id,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
      [sessionId, id],
    );
    identities.set(id, { userId: id, sessionId });
  }
  return {
    actor(id = userIds[0]) {
      const identity = identities.get(id);
      if (!identity) throw Error('Unknown synthetic identity');
      return identity;
    },
    principal(id = userIds[0]) {
      const identity = this.actor(id);
      return {
        user: {
          id,
          name: 'Synthetic',
          email: `authority${id}@example.invalid`,
          image_url: null,
        },
        sessionId: identity.sessionId,
      };
    },
  };
}
