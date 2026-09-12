import { SetMetadata } from '@nestjs/common';

export const LOGIN_RATE_LIMIT = 'rate-limit:login';

// Apply only to login handlers; its counter is separate from other IP quotas.
export const LimitLogin = () => SetMetadata(LOGIN_RATE_LIMIT, true);
