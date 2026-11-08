import { describe, expect, it } from 'vitest';
import { setupDraftText, setupDraftRevision, canClearSetupDraft } from './teacher-setup-draft.js';

describe('Server setup draft text and revision policy', () => {
  it('preserves raw spaces, newlines and an explicit empty draft without inventing content', () => {
    for (const value of ['', '  ', 'DNS\n  ideas  ', 'árbol 日本語']) expect(setupDraftText(value)).toBe(value);
    expect(setupDraftText('€'.repeat(2730) + 'aa')).toHaveLength(2732);
  });
  it('rejects absent, invalid Unicode and character/byte limits independently', () => {
    for (const value of [null, undefined, {}, '\ud800', '\u0000', 'a'.repeat(4001), '€'.repeat(2730) + 'aaa'])
      expect(() => setupDraftText(value)).toThrow('teacher:invalid_input');
  });
  it('requires exact draft CAS independently from a session revision', () => {
    expect(() => setupDraftRevision(0, 0)).not.toThrow();
    expect(() => setupDraftRevision(7, 7)).not.toThrow();
    expect(() => setupDraftRevision(7, 6)).toThrow('teacher:draft_revision_conflict');
    expect(() => setupDraftRevision(2147483647, 2147483647)).toThrow('teacher:draft_revision_conflict');
    for (const value of [-1, null, '0', 0.1]) expect(() => setupDraftRevision(0, value)).toThrow('teacher:invalid_input');
  });
  it('clears only the sent snapshot at its exact revision; older tabs preserve newer text', () => {
    const draft = { setup_draft_text: ' DNS ideas  ', setup_draft_revision: 4 };
    expect(canClearSetupDraft(draft, 4, 'DNS ideas')).toBe(true);
    expect(canClearSetupDraft(draft, 3, 'DNS ideas')).toBe(false);
    expect(canClearSetupDraft(draft, 4, 'New ideas')).toBe(false);
    expect(canClearSetupDraft(draft, undefined, 'DNS ideas')).toBe(false);
  });
});
