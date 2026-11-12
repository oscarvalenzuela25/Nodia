const stages = new Set(['init', 'requalify', 'case', 'repair', 'extra', 'grade', 'restore', 'export', 'cleanup']);
/** An explicit opt-in and compatible arguments are checked before env/DB/Docker work. */
export function parseTeacherUpgradeRealArgs(argv) {
  const values = new Map();
  for (const item of argv) {
    const match = /^--([a-z-]+)(?:=(.+))?$/.exec(item);
    if (!match || values.has(match[1])) throw Error('invalid_teacher_qa_arguments');
    values.set(match[1], match[2] ?? true);
  }
  if (values.get('real-provider') !== true || !stages.has(values.get('stage')) ||
      [...values.keys()].some(key => !['real-provider', 'stage', 'topic', 'signal', 'post-limit'].includes(key))) throw Error('invalid_teacher_qa_arguments');
  const stage = values.get('stage');
  if (stage === 'case') {
    if (!['english', 'sql'].includes(values.get('topic')) || !['error', 'success', 'none'].includes(values.get('signal'))) throw Error('invalid_teacher_qa_arguments');
  } else if (values.has('topic') || values.has('signal')) throw Error('invalid_teacher_qa_arguments');
  if (values.has('post-limit') && (!['init', 'repair', 'extra'].includes(stage) || !['16', '20'].includes(values.get('post-limit')))) throw Error('invalid_teacher_qa_arguments');
  return Object.fromEntries(values);
}
