import { HttpException } from '@nestjs/common';

export const CODEX_VERSION = '0.161.0';
export const CODEX_PROVIDER = 'nodia_codex';
export const CODEX_SETTINGS: Record<string, unknown> = {
  cli_auth_credentials_store: 'keyring',
  forced_login_method: 'chatgpt',
  model_provider: CODEX_PROVIDER,
  model_providers: {
    [CODEX_PROVIDER]: {
      name: 'Nodia Codex',
      wire_api: 'responses',
      requires_openai_auth: true,
      request_max_retries: 0,
      stream_max_retries: 0,
      supports_websockets: false,
    },
  },
  features: {
    shell_tool: false,
    unified_exec: false,
    apply_patch_freeform: false,
    multi_agent: false,
    apps: false,
    plugins: false,
    code_mode: false,
    memories: false,
    remote_control: false,
    remote_plugin: false,
  },
  web_search: 'disabled',
  check_for_update_on_startup: false,
  analytics: { enabled: false },
  feedback: { enabled: false },
  project_doc_max_bytes: 0,
  shell_environment_policy: { inherit: 'none' },
  mcp_servers: {},
};

export function codexObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw codexError('codex_protocol_invalid', 502);
  return value as Record<string, unknown>;
}

export class CodexOperationException extends HttpException {
  readonly code: string;
  readonly requestId: string | null;
  constructor(
    body: { code: string; message: string; requestId?: string },
    status: number,
  ) {
    super(body, status);
    this.code = body.code;
    this.requestId = body.requestId ?? null;
  }
}

export function codexError(code: string, status = 503) {
  const message: Record<string, string> = {
    codex_resource_limit:
      'Codex excedió el límite de recursos o no pudo comprobarse su consumo.',
    codex_quota_exhausted:
      'Codex informa que la cuota o el límite de solicitudes se agotó.',
    codex_session_required: 'Debe conectar la cuenta Codex de esta instancia.',
    codex_runtime_unavailable: 'El runtime Codex no está disponible.',
    codex_profile_busy: 'Esta conexión Codex tiene otra operación en curso.',
    codex_timeout:
      'Codex agotó el tiempo de espera. El análisis no se reenviará.',
    codex_protocol_invalid: 'Codex devolvió una respuesta inválida.',
    codex_model_unavailable:
      'El modelo o esfuerzo elegido no está disponible en el catálogo Codex.',
    codex_inference_failed:
      'Codex no completó la extracción. Compruebe sesión, modelo y cuota.',
    codex_cancelled: 'Se interrumpió la operación Codex.',
  };
  return new CodexOperationException(
    {
      code,
      message: message[code] ?? 'No se pudo completar la operación Codex.',
    },
    status,
  );
}

export interface CodexModel {
  id: string;
  name: string;
  displayName: string;
  description: string;
  contextWindow: null;
  capabilities: string[];
  isRecommended: boolean;
  inputModalities: string[] | null;
  supportedReasoningEfforts: string[];
}

export function codexModels(values: unknown): CodexModel[] {
  if (!Array.isArray(values) || values.length > 1000)
    throw codexError('codex_protocol_invalid');
  const ids = new Set<string>();
  return values.map((value) => {
    const m = codexObject(value);
    if (
      typeof m.model !== 'string' ||
      !m.model.trim() ||
      m.model.length > 128 ||
      ids.has(m.model)
    )
      throw codexError('codex_protocol_invalid');
    ids.add(m.model);
    const modalities =
      Array.isArray(m.inputModalities) &&
      m.inputModalities.every((v) => typeof v === 'string')
        ? (m.inputModalities as string[])
        : null;
    if (
      !Array.isArray(m.supportedReasoningEfforts) ||
      m.supportedReasoningEfforts.length > 32
    )
      throw codexError('codex_protocol_invalid');
    const efforts = m.supportedReasoningEfforts.map((entry) => {
      const e = codexObject(entry).reasoningEffort;
      if (typeof e !== 'string' || !/^[a-z][a-z0-9_-]{0,31}$/.test(e))
        throw codexError('codex_protocol_invalid');
      return e;
    });
    return {
      id: m.model,
      name: typeof m.displayName === 'string' ? m.displayName : m.model,
      displayName: typeof m.displayName === 'string' ? m.displayName : m.model,
      description: typeof m.description === 'string' ? m.description : '',
      contextWindow: null,
      capabilities: [
        ...(modalities?.includes('image') ? ['vision'] : []),
        ...(efforts.length ? ['reasoning'] : []),
      ],
      isRecommended: m.isDefault === true,
      inputModalities: modalities,
      supportedReasoningEfforts: [...new Set(efforts)],
    };
  });
}

export interface CodexQuotaWindow {
  usedPercent: number | null;
  windowDurationMins: number | null;
  resetsAt: number | null;
}
export interface CodexQuota {
  id: string;
  name: string | null;
  primary: CodexQuotaWindow | null;
  secondary: CodexQuotaWindow | null;
}
export function codexQuotas(value: unknown): CodexQuota[] | null {
  const r = codexObject(value);
  const number = (v: unknown, max = Number.MAX_SAFE_INTEGER) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max
      ? v
      : null;
  const window = (v: unknown): CodexQuotaWindow | null => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    const w = v as Record<string, unknown>;
    return {
      usedPercent: number(w.usedPercent, 100),
      windowDurationMins: number(w.windowDurationMins),
      resetsAt: number(w.resetsAt),
    };
  };
  const buckets = r.rateLimitsByLimitId
    ? codexObject(r.rateLimitsByLimitId)
    : r.rateLimits
      ? { codex: r.rateLimits }
      : null;
  if (!buckets || Object.keys(buckets).length > 100) return null;
  return Object.entries(buckets).map(([id, value]) => {
    const b = codexObject(value);
    return {
      id,
      name: typeof b.limitName === 'string' ? b.limitName : null,
      primary: window(b.primary),
      secondary: window(b.secondary),
    };
  });
}

export interface CodexSession {
  available: boolean;
  authenticated: boolean | null;
  planType: string | null;
  checkedAt: string | null;
  reason: string | null;
  quotas: CodexQuota[] | null;
  lastInferenceAt: string | null;
  usageAllowed: boolean | null;
}
export interface CodexLoginJob {
  id: string;
  state:
    | 'running'
    | 'waiting_authorization'
    | 'verifying'
    | 'succeeded'
    | 'failed'
    | 'cancelled';
  verificationUrl: string | null;
  userCode: string | null;
  reason: string | null;
}
