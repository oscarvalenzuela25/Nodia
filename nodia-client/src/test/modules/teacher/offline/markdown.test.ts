import { describe, expect, it } from "vitest";
import { renderReadingMarkdown } from "../../../../modules/teacher/offline/markdown";

function render(markdown: string) {
  const reader = document.createElement("div");
  reader.append(renderReadingMarkdown(markdown));
  return reader;
}

describe("downloaded Teacher reading material", () => {
  it("renders the structure of a lesson under its block heading", () => {
    const reader = render([
      "# Antes de empezar",
      "Texto con **énfasis fuerte**, *énfasis* y `nslookup`.",
      "- Primer caso\n  - Caso anidado",
      "4. Cuarto paso\n5. Quinto paso",
      "> Es una hipótesis.",
      "###### Una nota más específica",
    ].join("\n\n"));

    expect(reader.querySelector("h4")).toHaveTextContent("Antes de empezar");
    expect(reader.querySelector("p strong")).toHaveTextContent("énfasis fuerte");
    expect(reader.querySelector("p em")).toHaveTextContent("énfasis");
    expect(reader.querySelector("p code")).toHaveTextContent("nslookup");
    expect(reader.querySelector("ul > li > ul > li")).toHaveTextContent("Caso anidado");
    expect(reader.querySelector("ol")).toHaveAttribute("start", "4");
    expect(reader.querySelectorAll("ol > li")).toHaveLength(2);
    expect(reader.querySelector("blockquote")).toHaveTextContent("Es una hipótesis.");
    expect(reader.querySelector("h6")).toHaveTextContent("Una nota más específica");
  });

  it("keeps link labels, alternative text and sample code without creating navigable or executable DOM", () => {
    const reader = render([
      "[**Referencia**][external] y ![Diagrama](https://example.invalid/image.png).",
      "[external]: https://example.invalid/lesson",
      '<div onclick="">Etiqueta HTML</div>',
      '```html attribute="arbitrary"\n<img src="https://example.invalid/example.png">\n```',
    ].join("\n\n"));

    expect(reader.querySelector("p strong")).toHaveTextContent("Referencia");
    expect(reader.querySelector("p")).toHaveTextContent("Referencia y Diagrama.");
    expect(reader).not.toHaveTextContent("Etiqueta HTML");
    expect(reader.querySelector("pre > code")?.textContent).toBe('<img src="https://example.invalid/example.png">');
    expect(reader.querySelector("pre > code")?.attributes.length).toBe(0);
    expect(reader.querySelector("a, img, iframe, script, [href], [src], [onclick]")).toBeNull();
  });
});
