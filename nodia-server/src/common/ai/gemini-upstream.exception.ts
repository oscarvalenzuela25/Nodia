import { HttpException } from '@nestjs/common';

/** Safe upstream classification. Provider response bodies are never forwarded. */
export class GeminiUpstreamException extends HttpException {
  readonly retryAfterSeconds: number | null;

  private constructor(status: number, message: string, requestId: string | null, retryAfter: number | null) {
    super({ message, error: 'GEMINI_UPSTREAM_ERROR', upstreamRequestId: requestId }, status);
    this.retryAfterSeconds = retryAfter;
  }

  static fromResponse(response: Response): GeminiUpstreamException {
    const messages: Record<number, string> = {
      400: 'Gemini rechazó los parámetros enviados.',
      413: 'La factura supera el tamaño permitido.',
      415: 'Gemini rechazó el formato del archivo.',
      422: 'El modelo o los parámetros configurados no son compatibles con Gemini.',
      429: 'Gemini alcanzó su cuota o capacidad disponible. Reintente más tarde.',
      502: 'Gemini no devolvió una extracción válida.',
      503: 'El motor de Gemini no está disponible o necesita renovar su sesión.',
      504: 'Tiempo de respuesta de Gemini agotado.',
    };
    const status = response.status === 401 ? 503 : messages[response.status] ? response.status : 502;
    const id = response.headers.get('x-request-id');
    const retry = response.headers.get('retry-after');
    const retryAfter = retry && /^\d{1,5}$/.test(retry) ? Math.min(Number(retry), 86400) : null;
    return new GeminiUpstreamException(status, messages[status],
      id && /^[0-9a-f]{32}$/.test(id) ? id : null, retryAfter);
  }
}
