export function readAuthConfig(environment: NodeJS.ProcessEnv) {
  const secret = environment.AUTH_JWT_SECRET;
  const googleClientId = environment.GOOGLE_CLIENT_ID;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('AUTH_JWT_SECRET must contain at least 32 bytes');
  }
  if (!googleClientId?.endsWith('.apps.googleusercontent.com')) {
    throw new Error('GOOGLE_CLIENT_ID must be a Google OAuth web client ID');
  }
  const production = environment.NODE_ENV === 'production';
  const origins = (
    environment.AUTH_ALLOWED_ORIGINS ??
    (production ? '' : 'http://localhost:5174')
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (
    !origins.length ||
    origins.some((origin) => {
      try {
        const url = new URL(origin);
        return (
          url.origin !== origin ||
          !['http:', 'https:'].includes(url.protocol) ||
          (production && url.protocol !== 'https:')
        );
      } catch {
        return true;
      }
    })
  )
    throw new Error(
      'AUTH_ALLOWED_ORIGINS must contain exact origins (HTTPS in production)',
    );
  const sameSite = environment.AUTH_COOKIE_SAME_SITE ?? 'lax';
  if (!['lax', 'strict', 'none'].includes(sameSite))
    throw new Error('Invalid AUTH_COOKIE_SAME_SITE');
  const secure = production || environment.AUTH_COOKIE_SECURE === 'true';
  if (sameSite === 'none' && !secure)
    throw new Error('SameSite=None requires AUTH_COOKIE_SECURE=true');
  return {
    secret,
    googleClientId,
    origins,
    secure,
    sameSite: sameSite as 'lax' | 'strict' | 'none',
    accessSeconds: 15 * 60,
    refreshSeconds: 7 * 24 * 60 * 60,
    issuer: 'nodia',
    accessAudience: 'nodia:api',
    refreshAudience: 'nodia:refresh',
    cookieName: 'nodia_refresh',
    cookiePath: '/api/v1/auth',
  };
}

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
export type AuthConfig = ReturnType<typeof readAuthConfig>;
