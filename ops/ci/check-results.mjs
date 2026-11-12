import { pathToFileURL } from 'node:url';

const FLAGS = ['client', 'server', 'python', 'native', 'contracts', 'docs', 'ci', 'docs_only'];
const JOBS = ['changes', 'client', 'server', 'python', 'native'];

/** A skipped or failed dependency must never turn into a successful required CI check. */
export function checkResults(needs) {
  if (!needs || typeof needs !== 'object' || Array.isArray(needs) ||
      JOBS.some((job) => !Object.hasOwn(needs, job))) {
    throw new Error('CI dependency results are incomplete');
  }
  if (needs.changes.result !== 'success') throw new Error('Change selection did not succeed');
  const outputs = needs.changes.outputs;
  if (!outputs || FLAGS.some((flag) => !['true', 'false'].includes(outputs[flag]))) {
    throw new Error('Change selection outputs are invalid');
  }
  const selected = {
    client: outputs.client === 'true',
    server: outputs.server === 'true' || outputs.contracts === 'true',
    python: outputs.python === 'true',
    native: outputs.native === 'true',
  };
  for (const [job, required] of Object.entries(selected)) {
    const expected = required ? 'success' : 'skipped';
    if (needs[job]?.result !== expected) {
      throw new Error(`CI check ${job} must be ${expected}`);
    }
  }
  return { status: 'passed', selected };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(checkResults(JSON.parse(process.env.CI_NEEDS_JSON ?? ''))));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'CI result verification failed');
    process.exitCode = 1;
  }
}
