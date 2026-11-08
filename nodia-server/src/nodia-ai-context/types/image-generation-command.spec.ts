import { describe, expect, it } from 'vitest';
import { imageGenerationCommand } from './image-generation-command.js';
const item = (text: string, role = 'user', seq = '2') => ({ seq, role, scope: null, parts: [{ kind: 'text', text }] });
describe('explicit image generation command', () => {
  it('accepts only the current owner command and preserves its description', () => {
    expect(imageGenerationCommand([item('/imagen una taza azul', 'user', '1'), item('hola')], '2')).toBeUndefined();
    expect(imageGenerationCommand([item('/imagen taza azul', 'assistant')], '2')).toBeUndefined();
    expect(imageGenerationCommand([item('  /imagen una taza\nazul  ')], '2')).toEqual({ prompt: 'una taza\nazul' });
    expect(imageGenerationCommand([item('explica /imagen algo')], '2')).toBeUndefined();
  });
  it('rejects empty, oversized and attached-file requests', () => {
    for (const text of ['/imagen', '/imagen ' + 'á'.repeat(4001)])
      expect(() => imageGenerationCommand([item(text)], '2')).toThrow('invalid_image_generation_request');
    const attached = { ...item('/imagen una taza'), parts: [
      { kind: 'text', text: '/imagen una taza' }, { kind: 'image', text: null, attachment_id: 'file' }] };
    expect(() => imageGenerationCommand([attached], '2')).toThrow('invalid_image_generation_request');
  });
});
