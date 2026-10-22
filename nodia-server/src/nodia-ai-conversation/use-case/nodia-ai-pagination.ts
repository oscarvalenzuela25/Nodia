import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

export function cursorScope(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function encodeCursor(scope: string, position: string[]): string {
  return Buffer.from(JSON.stringify({ version: 1, scope, position })).toString(
    'base64url',
  );
}
/** Scope binding detects accidental cross-query reuse; authorization always comes from current Server state. */
export function decodeCursor(
  input: string | undefined,
  scope: string,
): string[] | null {
  if (input === undefined) return null;
  try {
    if (!input || input.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(input))
      throw Error();
    const value: unknown = JSON.parse(
      Buffer.from(input, 'base64url').toString('utf8'),
    );
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw Error();
    const object = value as Record<string, unknown>;
    if (
      Object.keys(object).length !== 3 ||
      object.version !== 1 ||
      object.scope !== scope ||
      !Array.isArray(object.position) ||
      object.position.length > 2 ||
      object.position.some(
        (part: unknown) => typeof part !== 'string' || part.length > 128,
      )
    )
      throw Error();
    return object.position as string[];
  } catch {
    throw new BadRequestException('nodia_ai:invalid_cursor');
  }
}
