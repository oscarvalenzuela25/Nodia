import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { EntityManager } from 'typeorm';
import { AuthService } from '../auth.service.js';
import { AuthTokenService } from '../auth-token.service.js';
import { readAuthConfig } from '../auth.config.js';
import { GoogleIdentityService } from '../google-identity.service.js';
import { CreateSessionUseCase } from './create-session.use-case.js';
import { LoginUseCase } from './login.use-case.js';
import { RefreshSessionUseCase } from './refresh-session.use-case.js';
import { LogoutUseCase } from './logout.use-case.js';
import { AuthenticateRequestUseCase } from './authenticate-request.use-case.js';
import { AuthSession } from '../entities/auth-session.entity.js';
import { User } from '../../user/entities/user.entity.js';

const config = readAuthConfig({
  AUTH_JWT_SECRET: 'test-only-secret-with-at-least-32-bytes-long',
  GOOGLE_CLIENT_ID: 'test.apps.googleusercontent.com',
  NODE_ENV: 'test',
});
const jwt = new JwtService();
const tokens = new AuthTokenService(jwt, config);
const manager = {} as EntityManager;
const google = { verify: vi.fn() };
const data = {
  transaction: vi.fn(),
  findLoginUser: vi.fn(),
  saveUser: vi.fn(),
  saveSession: vi.fn(),
  lockSession: vi.fn(),
  findUser: vi.fn(),
  findActiveSession: vi.fn(),
  revokeSession: vi.fn(),
};
const auth = data as unknown as AuthService;
let user: User;
let session: AuthSession;

beforeEach(() => {
  vi.clearAllMocks();
  user = Object.assign(new User(), {
    id: '42',
    email: 'user@gmail.com',
    name: null,
    image_url: null,
    is_active: true,
  });
  data.transaction.mockImplementation(
    (work: (manager: EntityManager) => Promise<unknown>) => work(manager),
  );
  data.findLoginUser.mockImplementation(async () => user);
  data.findUser.mockImplementation(async () => (user.is_active ? user : null));
  data.saveUser.mockImplementation(async (value: User) => value);
  data.saveSession.mockImplementation(async (value: AuthSession) => {
    session = value;
    return value;
  });
  data.lockSession.mockImplementation(async () => session);
  data.findActiveSession.mockImplementation(async () =>
    session?.revoked_at ? null : session,
  );
  data.revokeSession.mockImplementation(async () => {
    session.revoked_at = new Date();
  });
  google.verify.mockResolvedValue({
    subject: 'google-subject',
    email: 'user@gmail.com',
    name: 'Google Name',
    picture: 'https://example.com/avatar.png',
    authoritativeEmail: true,
  });
});

const createSession = () => new CreateSessionUseCase(auth, tokens, config);
const login = () =>
  new LoginUseCase(
    google as unknown as GoogleIdentityService,
    auth,
    createSession(),
  );
const signIn = () =>
  login().execute({ provider: 'google', credential: 'google-id-token' });

describe('LoginUseCase and CreateSessionUseCase', () => {
  it('verifies Google before lookup, fills empty identity fields and issues an independent session', async () => {
    const result = await signIn();
    expect(google.verify).toHaveBeenCalledWith('google-id-token');
    expect(data.findLoginUser).toHaveBeenCalledWith('user@gmail.com', manager);
    expect(user.google_sub).toBe('google-subject');
    expect(user.name).toBe('Google Name');
    expect(result.response.user.image_url).toBe(
      'https://example.com/avatar.png',
    );
    expect(session.refresh_token_hash).toBe(tokens.hash(result.refreshToken));
    expect(session.refresh_token_hash).not.toBe(result.refreshToken);
    expect(await tokens.verify(result.response.token, 'access')).toMatchObject({
      sub: '42',
      sid: session.public_id,
      token_use: 'access',
    });
    expect(result.response.expiresAt - Date.now()).toBeLessThanOrEqual(900_000);
    expect(result.refreshExpiresAt.getTime() - Date.now()).toBeGreaterThan(
      604_000_000,
    );
  });

  it('preserves an administrator-edited name and image', async () => {
    user.name = 'Admin name';
    user.image_url = 'https://example.com/edited.png';
    await signIn();
    expect(user.name).toBe('Admin name');
    expect(user.image_url).toBe('https://example.com/edited.png');
  });

  it.each(['absent', 'inactive', 'different-subject', 'untrusted-email'])(
    'does not create a user or session when identity is %s',
    async (reason) => {
      if (reason === 'absent') data.findLoginUser.mockResolvedValue(null);
      if (reason === 'inactive') user.is_active = false;
      if (reason === 'different-subject')
        user.google_sub = 'another-google-account';
      if (reason === 'untrusted-email')
        google.verify.mockResolvedValue({
          subject: 'external',
          email: user.email,
          authoritativeEmail: false,
        });
      await expect(signIn()).rejects.toThrow('auth:access_denied');
      expect(data.saveSession).not.toHaveBeenCalled();
      expect(data.saveUser).not.toHaveBeenCalled();
    },
  );

  it('does not touch the database on invalid Google credentials', async () => {
    google.verify.mockRejectedValue(new Error('Invalid Google signature'));
    await expect(signIn()).rejects.toThrow();
    expect(data.transaction).not.toHaveBeenCalled();
  });
});

