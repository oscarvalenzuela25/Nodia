import { describe, expect, it } from "vitest";
import {
  classifyStudyCalendarImportCategories,
  parseStudyCalendarImport,
} from "../../../../modules/teacher/infrastructure/studyCalendarImport";

const numbered = { version: 1, title: "Inglés", schedule: { kind: "numbered", days: 3 } };
const parse = (value: unknown) => parseStudyCalendarImport(JSON.stringify(value));

describe("study calendar paste validation", () => {
  it("keeps each optional source with its own activity and leaves omitted days empty", () => {
    const first = { text: "Mirar la clase", source: { label: "Clase", url: "https://example.com/a%20b" } };
    const second = { text: "Hacer los ejercicios", source: { label: "Ejercicios", url: "https://example.com/c" } };
    const practice = { text: "Practicar en voz alta" };
    const days = [{ day: 2, activities: [first, second, practice] }];

    expect(parse({ ...numbered, days })).toEqual({
      ok: true, plan: { ...numbered, days }, dayCount: 3,
    });
  });

  it("validates civil date ranges inclusively across a leap day and rejects impossible or out-of-range dates", () => {
    const schedule = { kind: "dated", start: "2028-02-28", end: "2028-03-01" };
    const plan = { ...numbered, schedule };

    expect(parse({ ...plan, days: [{ date: "2028-02-29" }] })).toMatchObject({ ok: true, dayCount: 3 });
    expect(parse({ ...plan, days: [{ date: "2028-02-30" }] })).toMatchObject({
      ok: false, issue: { code: "invalid_field", field: "date", dayIndex: 1 },
    });
    expect(parse({ ...plan, days: [{ date: "2028-03-02" }] })).toMatchObject({
      ok: false, issue: { code: "day_outside_schedule", dayIndex: 1 },
    });
    expect(parse({ ...plan, schedule: { ...schedule, end: "2029-03-01" } })).toMatchObject({
      ok: false, issue: { code: "date_range" },
    });
  });

  it("reports the position of a duplicate or a day with the wrong schedule identifier", () => {
    expect(parse({ ...numbered, days: [{ day: 1 }, { day: 1 }] })).toMatchObject({
      ok: false, issue: { code: "duplicate_day", dayIndex: 2 },
    });
    expect(parse({ ...numbered, days: [{ date: "2028-03-01" }] })).toMatchObject({
      ok: false, issue: { code: "invalid_field", dayIndex: 1 },
    });
    expect(parse({ ...numbered, days: [{ day: 4 }] })).toMatchObject({
      ok: false, issue: { code: "day_outside_schedule", dayIndex: 1 },
    });
  });

  it("locates unsafe sources and refuses pasted completion or internal identifiers", () => {
    const input = (activity: unknown) => ({
      ...numbered,
      days: [{ day: 1, activities: [{ text: "Escuchar" }, activity] }],
    });
    for (const url of ["http://example.com", "https://u:p@example.com", "https://example.com/a\\b", "file:///a", "https://example.com/a b"]) {
      expect(parse(input({ text: "Leer", source: { label: "Referencia", url } }))).toMatchObject({
        ok: false, issue: { code: "invalid_field", dayIndex: 1, activityIndex: 2, field: "activities.2.source.url" },
      });
    }
    expect(parse(input({ text: "Leer", completed: true }))).toMatchObject({
      ok: false, issue: { code: "invalid_field", dayIndex: 1, activityIndex: 2, field: "activities.2.completed" },
    });
    expect(parse({ ...numbered, owner_id: "another-person" })).toMatchObject({
      ok: false, issue: { code: "invalid_field", field: "owner_id" },
    });
  });

  it("distinguishes an unsupported format, malformed JSON and oversized data", () => {
    expect(parse({ ...numbered, version: 2 })).toMatchObject({ ok: false, issue: { code: "invalid_version" } });
    expect(parseStudyCalendarImport('{"version":')).toMatchObject({ ok: false, issue: { code: "invalid_json" } });
    expect(parseStudyCalendarImport("é".repeat(256 * 1024))).toMatchObject({ ok: false, issue: { code: "payload_size" } });
  });
});

describe("study calendar import category review", () => {
  it("rejects duplicate normalized names, distinguishes existing and inactive labels, and lists new names", () => {
    expect(parse({ ...numbered, categories: ["Idiomas", " ＩＤＩＯＭＡＳ "] })).toMatchObject({
      ok: false, issue: { code: "duplicate_category" },
    });
    expect(classifyStudyCalendarImportCategories(["idiomas", "Aprender\tReact", "Práctica"], [
      { name: "Idiomas", active: true },
      { name: "Aprender React", active: false },
    ])).toEqual({ reused: ["Idiomas"], inactive: ["Aprender React"], newCategories: ["Práctica"] });
  });
});
