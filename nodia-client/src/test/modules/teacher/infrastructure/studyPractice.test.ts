import { describe, expect, it } from "vitest";
import { matchesStudyAnswer, parseStudyPractice } from "../../../../modules/teacher/infrastructure/studyPractice";

describe("study practice presentation", () => {
  it("separates the authored clue and historical answer key and pairs the three visible blanks", () => {
    const practice = parseStudyPractice([
      "Completa antes de consultar el apoyo:", "",
      "1. Para presentarte, escribe: **My ___ is Veko.**",
      "2. Para nombrar dos libros, escribe: **___ books.**",
      "3. Para identificar una silla, escribe: **This is a ___.**", "",
      "Apoyo: piensa en la función de cada frase.", "",
      "Respuestas para revisar después: **name, two, chair.**", "",
      "Esta actividad incluye ayuda.",
    ].join("\r\n"), "guided_practice");
    expect(practice.fields.map(field => field.answer)).toEqual(["name", "two", "chair"]);
    expect(practice.fields[1].promptMarkdown).toContain("___ books");
    expect(practice.mainMarkdown).toContain("Esta actividad incluye ayuda.");
    expect(practice.mainMarkdown).not.toMatch(/name, two, chair|Apoyo:|___ books/);
    expect(practice.hintMarkdown).toBe("piensa en la función de cada frase.");
    expect(practice.solutionMarkdown).toBe("**name, two, chair.**");
  });

  it("keeps open criteria for deliberate self-review and does not invent an answer", () => {
    const practice = parseStudyPractice([
      "Escribe un saludo y preséntate como Lumo.", "",
      "**Después, revisa:** ¿El saludo corresponde al momento? ¿Incluiste el nombre?", "",
      "Puedes usar un nombre ficticio.",
    ].join("\n"), "check");
    expect(practice.criteriaMarkdown).toBe("¿El saludo corresponde al momento? ¿Incluiste el nombre?");
    expect(practice.solutionMarkdown).toBeNull();
    expect(practice.fields).toEqual([]);
    expect(practice.mainMarkdown).toContain("Puedes usar un nombre ficticio.");
    expect(practice.mainMarkdown).not.toContain("¿Incluiste el nombre?");
  });

  it("reads separate English Markdown sections and retains multi-paragraph model answers for reveal", () => {
    const practice = parseStudyPractice([
      "1. ___ books", "2. This is a ___.", "",
      "### Hint", "Think about the quantity.", "",
      "### Answer key", "1. two", "2. chair", "",
      "### Review criteria", "Consider the noun and its plural.",
    ].join("\n"), "guided_practice");
    expect(practice.fields.map(field => field.answer)).toEqual(["two", "chair"]);
    expect(practice.criteriaMarkdown).toBe("Consider the noun and its plural.");
    expect(practice.hintMarkdown).toBe("Think about the quantity.");
    const open = parseStudyPractice("Write your answer.\n\n### Model answer\nFirst paragraph.\n\nSecond paragraph.", "check");
    expect(open.mainMarkdown.trim()).toBe("Write your answer.");
    expect(open.solutionMarkdown).toBe("First paragraph.\n\nSecond paragraph.");
  });

  it.each([
    ["1. ___ books\n2. This is a ___.", "two"],
    ["1. ___ books and ___ cups", "two"],
    ["1. ___ books", "two or three"],
    ["1. ___ books\n\nSome other exercise\n\n2. A ___", "two, chair"],
  ])("does not check ambiguous practice automatically", (body, answers) => {
    const practice = parseStudyPractice(`${body}\n\nSolución: ${answers}`, "guided_practice");
    expect(practice.fields).toEqual([]);
    expect(practice.mainMarkdown.trim()).toBe(body);
    expect(practice.solutionMarkdown).toBe(answers);
  });

  it("leaves code and worked examples intact", () => {
    const code = "```text\nAnswers: code below\n```";
    expect(parseStudyPractice(code, "guided_practice").mainMarkdown).toBe(code);
    expect(parseStudyPractice(code, "guided_practice").solutionMarkdown).toBeNull();
    expect(parseStudyPractice("Solution: two", "example").mainMarkdown).toBe("Solution: two");
  });
});

describe("local answer comparison", () => {
  it("accepts case, surrounding whitespace, unicode composition and terminal punctuation", () => {
    expect(matchesStudyAnswer("  TWo  BOOKS. ", "two books")).toBe(true);
    expect(matchesStudyAnswer("accio\u0301n", "acción")).toBe(true);
  });

  it("does not accept guesses with missing accents, different words or empty input", () => {
    expect(matchesStudyAnswer("accion", "acción")).toBe(false);
    expect(matchesStudyAnswer("third", "three")).toBe(false);
    expect(matchesStudyAnswer("   ", "chair")).toBe(false);
  });
});
