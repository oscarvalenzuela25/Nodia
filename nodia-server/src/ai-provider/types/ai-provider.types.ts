export enum AiConnectionMode {
  WEB_SESSION = 'web_session',
  API_KEY = 'api_key',
}

export enum AiKeyHealthState {
  UNTESTED = 'untested',
  VALID = 'valid',
  NEEDS_REVIEW = 'needs_review',
  COOLDOWN = 'cooldown',
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

export interface GetAiProvidersResponse {
  data: any[];
  meta: PaginationMeta;
}

export interface GetAiApiKeysResponse {
  data: any[];
  meta: PaginationMeta;
}

export interface GetAiProviderEventsResponse {
  data: any[];
  meta: PaginationMeta;
}
