/** Show the stored calendar's timezone; a browser/OS timezone change is not a reschedule. */
export function reviewDueDate(dueAt: string, timezone: string, language: string): string | null {
  const date = new Date(dueAt);
  if (!Number.isFinite(date.getTime())) return null;
  try { return new Intl.DateTimeFormat(language, { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(date); }
  catch { return null; }
}
