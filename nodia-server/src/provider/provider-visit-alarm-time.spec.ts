import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateProviderDto } from './dto/create-provider.dto.js';
import { UpdateProviderDto } from './dto/update-provider.dto.js';
import { validateProviderVisitAlarmTime } from './provider-visit-alarm-time.js';

const create = {
  name: 'Supplier',
  business_id: '11111111-1111-4111-8111-111111111111',
};

describe('supplier visit alarm time', () => {
  it.each([undefined, null, '00:00', '08:45', '23:59'])(
    'preserves a valid value or omission: %j',
    async (visit_alarm_time) => {
      const input = visit_alarm_time === undefined ? {} : { visit_alarm_time };
      const createDto = plainToInstance(CreateProviderDto, { ...create, ...input });
      const updateDto = plainToInstance(UpdateProviderDto, input);
      expect(() => validateProviderVisitAlarmTime(visit_alarm_time)).not.toThrow();
      expect(await validate(createDto)).toEqual([]);
      expect(await validate(updateDto)).toEqual([]);
      expect(createDto.visit_alarm_time).toBe(visit_alarm_time);
      expect(updateDto.visit_alarm_time).toBe(visit_alarm_time);
    },
  );

  it.each(['', '8:45', '24:00', '08:60', '08:45:00', ' 08:45', 845])(
    'rejects a value outside the nullable HH:mm contract: %j',
    async (visit_alarm_time) => {
      expect(() => validateProviderVisitAlarmTime(visit_alarm_time)).toThrow(
        'business:provider_visit_alarm_time_invalid',
      );
      const update = plainToInstance(UpdateProviderDto, { visit_alarm_time });
      expect((await validate(update)).map((error) => error.property)).toEqual([
        'visit_alarm_time',
      ]);
    },
  );
});
