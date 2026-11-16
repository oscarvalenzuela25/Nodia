import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.restoreAllMocks());

describe('Theme preference', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('starts dark with no saved preference and persists switching to light across reloads', async () => {
    const { default: store } = await import('../../store/configStore');
    const { default: ThemeSelector } = await import('../../components/ThemeSelector/ThemeSelector');
    expect(store.getState().themeType).toBe('dark');
    const view = render(<ThemeSelector />);
    expect(screen.getByRole('checkbox', { hidden: true })).not.toBeChecked();
    await userEvent.setup().click(screen.getByLabelText('Cambiar tema'));
    expect(store.getState().themeType).toBe('light');
    expect(screen.getByRole('checkbox', { hidden: true })).toBeChecked();
    view.unmount();
    vi.resetModules();
    const { default: reloaded } = await import('../../store/configStore');
    expect(reloaded.getState().themeType).toBe('light');
    reloaded.getState().handleToggleThemeType();
    expect(reloaded.getState().themeType).toBe('dark');
    vi.resetModules();
    const { default: darkReload } = await import('../../store/configStore');
    expect(darkReload.getState().themeType).toBe('dark');
  });

  it.each(['light', 'dark'] as const)('keeps a historical saved %s preference', async (themeType) => {
    localStorage.setItem('configStore', JSON.stringify({ state: { themeType }, version: 0 }));
    const { default: store } = await import('../../store/configStore');
    expect(store.getState().themeType).toBe(themeType);
    expect(store.getState().themeId).toBe('nodia');
  });

  it('persists the preset independently from mode across reloads', async () => {
    const { default: store } = await import('../../store/configStore');
    const { themePresets } = await import('../../themes');
    const preset = themePresets.find(({ id }) => id !== 'nodia')!;
    store.getState().handleChangeThemeId(preset.id);
    expect(store.getState().themeType).toBe('dark');
    store.getState().handleChangeThemeType('light');
    expect(store.getState().themeId).toBe(preset.id);
    vi.resetModules();
    const { default: reloaded } = await import('../../store/configStore');
    expect(reloaded.getState()).toMatchObject({ themeId: preset.id, themeType: 'light' });
    expect(JSON.parse(localStorage.getItem('configStore')!).state).toEqual({ themeId: preset.id, themeType: 'light' });
  });

  it.each([
    { state: { themeType: 'light', themeId: 'removed-theme' }, expectedMode: 'light' },
    { state: { themeType: false, themeId: {} }, expectedMode: 'dark' },
    { state: null, expectedMode: 'dark' },
  ])('recovers invalid or obsolete preferences without overwriting actions', async ({ state, expectedMode }) => {
    localStorage.setItem('configStore', JSON.stringify({ state, version: 0 }));
    const { default: store } = await import('../../store/configStore');
    expect(store.getState()).toMatchObject({ themeId: 'nodia', themeType: expectedMode });
    expect(store.getState().handleChangeThemeId).toBeTypeOf('function');
    store.getState().handleChangeThemeId('does-not-exist');
    expect(store.getState().themeId).toBe('nodia');
  });

  it('starts with the default when saved JSON is corrupted or reads are denied', async () => {
    localStorage.setItem('configStore', '{bad-json');
    const { default: corrupted } = await import('../../store/configStore');
    expect(corrupted.getState()).toMatchObject({ themeId: 'nodia', themeType: 'dark' });
    vi.resetModules();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    const { default: denied } = await import('../../store/configStore');
    expect(denied.getState()).toMatchObject({ themeId: 'nodia', themeType: 'dark' });
  });

  it('rolls back a rejected save and permits a later retry', async () => {
    const { default: store } = await import('../../store/configStore');
    const { themePresets } = await import('../../themes');
    const preset = themePresets.find(({ id }) => id !== 'nodia')!;
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(() => store.getState().handleChangeThemeId(preset.id)).toThrow('Full');
    expect(store.getState().themeId).toBe('nodia');
    write.mockRestore();
    store.getState().handleChangeThemeId(preset.id);
    expect(store.getState().themeId).toBe(preset.id);
  });
});
