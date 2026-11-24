import {
  BadGatewayException,
  ConflictException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { envs } from '../../config/envs.config.js';

const UNAVAILABLE = 'ai_provider:gemini_logout_unavailable';
const UNKNOWN = 'ai_provider:gemini_logout_unknown';

@Injectable()
export class GeminiAgenticLogoutService {
  private version = 0;

  get observationRevision(): number {
    return this.version;
  }

  async logout(actorUserId: string): Promise<{ authenticated: false }> {
    const { GEMINI_MICROSERVICE_URL: baseUrl, GEMINI_SERVICE_TOKEN: token } =
      envs;
    if (!baseUrl || !/^[0-9a-fA-F]{64}$/.test(token)) {
      throw new ServiceUnavailableException(UNAVAILABLE);
    }
    try {
      return await this.requestLogout(baseUrl, {
        'X-Nodia-Service-Token': token,
        'X-Nodia-Actor-Id': actorUserId,
      });
    } finally {
      // Observations started before this attempt finished may be stale.
      this.version++;
    }
  }

  private async requestLogout(
    baseUrl: string,
    headers: Record<string, string>,
  ): Promise<{ authenticated: false }> {
    const signal = AbortSignal.timeout(15_000);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/agentic/auth/login/logout`, {
        method: 'POST',
        headers,
        redirect: 'error',
        signal,
      });
    } catch {
      // The private mutation may have reached Gemini before transport failed.
      throw new GatewayTimeoutException(UNKNOWN);
    }

    if (response.status !== 200) {
      await response.body?.cancel().catch(() => undefined);
      const code = response.headers.get('X-Nodia-Error-Code');
      if (response.status === 409 && code === 'runtime_busy') {
        throw new ConflictException('ai_provider:gemini_logout_busy');
      }
      if (
        [401, 403, 404, 405, 501].includes(response.status) ||
        (response.status === 503 &&
          (code === 'runtime_unconfigured' || code === 'agentic_logout_unavailable'))
      ) {
        throw new ServiceUnavailableException(UNAVAILABLE);
      }
      if (response.status === 504) throw new GatewayTimeoutException(UNKNOWN);
      throw new BadGatewayException(UNKNOWN);
    }

    let value: unknown;
    try {
      value = await this.readResponse(response);
    } catch {
      if (signal.aborted) throw new GatewayTimeoutException(UNKNOWN);
      throw new BadGatewayException(UNKNOWN);
    }
    if (
      value &&
      typeof value === 'object' &&
      'authenticated' in value &&
      value.authenticated === false &&
      Object.keys(value).length === 1 &&
      Object.hasOwn(value, 'authenticated')
    ) {
      return { authenticated: false };
    }
    throw new BadGatewayException(UNKNOWN);
  }

  private async readResponse(response: Response): Promise<unknown> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Missing logout response');
    const bytes = new Uint8Array(256);
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        if (chunk.value.byteLength > bytes.length - size) {
          throw new Error('Logout response exceeds the size limit');
        }
        bytes.set(chunk.value, size);
        size += chunk.value.byteLength;
      }
      const payload = new TextDecoder('utf-8', { fatal: true }).decode(
        bytes.subarray(0, size),
      );
      return JSON.parse(payload);
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }
}
