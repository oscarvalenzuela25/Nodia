import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  });
});
