/** Synthetic authority for disposable SQL harnesses; never load against an application DB. */
export async function installBusinessAccessFixture(source) {
  await source.query(`
    CREATE TABLE IF NOT EXISTS users(id bigint PRIMARY KEY,is_active boolean NOT NULL DEFAULT true);
    CREATE TABLE IF NOT EXISTS auth_sessions(public_id uuid PRIMARY KEY,user_id bigint NOT NULL,revoked_at timestamptz,expires_at timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS roles(id bigint PRIMARY KEY,key text NOT NULL,is_active boolean NOT NULL DEFAULT true);
    CREATE TABLE IF NOT EXISTS user_roles(user_id bigint NOT NULL,role_id bigint NOT NULL,is_active boolean NOT NULL DEFAULT true);
    CREATE TABLE IF NOT EXISTS actions(id bigint PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS role_actions(id bigint PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS modules(id bigint PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS module_groups(id bigint PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS user_modules(id bigint PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS businesses(id uuid PRIMARY KEY,owner_id bigint NOT NULL DEFAULT 1);
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_id bigint NOT NULL DEFAULT 1;
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS name varchar(255) NOT NULL DEFAULT 'Synthetic business';
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS has_description boolean NOT NULL DEFAULT false;
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
    CREATE TABLE IF NOT EXISTS business_collaborators(business_id uuid NOT NULL,user_id bigint NOT NULL,is_active boolean NOT NULL DEFAULT true);
    INSERT INTO users(id) VALUES(1),(2),(3) ON CONFLICT DO NOTHING;
    INSERT INTO roles(id,key) VALUES(1,'super_admin') ON CONFLICT DO NOTHING;
    INSERT INTO user_roles(user_id,role_id) VALUES(3,1);
  `);
  for (const id of ['1', '2', '3']) {
    await source.query(
      `INSERT INTO auth_sessions(public_id,user_id,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 day')`,
      [businessAccessTestSession(id), id],
    );
  }
}

export function businessAccessTestSession(userId) {
  return `${userId.repeat(8)}-${userId.repeat(4)}-4${userId.repeat(3)}-8${userId.repeat(3)}-${userId.repeat(12)}`;
}

export function businessAccessTestPrincipal(userId = '1') {
  return {
    user: {
      id: userId,
      name: 'Synthetic actor',
      email: `${userId}@example.test`,
      image_url: null,
    },
    sessionId: businessAccessTestSession(userId),
  };
}
