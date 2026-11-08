const components = {
  'teacher-validation': './teacher-validation',
  'teacher-assessment': './teacher-assessment',
  'teacher-attempt-persistence': '../use-case/teacher-attempt-persistence',
  'publish-teacher': '../use-case/publish-teacher.use-case',
} as const;

type Component = keyof typeof components;
export type TeacherPublicationDiagnostic = {
  code: 'publication_failure_located' | 'publication_failure_unclassified';
  component: Component | null;
  line: number | null;
  column: number | null;
  frames: { component: Component; line: number; column: number }[];
};

const locations = Object.entries(components).flatMap(([component, relative]) =>
  ['js', 'ts'].flatMap((extension) => {
    const url = new URL(`${relative}.${extension}`, import.meta.url);
    const path = decodeURIComponent(url.pathname);
    const paths = process.platform === 'win32' && /^\/[A-Za-z]:\//.test(path)
      ? [url.href, path.slice(1), path.slice(1).replaceAll('/', '\\')]
      : [url.href, path];
    return paths.map((path) => ({
      component: component as Component,
      path,
    }));
  }),
);

/** A finite diagnostic only. Never return error messages, paths, bodies or stack frames. */
export function teacherPublicationDiagnostic(error: unknown): TeacherPublicationDiagnostic {
  const unknown: TeacherPublicationDiagnostic = {
    code: 'publication_failure_unclassified', component: null, line: null, column: null, frames: [],
  };
  try {
    if (!(error instanceof Error)) return unknown;
    const stack: unknown = error.stack;
    if (typeof stack !== 'string' || stack.length > 32768) return unknown;
    const frames: TeacherPublicationDiagnostic['frames'] = [];
    for (const frame of stack.split('\n').slice(1, 65)) {
      if (/^\s+at teacherError \(/.test(frame)) continue;
      for (const { component, path } of locations) {
        const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = new RegExp(`^\\s+at (?:[^()\\r\\n]+ \\()?${escaped}:(\\d{1,6}):(\\d{1,6})\\)?$`).exec(frame);
        if (!match) continue;
        const line = Number(match[1]), column = Number(match[2]);
        if (line < 1 || column < 1) continue;
        frames.push({ component, line, column });
        break;
      }
      if (frames.length === 4) break;
    }
    if (frames.length) return { code: 'publication_failure_located', ...frames[0], frames };
  } catch { /* Untrusted errors and getters cannot interrupt publication closure. */ }
  return unknown;
}
import type { TeacherPurpose } from '../types/teacher.types.js';


/** Diagnostic sinks cannot prevent savepoint rollback or either terminal ACK. */
export function reportTeacherPublicationFailure(
  context: { job_id: string; operation_id: string; purpose: TeacherPurpose },
  error: unknown,
  emit: (json: string) => void,
): void {
  try {
    emit(JSON.stringify({
      event: 'teacher_publication_rejected', job_id: context.job_id,
      operation_id: context.operation_id, purpose: context.purpose,
      failure: teacherPublicationDiagnostic(error),
    }));
  } catch { /* Logging is observational and never owns publication closure. */ }
}
