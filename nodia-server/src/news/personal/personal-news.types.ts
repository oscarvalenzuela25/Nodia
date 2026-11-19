export const DEV_COMMUNITY = 'dev-community' as const;
export const DAILY_DEV = 'daily-dev' as const;
export const PERSONAL_NEWS_PROVIDERS = [DEV_COMMUNITY, DAILY_DEV] as const;
export type PersonalNewsProvider = (typeof PERSONAL_NEWS_PROVIDERS)[number];
export const PERSONAL_NEWS_API_KEY_PATTERN = /^[\x21-\x7e]{1,512}$/u;
export const DAILY_DEV_PAT_PATTERN = /^(?=.{5,512}$)dda_[a-zA-Z0-9._~+/-]+=*$/u;

export type PersonalNewsProviderErrorCode =
  | 'news:provider_credentials_invalid'
  | 'news:provider_rate_limited'
  | 'news:provider_unavailable'
  | 'news:provider_invalid_response';

export class PersonalNewsProviderError extends Error {
  constructor(
    readonly code: PersonalNewsProviderErrorCode,
    readonly retryAt: Date | null = null,
  ) {
    super(code);
  }
}

export type PersonalNewsState =
  'disconnected' | 'connected' | 'reconnect_required' | 'pending';
export type PersonalNewsSnapshotStatus =
  'updated' | 'empty' | 'no_followed_tags';
export type PersonalNewsRetrySource = 'provider' | 'local';

export interface PersonalNewsArticle {
  id: string;
  provider: PersonalNewsProvider;
  title: string;
  url: string;
  cover_image_url?: string;
  tags?: string[];
  published_at: string | null;
}

export interface PersonalNewsClient {
  test(apiKey: string): Promise<{ account_name: string }>;
  refresh(apiKey: string): Promise<{
    articles: PersonalNewsArticle[];
    hasFollowedTags?: boolean;
  }>;
}

export interface PersonalNewsConnectionView {
  provider: PersonalNewsProvider;
  state: PersonalNewsState;
  account_name: string | null;
  key_hint: string | null;
  last_tested_at: string | null;
  last_test_error_code: string | null;
  last_refresh_attempt_at: string | null;
  last_refresh_success_at: string | null;
  last_refresh_error_code: string | null;
  next_refresh_at: string | null;
  retry_source: PersonalNewsRetrySource | null;
  snapshot_status: PersonalNewsSnapshotStatus | null;
}

export interface PersonalNewsRefresh {
  connection: PersonalNewsConnectionView;
  status: PersonalNewsSnapshotStatus | 'cached';
  received_count: number;
}
