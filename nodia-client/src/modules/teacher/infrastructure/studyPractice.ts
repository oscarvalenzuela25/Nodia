type Section = "hint" | "solution" | "criteria";

type StudyField = { promptMarkdown: string; answer: string };

export type StudyPractice = {
  mainMarkdown: string;
  hintMarkdown: string | null;
  solutionMarkdown: string | null;
  criteriaMarkdown: string | null;
  fields: StudyField[];
};

const practiceKinds = new Set(["guided_practice", "prediction", "check"]);
const sectionLabels = new Map<string, Section>([
  ["hint", "hint"], ["pista", "hint"], ["apoyo", "hint"],
  ["answer key", "solution"], ["answers", "solution"], ["model answer", "solution"],
  ["solution", "solution"], ["solución", "solution"], ["soluciones", "solution"],
  ["respuestas", "solution"], ["respuestas para revisar después", "solution"],
  ["respuesta modelo", "solution"], ["explicación de las respuestas", "solution"],
  ["review criteria", "criteria"], ["criterios de revisión", "criteria"],
  ["después, revisa", "criteria"],
]);

function marker(content: string, heading: boolean) {
  const colon = content.indexOf(":");
  if (!heading && colon === -1) return null;
  const label = colon === -1 ? content : content.slice(0, colon);
  const normalized = label.trim().replace(/^(\*\*|__)|(\*\*|__)$/g, "").trim().normalize("NFC").toLowerCase();
  const section = sectionLabels.get(normalized);
  if (!section) return null;
  const bold = /^(\*\*|__)/.exec(label.trim())?.[0];
  let body = colon === -1 ? "" : content.slice(colon + 1);
  if (bold && !label.endsWith(bold) && body.startsWith(bold)) body = body.slice(bold.length);
  return { section, body: body.trimStart() };
}

const listRow = /^ {0,3}([1-9]\d?)[.)][ \t]+(.+)$/;
const fenceRow = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const removeEmphasis = (value: string) => value.replace(/^(?:\*\*([^*]+)\*\*|__([^_]+)__)$/, "$1$2");

function solutionKeys(markdown: string) {
  const lines = markdown.trim().split("\n").filter(line => line.trim());
  const ordered = lines.map(line => listRow.exec(line));
  if (ordered.every((row, index) => Number(row?.[1]) === index + 1)) {
    return ordered.map(row => row![2]);
  }
  return lines.length === 1 ? removeEmphasis(lines[0].trim()).split(",") : [];
}

function fillFields(lines: string[], solution: string) {
  // Code, competing lists and prose answers belong to voluntary comparison.
  if (lines.some(line => fenceRow.test(line))) return [];
  const rows = lines.flatMap((line, index) => {
    const row = listRow.exec(line);
    return row ? [{ index, number: Number(row[1]), promptMarkdown: row[2] }] : [];
  });
  const answers = solutionKeys(solution).map(key => removeEmphasis(key.trim()).replace(/[.!?]$/, "").trim());
  if (rows.length === 0 || rows.length > 8 || rows.length !== answers.length ||
    rows.some((row, index) => row.number !== index + 1 || (row.promptMarkdown.match(/_{3,}/g) ?? []).length !== 1) ||
    lines.slice(rows[0].index, rows.at(-1)!.index + 1).some(line => line.trim() && !listRow.test(line)) ||
    answers.some(answer => !/^[\p{L}\p{M}\p{N}]+(?:[ -][\p{L}\p{M}\p{N}]+){0,4}$/u.test(answer) || / (?:or|o) /i.test(answer))) {
    return [];
  }

  for (const row of rows) lines[row.index] = "";
  return rows.map(({ promptMarkdown }, index) => ({ promptMarkdown, answer: answers[index] }));
}

/** Historical lesson text stays valid. Only explicit study sections create local comparisons. */
export function parseStudyPractice(markdown: string, kind?: string): StudyPractice {
  const result: StudyPractice = { mainMarkdown: markdown, hintMarkdown: null, solutionMarkdown: null, criteriaMarkdown: null, fields: [] };
  if (kind && !practiceKinds.has(kind)) return result;

  const parts: Record<Section | "main", string[]> = { main: [], hint: [], solution: [], criteria: [] };
  let active: { section: Section; level?: number; started: boolean } | null = null;
  let codeFence = "";
  for (const line of markdown.split(/\r?\n/)) {
    const currentFence = fenceRow.exec(line);
    const insideCode = Boolean(codeFence) || Boolean(currentFence);
    if (currentFence) {
      const [, opening, tail] = currentFence;
      if (!codeFence) codeFence = opening;
      else if (opening.startsWith(codeFence) && !tail.trim()) codeFence = "";
    }
    const heading = insideCode ? null : /^ {0,3}(#{1,6})[ \t]+(.+?)\s*#*\s*$/.exec(line);
    const content = heading?.[2] ?? line.trimStart();
    const boundary = insideCode || /^(?: {4}|\t)/.test(line) ? null : marker(content, Boolean(heading));
    if (boundary) {
      active = { section: boundary.section, level: heading?.[1].length, started: Boolean(boundary.body) };
      if (parts[active.section].length) parts[active.section].push("");
      if (boundary.body) parts[active.section].push(boundary.body);
      continue;
    }
    if (active && !insideCode) {
      const endsParagraph = active.level === undefined && (Boolean(heading) || (active.started && !line.trim()));
      const endsHeading = active.level !== undefined && heading && heading[1].length <= active.level;
      if (endsParagraph || endsHeading) active = null;
    }
    parts[active?.section ?? "main"].push(line);
    if (active && line.trim()) active.started = true;
  }

  const markdownSection = (section: Section) => parts[section].join("\n").trim() || null;
  const solution = markdownSection("solution");
  return {
    fields: solution && kind !== "prediction" ? fillFields(parts.main, solution) : [],
    mainMarkdown: parts.main.join("\n"),
    hintMarkdown: markdownSection("hint"),
    solutionMarkdown: solution,
    criteriaMarkdown: markdownSection("criteria"),
  };
}

export function matchesStudyAnswer(input: string, answer: string): boolean {
  const normalize = (value: string) => value.normalize("NFC").trim().replace(/[.!?]$/, "").replace(/\s+/g, " ").toLowerCase();
  return Boolean(input.trim()) && normalize(input) === normalize(answer);
}
