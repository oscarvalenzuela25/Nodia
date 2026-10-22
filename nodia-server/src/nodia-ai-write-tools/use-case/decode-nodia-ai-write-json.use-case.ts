import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  NodiaAiJsonObject,
  NodiaAiJsonValue,
} from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

const invalid = (): never => {
  throw new BadRequestException('nodia_ai:invalid_tool_input');
};
/** A data representation for native JSON fields, never an executable path or operation. */
@Injectable()
export class DecodeNodiaAiWriteJsonUseCase {
  execute(
    value: NodiaAiJsonValue,
    maxItems: number,
    depth = 0,
  ): NodiaAiJsonValue {
    if (
      depth > 8 ||
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    )
      return invalid();
    const allowed =
      value.kind === 'null'
        ? ['kind']
        : value.kind === 'object'
          ? ['kind', 'fields']
          : value.kind === 'array'
            ? ['kind', 'items']
            : ['kind', 'value'];
    if (Object.keys(value).some((key) => !allowed.includes(key)))
      return invalid();
    if (value.kind === 'null') return null;
    if (value.kind === 'string' && typeof value.value === 'string')
      return value.value;
    if (
      value.kind === 'number' &&
      typeof value.value === 'number' &&
      Number.isFinite(value.value)
    )
      return value.value;
    if (value.kind === 'boolean' && typeof value.value === 'boolean')
      return value.value;
    if (
      value.kind === 'array' &&
      Array.isArray(value.items) &&
      value.items.length <= maxItems
    )
      return value.items.map((item) => this.execute(item, maxItems, depth + 1));
    if (
      value.kind === 'object' &&
      Array.isArray(value.fields) &&
      value.fields.length <= maxItems
    ) {
      const result = Object.create(null) as NodiaAiJsonObject;
      for (const member of value.fields) {
        if (
          !member ||
          typeof member !== 'object' ||
          Array.isArray(member) ||
          Object.keys(member).some((key) => !['key', 'value'].includes(key)) ||
          typeof member.key !== 'string' ||
          !Object.hasOwn(member, 'value') ||
          Object.hasOwn(result, member.key)
        )
          return invalid();
        result[member.key] = this.execute(member.value, maxItems, depth + 1);
      }
      return result;
    }
    return invalid();
  }
}