describe('RefreshSessionUseCase', () => {
  it('rotates the cookie token without extending the absolute session lifetime', async () => {
    const original = await signIn();
    const result = await new RefreshSessionUseCase(auth, tokens).execute(
      original.refreshToken,
    );
    expect(result.refreshToken).not.toBe(original.refreshToken);
    expect(result.refreshExpiresAt).toEqual(original.refreshExpiresAt);
    expect(session.refresh_token_hash).toBe(tokens.hash(result.refreshToken));
  });

  it('commits revocation after replay and rejects even the newest access token', async () => {
    const original = await signIn();
    const refresh = new RefreshSessionUseCase(auth, tokens);
    const renewed = await refresh.execute(original.refreshToken);
    await expect(refresh.execute(original.refreshToken)).rejects.toThrow(
      'auth:session_expired',
    );
    expect(session.revoked_at).toBeInstanceOf(Date);
    await expect(
      new AuthenticateRequestUseCase(auth, tokens).execute(
        `Bearer ${renewed.response.token}`,
      ),
    ).rejects.toThrow('auth:session_expired');
  });

  it.each(['inactive-user', 'revoked', 'expired', 'wrong-user'])(
    'rejects renewal for %s',
    async (reason) => {
      const original = await signIn();
      if (reason === 'inactive-user') user.is_active = false;
      if (reason === 'revoked') session.revoked_at = new Date();
      if (reason === 'expired') session.expires_at = new Date(0);
      if (reason === 'wrong-user') session.user_id = '999';
      await expect(
        new RefreshSessionUseCase(auth, tokens).execute(original.refreshToken),
      ).rejects.toThrow('auth:session_expired');
    },
  );

  it('rejects an access JWT used as a refresh token, before database access', async () => {
    const original = await signIn();
    await expect(
      new RefreshSessionUseCase(auth, tokens).execute(original.response.token),
    ).rejects.toThrow();
    expect(data.lockSession).not.toHaveBeenCalled();
  });
});

describe('AuthenticateRequestUseCase and LogoutUseCase', () => {
  it.each([undefined, '', 'Basic abc', 'Bearer', 'Bearer abc def', 'Bearer abc\n'])('rejects a missing or malformed bearer header (%s)', async (header) => {
    await expect(new AuthenticateRequestUseCase(auth, tokens).execute(header)).rejects.toThrow();
    expect(data.findActiveSession).not.toHaveBeenCalled();
    expect(data.findUser).not.toHaveBeenCalled();
  });

  it('authenticates the user and session, then revokes access on logout', async () => {
    const original = await signIn();
    const authenticate = new AuthenticateRequestUseCase(auth, tokens);
    expect(
      await authenticate.execute(`Bearer ${original.response.token}`),
    ).toMatchObject({ user: { id: '42' } });
    await new LogoutUseCase(auth, tokens).execute(original.refreshToken);
    await expect(
      authenticate.execute(`Bearer ${original.response.token}`),
    ).rejects.toThrow();
  });

  it('does not authorize an inactive user with a still valid JWT', async () => {
    const original = await signIn();
    user.is_active = false;
    await expect(
      new AuthenticateRequestUseCase(auth, tokens).execute(
        `Bearer ${original.response.token}`,
      ),
    ).rejects.toThrow();
  });

  it.each(['expired', 'wrong-audience', 'wrong-signature', 'refresh-token'])(
    'rejects %s JWTs before accessing session data',
    async (reason) => {
      const original = await signIn();
      const invalid =
        reason === 'refresh-token'
          ? original.refreshToken
          : await jwt.signAsync(
              {
                sub: '42',
                sid: session.public_id,
                token_use: 'access',
                exp:
                  Math.floor(Date.now() / 1000) +
                  (reason === 'expired' ? -60 : 60),
              },
              {
                secret:
                  reason === 'wrong-signature'
                    ? 'different-secret'
                    : config.secret,
                issuer: config.issuer,
                audience:
                  reason === 'wrong-audience'
                    ? 'other-api'
                    : config.accessAudience,
                algorithm: 'HS256',
              },
            );
      await expect(
        new AuthenticateRequestUseCase(auth, tokens).execute(
          `Bearer ${invalid}`,
        ),
      ).rejects.toThrow();
      expect(data.findActiveSession).not.toHaveBeenCalled();
    },
  );

  it('allows idempotent logout without a valid cookie', async () => {
    const logout = new LogoutUseCase(auth, tokens);
    await expect(logout.execute()).resolves.toBeUndefined();
    await expect(logout.execute('invalid')).resolves.toBeUndefined();
    expect(data.revokeSession).not.toHaveBeenCalled();
  });
});
