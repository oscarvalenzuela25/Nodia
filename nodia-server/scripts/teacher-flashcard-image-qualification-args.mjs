const id = /^[1-9][0-9]{0,18}$/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const actions = new Map([
  ['--probe-request-key', 'probe'],
  ['--inspect-operation-id', 'inspect'],
  ['--accept-operation-id', 'accept'],
]);
const allowed = new Set([
  '--user-id',
  '--auth-session-public-id',
  '--connection-id',
  '--model-id',
  '--effort-id',
  ...actions.keys(),
]);

function positiveBigint(value) {
  return id.test(value ?? '') && BigInt(value) <= 9223372036854775807n;
}

export function parseFlashcardImageQualificationArgs(values) {
  const args = new Map();
  for (const value of values) {
    const split = value.indexOf('=');
    const flag = value.slice(0, split);
    if (split < 1 || !allowed.has(flag) || args.has(flag))
      throw Error('invalid qualification arguments');
    args.set(flag, value.slice(split + 1));
  }

  const commands = [...actions].filter(([flag]) => args.has(flag));
  const [flag, action] = commands[0] ?? [];
  const operation = args.get(flag);
  const userId = args.get('--user-id');
  const sessionId = args.get('--auth-session-public-id');
  const connection = args.get('--connection-id');
  const model = args.get('--model-id');
  const effort = args.get('--effort-id') ?? null;
  if (
    commands.length !== 1 ||
    !uuid.test(operation ?? '') ||
    !positiveBigint(userId) ||
    !uuid.test(sessionId ?? '') ||
    !positiveBigint(connection) ||
    !model?.trim() ||
    model !== model.trim() ||
    /[\0\r\n]/.test(model) ||
    Buffer.byteLength(model) > 1024 ||
    (effort !== null && !/^[a-z_]{1,32}$/.test(effort))
  )
    throw Error('invalid qualification arguments');

  return {
    action,
    operation: operation.toLowerCase(),
    actor: { userId, sessionId: sessionId.toLowerCase() },
    selection: {
      connection_id: connection,
      mode: 'api_key',
      model_id: model,
      effort_id: effort,
    },
  };
}
