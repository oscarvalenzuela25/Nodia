import { BadGatewayException } from '@nestjs/common';

export type GeminiLoginFrame = { ready: boolean; frame_id: string | null; image: string | null; width: 1280; height: 850 };
export type GeminiLoginInput = {
  frame_id: string; action: 'click' | 'text' | 'key' | 'scroll';
  x?: number; y?: number; text?: string; key?: string; delta?: number;
};
export const GEMINI_LOGIN_KEYS = ['Tab', 'Shift+Tab', 'Enter', 'Backspace', 'Delete', 'Escape',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Control+A'];

export function parseGeminiLoginFrame(value: unknown): GeminiLoginFrame {
  const invalid = () => new BadGatewayException('Gemini devolvió una pantalla inválida.');
  if (!value || typeof value !== 'object') throw invalid();
  const frame = value as Record<string, unknown>;
  if (frame.width !== 1280 || frame.height !== 850 || typeof frame.ready !== 'boolean') throw invalid();
  if (frame.ready) {
    if (typeof frame.frame_id !== 'string' || !/^[0-9a-f]{32}$/.test(frame.frame_id)
      || typeof frame.image !== 'string' || frame.image.length > 1_048_576
      || !/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(frame.image) || frame.image.length % 4 !== 0) throw invalid();
  } else if (frame.frame_id !== null || frame.image !== null) throw invalid();
  return { ready: frame.ready, frame_id: frame.frame_id as string | null,
    image: frame.image as string | null, width: 1280, height: 850 };
}
