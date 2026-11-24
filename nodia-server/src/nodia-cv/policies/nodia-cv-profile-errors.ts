import { HttpException } from '@nestjs/common';

const cvErrorStatuses = {
  invalid_profile_dates: 400,
  invalid_profile_entry: 400,
  profile_too_large: 413,
  profile_not_found: 404,
  stale_profile: 409,
  request_key_conflict: 409,
  request_closed: 410,
} as const;

export function nodiaCvProfileError(
  code: keyof typeof cvErrorStatuses,
  field?: string,
): never {
  throw new HttpException(
    { message: `nodiaCv:${code}`, field },
    cvErrorStatuses[code],
  );
}
