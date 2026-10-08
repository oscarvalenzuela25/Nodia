import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BadGatewayException, BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GeminiService } from '../../common/ai/gemini.service.js';
import { ManageGeminiAgenticLoginUseCase } from './manage-gemini-agentic-login.use-case.js';
import { SubmitGeminiAgenticCodeDto } from '../dto/submit-gemini-agentic-code.dto.js';

vi.mock('../../config/envs.config.js', () => ({ envs: {
  GEMINI_MICROSERVICE_URL: 'http://private-gemini:8000', GEMINI_SERVICE_TOKEN: 'a'.repeat(64),
} }));

const actor = '9007199254740993'; // Real users.id contract: BIGINT string, above Number.MAX_SAFE_INTEGER.
const id = 'ab'.repeat(16);
const url = 'https://accounts.google.com/o/oauth2/auth?' + new URLSearchParams({
  client_id: 'synthetic-client', state: 'synthetic-state', scope: 'openid', response_type: 'code',
  redirect_uri: 'https://antigravity.google/oauth-callback', code_challenge: 'synthetic', code_challenge_method: 'S256',
});
const waiting = { id, state: 'waiting_code', authorization_url: url, reason: null };

describe('ManageGeminiAgenticLoginUseCase with real private transport', () => {
  let useCase: ManageGeminiAgenticLoginUseCase;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    useCase = new ManageGeminiAgenticLoginUseCase(new GeminiService());
    fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(waiting), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NODE_ENV', 'production');
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('supports VPS production and supplies only server-derived actor/service identities', async () => {
    expect(await useCase.start(actor)).toEqual(waiting);
    const [path, options] = fetchMock.mock.calls[0];
    expect(path).toBe('http://private-gemini:8000/agentic/auth/login/start');
    expect(options.headers['X-Nodia-Actor-Id']).toBe(actor);
    expect(options.headers['X-Nodia-Service-Token']).toBe('a'.repeat(64));
    expect(options.body).toBeUndefined();
  });

  it('submits a code in a private POST body and never returns private extras', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id, state: 'verifying', authorization_url: null,
      reason: null, refresh_token: 'synthetic-private' })));
    const result = await useCase.submit(id, actor, { code: '4/synthetic-code' });
    expect(result).toEqual({ id, state: 'verifying', authorization_url: null, reason: null });
    const [path, options] = fetchMock.mock.calls[0];
    expect(path).not.toContain('synthetic-code');
    expect(JSON.parse(options.body)).toEqual({ code: '4/synthetic-code' });
    expect(JSON.stringify(result)).not.toContain('synthetic-private');
  });

  it('allows an absent current attempt and routes status/cancel independently of Web', async () => {
    fetchMock.mockResolvedValueOnce(new Response('null'));
    expect(await useCase.current(actor)).toEqual({ job: null });
    expect(await useCase.status(id, actor)).toEqual(waiting);
    expect(await useCase.cancel(id, actor)).toEqual(waiting);
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      'http://private-gemini:8000/agentic/auth/login/current',
      `http://private-gemini:8000/agentic/auth/login/${id}`,
      `http://private-gemini:8000/agentic/auth/login/${id}/cancel`,
    ]);
  });

  it.each(['../secret', '1', 'a'.repeat(33), 'AB'.repeat(16)])('rejects invalid job ID %s before any upstream request', async (invalid) => {
    expect(() => useCase.status(invalid, actor)).toThrow(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['', '4/code\n/logout', '\u001b[1;1R', 'x'.repeat(2049)])('rejects invalid code before contacting the CLI', async (code) => {
    expect(() => useCase.submit(id, actor, { code })).toThrow(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [404, NotFoundException], [409, ConflictException], [422, BadGatewayException], [503, ServiceUnavailableException], [500, BadGatewayException],
  ])('classifies upstream status %s without leaking its body or retrying', async (status, errorType) => {
    fetchMock.mockResolvedValue(new Response('synthetic-secret-provider-error', { status }));
    await expect(useCase.start(actor)).rejects.toThrow(errorType);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each(['current', 'start', 'status', 'cancel', 'submit'])('does not blame the OAuth code for internal validation errors in %s', async (operation) => {
    fetchMock.mockResolvedValue(new Response('synthetic-secret-validation-error', { status: 422 }));
    const result = operation === 'current' ? useCase.current(actor) : operation === 'start' ? useCase.start(actor)
      : operation === 'status' ? useCase.status(id, actor) : operation === 'cancel' ? useCase.cancel(id, actor)
        : useCase.submit(id, actor, { code: '4/synthetic-code' });
    await expect(result).rejects.toThrow(BadGatewayException);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('reports an invalid OAuth code only for an explicit private code-validation error', async () => {
    fetchMock.mockImplementation(async () => new Response('synthetic-secret-code', {
      status: 422, headers: { 'X-Nodia-Error-Code': 'login_invalid_code' },
    }));
    await expect(useCase.submit(id, actor, { code: '4/synthetic-code' })).rejects.toThrow(UnprocessableEntityException);
    await expect(useCase.current(actor)).rejects.toThrow(BadGatewayException);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    null, {}, { ...waiting, id: 'invalid' }, { ...waiting, state: 'invented' },
    { ...waiting, authorization_url: 'javascript:alert(1)' },
    { ...waiting, authorization_url: url.replace('accounts.google.com', 'evil.test') },
    { ...waiting, authorization_url: url + '&refresh_token=synthetic-secret' },
    { ...waiting, authorization_url: url + '&state=duplicate' },
    { ...waiting, authorization_url: url.replace('antigravity.google', 'evil.test') },
    { ...waiting, state: 'succeeded' }, { ...waiting, reason: 'synthetic-secret' },
  ])('rejects an invalid provider login response', async (value) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(value)));
    await expect(useCase.start(actor)).rejects.toThrow(BadGatewayException);
  });

  it('handles a dead service safely without retrying', async () => {
    fetchMock.mockRejectedValue(new Error('synthetic-secret-error'));
    await expect(useCase.start(actor)).rejects.toThrow(ServiceUnavailableException);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('bounds private response bytes and closes an oversized stream', async () => {
    const cancelled = vi.fn();
    fetchMock.mockResolvedValue(new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(16_385))); },
      cancel: cancelled,
    })));
    await expect(useCase.start(actor)).rejects.toThrow(BadGatewayException);
    expect(cancelled).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('DTO trims pasted whitespace but forbids controls and oversized values', async () => {
    const valid = plainToInstance(SubmitGeminiAgenticCodeDto, { code: '  4/synthetic-code  ' });
    expect(valid.code).toBe('4/synthetic-code');
    expect(await validate(valid)).toEqual([]);
    for (const code of ['short', '4/code\n/logout', 'x'.repeat(2049), null]) {
      expect((await validate(plainToInstance(SubmitGeminiAgenticCodeDto, { code }))).length).toBeGreaterThan(0);
    }
  });
});
