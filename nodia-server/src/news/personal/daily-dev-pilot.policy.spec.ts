import { afterEach, describe, expect, it, vi } from 'vitest';
import { dailyDevPilotAllowed } from './daily-dev-pilot.policy.js';

afterEach(() => vi.unstubAllEnvs());

describe('daily.dev local pilot owner gate', () => {
  it('matches the exact owner in development and stays disabled without explicit opt-in', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEWS_DAILY_DEV_LOCAL_OWNER_ID', undefined);
    expect(dailyDevPilotAllowed('42')).toBe(false);
    vi.stubEnv('NEWS_DAILY_DEV_LOCAL_OWNER_ID', '42');
    expect(dailyDevPilotAllowed('42')).toBe(true);
    expect(dailyDevPilotAllowed('43')).toBe(false);
    vi.stubEnv('NODE_ENV', 'production');
    expect(dailyDevPilotAllowed('42')).toBe(false);
    vi.stubEnv('NODE_ENV', 'test');
    expect(dailyDevPilotAllowed('42')).toBe(false);
  });

  it.each(['042', '0', '42,43', ' 42', '9223372036854775808'])(
    'rejects noncanonical or out-of-range owner setting %s',
    (invalid) => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEWS_DAILY_DEV_LOCAL_OWNER_ID', invalid);
      expect(dailyDevPilotAllowed(invalid)).toBe(false);
    },
  );
});
