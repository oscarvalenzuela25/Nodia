import type { Request } from 'express';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image_url: string | null;
}

export interface AuthPrincipal {
  user: AuthUser;
  sessionId: string;
}

export interface AuthRequest extends Request {
  auth: AuthPrincipal;
}

export interface TokenClaims {
  sub: string;
  sid: string;
  token_use: 'access' | 'refresh';
  exp: number;
}

export interface AuthResponse {
  token: string;
  expiresAt: number;
  user: AuthUser;
}

export interface IssuedSession {
  response: AuthResponse;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface GoogleIdentity {
  subject: string;
  email: string;
  name?: string;
  picture?: string;
  authoritativeEmail: boolean;
}
