const businessPathPattern = /^\/business\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export function isBusinessReturnPath(value: unknown): value is string {
  return typeof value === "string" && businessPathPattern.exec(value)?.[0] === value;
}

export function businessReturnPath(state: unknown): string | undefined {
  if (typeof state !== "object" || state === null || !("businessReturnPath" in state)) return;

  const destination = state.businessReturnPath;
  return isBusinessReturnPath(destination) ? destination : undefined;
}
