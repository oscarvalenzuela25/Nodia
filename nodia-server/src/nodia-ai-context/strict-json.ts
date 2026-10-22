/** JSON.parse accepts duplicate object keys; release metadata must not have two meanings. */
export function parseNodiaAiStrictJson(text: string): unknown {
  let offset = 0;
  const invalid = (): never => {
    throw new Error('nodia_ai:knowledge_release_invalid');
  };
  const whitespace = () => {
    while (/[ \t\r\n]/.test(text[offset] ?? '') && offset < text.length)
      offset++;
  };
  const string = (): string => {
    const start = offset++;
    while (offset < text.length) {
      const character = text[offset++];
      if (character === '\\') {
        offset++;
        continue;
      }
      if (character === '"')
        return JSON.parse(text.slice(start, offset)) as string;
    }
    return invalid();
  };
  const value = (depth: number): unknown => {
    if (depth > 32) return invalid();
    whitespace();
    if (text[offset] === '"') return string();
    if (text[offset] === '{') {
      offset++;
      whitespace();
      const result: Record<string, unknown> = Object.create(null) as Record<
        string,
        unknown
      >;
      if (text[offset] === '}') {
        offset++;
        return result;
      }
      while (offset < text.length) {
        whitespace();
        if (text[offset] !== '"') return invalid();
        const key = string();
        if (Object.hasOwn(result, key)) return invalid();
        whitespace();
        if (text[offset++] !== ':') return invalid();
        result[key] = value(depth + 1);
        whitespace();
        const separator = text[offset++];
        if (separator === '}') return result;
        if (separator !== ',') return invalid();
      }
      return invalid();
    }
    if (text[offset] === '[') {
      offset++;
      whitespace();
      const result: unknown[] = [];
      if (text[offset] === ']') {
        offset++;
        return result;
      }
      while (offset < text.length) {
        result.push(value(depth + 1));
        whitespace();
        const separator = text[offset++];
        if (separator === ']') return result;
        if (separator !== ',') return invalid();
      }
      return invalid();
    }
    const literal =
      /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(
        text.slice(offset),
      );
    if (!literal) return invalid();
    offset += literal[0].length;
    return JSON.parse(literal[0]) as unknown;
  };
  const result = value(0);
  whitespace();
  if (offset !== text.length) return invalid();
  return result;
}
