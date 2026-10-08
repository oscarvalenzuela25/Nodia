import { BadGatewayException } from '@nestjs/common';

export type GeminiAgenticLoginJob = {
  id: string;
  state: 'running' | 'waiting_code' | 'verifying' | 'succeeded' | 'failed' | 'cancelled';
  authorization_url: string | null;
  reason: 'agentic_login_timeout' | 'agentic_login_failed' | null;
};

export function isGeminiAgenticAuthorizationUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4096 || /\s/.test(value)
    || [...value].some((character) => character.charCodeAt(0) < 32)) return false;
  try {
    const url = new URL(value);
    const params = url.searchParams;
    return url.protocol === 'https:' && url.host === 'accounts.google.com'
      && !url.username && !url.password && !url.hash
      && ['/o/oauth2/auth', '/o/oauth2/v2/auth'].includes(url.pathname)
      && [...params.keys()].every((key) => params.getAll(key).length === 1)
      && params.get('redirect_uri') === 'https://antigravity.google/oauth-callback'
      && params.get('response_type') === 'code' && params.get('code_challenge_method') === 'S256'
      && ['client_id', 'state', 'code_challenge', 'scope'].every((key) => Boolean(params.get(key)))
      && ['access_token', 'refresh_token', 'id_token', 'code'].every((key) => !params.has(key));
  } catch {
    return false;
  }
}

export function parseGeminiAgenticLoginJob(value: unknown): GeminiAgenticLoginJob {
  const invalid = () => new BadGatewayException('Gemini devolvió un estado de login Agentic inválido.');
  if (!value || typeof value !== 'object') throw invalid();
  const job = value as Record<string, unknown>;
  const states = ['running', 'waiting_code', 'verifying', 'succeeded', 'failed', 'cancelled'];
  if (typeof job.id !== 'string' || !/^[0-9a-f]{32}$/.test(job.id)
    || typeof job.state !== 'string' || !states.includes(job.state)
    || (job.reason !== null && job.reason !== 'agentic_login_timeout' && job.reason !== 'agentic_login_failed')
    || (job.state === 'waiting_code'
      ? !isGeminiAgenticAuthorizationUrl(job.authorization_url)
      : job.authorization_url !== null)) throw invalid();
  return { id: job.id, state: job.state as GeminiAgenticLoginJob['state'],
    authorization_url: job.authorization_url as string | null,
    reason: job.reason as GeminiAgenticLoginJob['reason'] };
}
