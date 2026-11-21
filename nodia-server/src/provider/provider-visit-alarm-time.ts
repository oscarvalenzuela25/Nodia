import { BadRequestException } from '@nestjs/common';

export const PROVIDER_VISIT_ALARM_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const INVALID_PROVIDER_VISIT_ALARM_TIME =
  'business:provider_visit_alarm_time_invalid';

export function validateProviderVisitAlarmTime(value: unknown): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string' || !PROVIDER_VISIT_ALARM_TIME_PATTERN.test(value)) {
    throw new BadRequestException(INVALID_PROVIDER_VISIT_ALARM_TIME);
  }
}
