import { HttpException } from '@nestjs/common';

export type GeminiAdmissionReason =
  'runtime_busy' | 'native_proof_missing' | 'native_proof_mismatch';
export const geminiAdmissionReason = (
  value: unknown,
): GeminiAdmissionReason | null =>
  value === 'runtime_busy' ||
  value === 'native_proof_missing' ||
  value === 'native_proof_mismatch'
    ? value
    : null;

type GeminiUpstreamErrorCode =
  | 'analysis_timeout'
  | 'provider_timeout'
  | 'agentic_timeout'
  | 'provider_response_error'
  | 'runtime_busy'
  | 'native_proof_missing'
  | 'native_proof_mismatch';

/** Safe upstream classification. Provider response bodies are never forwarded. */
export class GeminiUpstreamException extends HttpException {
  readonly retryAfterSeconds: number | null;
  readonly upstreamErrorCode: GeminiUpstreamErrorCode | null;

  private constructor(
    status: number,
    message: string,
    requestId: string | null,
    retryAfter: number | null,
    code: GeminiUpstreamErrorCode | null,
  ) {
    super(
      {
        message,
        error: 'GEMINI_UPSTREAM_ERROR',
        upstreamRequestId: requestId,
        ...(code ? { upstreamErrorCode: code } : {}),
      },
      status,
    );
    this.retryAfterSeconds = retryAfter;
    this.upstreamErrorCode = code;
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
    const status =
      response.status === 401
        ? 503
        : messages[response.status]
          ? response.status
          : 502;
    const id = response.headers.get('x-request-id');
    const retry = response.headers.get('retry-after');
    const retryAfter =
      retry && /^\d{1,5}$/.test(retry) ? Math.min(Number(retry), 86400) : null;
    const reportedCode = response.headers.get('x-nodia-error-code');
    const categories: Record<
      GeminiUpstreamErrorCode,
      { status: number; message: string }
    > = {
      analysis_timeout: {
        status: 504,
        message: 'El análisis de Gemini superó el tiempo máximo permitido.',
      },
      provider_timeout: {
        status: 504,
        message: 'Gemini agotó el tiempo de espera de su respuesta.',
      },
      agentic_timeout: {
        status: 504,
        message: 'Antigravity CLI agotó el tiempo de comprobación o análisis.',
      },
      provider_response_error: {
        status: 502,
        message: 'No se pudo obtener una respuesta válida de Gemini.',
      },
      runtime_busy: {
        status: 409,
        message:
          'El perfil de Gemini está ocupado o pendiente de conciliación. La factura se conserva; no es necesario volver a cargarla ni iniciar sesión.',
      },
      native_proof_missing: {
        status: 409,
        message:
          'Gemini requiere comprobar el cierre de una operación anterior antes de analizar otra factura. La factura se conserva.',
      },
      native_proof_mismatch: {
        status: 409,
        message:
          'No se pudo verificar el cierre de la operación anterior de Gemini. La factura se conserva y no se ha enviado otro análisis al proveedor.',
      },
    };
    const code =
      reportedCode &&
      Object.hasOwn(categories, reportedCode) &&
      categories[reportedCode as GeminiUpstreamErrorCode].status ===
        response.status
        ? (reportedCode as GeminiUpstreamErrorCode)
        : null;
    return new GeminiUpstreamException(
      code ? categories[code].status : status,
      code ? categories[code].message : messages[status],
      id && /^[0-9a-f]{32}$/.test(id) ? id : null,
      retryAfter,
      code,
    );
  }
}
