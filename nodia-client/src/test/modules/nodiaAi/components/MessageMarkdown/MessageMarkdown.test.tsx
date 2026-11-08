import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MessageMarkdown from "../../../../../modules/nodiaAi/components/MessageMarkdown";

describe("untrusted assistant Markdown", () => {
  it("renders GFM tables with column headings and readable Markdown structure", () => {
    render(<MessageMarkdown text={[
      "# Resumen", "", "Un **resultado** con *detalle* y ~~retirado~~.", "",
      "| Producto | Cantidad |", "| --- | ---: |", "| Producto sintético | 0 |", "", "- Primero", "- Segundo", "", "> Nota preservada", "",
      "```ts", "const cantidad = 0;", "```",
    ].join("\n")} />);
    expect(screen.getByRole("heading", { level: 3, name: "Resumen" })).toBeInTheDocument();
    expect(screen.getByText("resultado").tagName).toBe("STRONG");
    expect(screen.getByText("detalle").tagName).toBe("EM");
    const region = screen.getByRole("region", { name: "Tabla del mensaje" });
    expect(region).toHaveAttribute("tabIndex", "0");
    const table = within(region).getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Cantidad" })).toHaveAttribute("scope", "col");
    expect(within(table).getByRole("cell", { name: "0" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Bloque de código del mensaje" })).toHaveTextContent("const cantidad = 0;");
  });

  it.each(["https://example.invalid/report", "http://example.invalid/report", "mailto:qa@example.invalid"])("allows explicit user-activated %s links without an opener or referrer", href => {
    render(<MessageMarkdown text={`[Destino sintético](${href})`} />);
    const link = screen.getByRole("link", { name: "Destino sintético" });
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it.each([
    "javascript:alert%281%29", "JaVaScRiPt:alert%281%29", "data:text/html;base64,PHNjcmlwdD4=", "file:///private/file.txt",
    "codex://review", "ftp://example.invalid/file", "//example.invalid/report", "/tools/private", "#private-action",
    "java&#x73;cript:alert%281%29", "javascript&#58;alert%281%29",
  ])("keeps a forbidden destination inert: %s", href => {
    const view = render(<MessageMarkdown text={`[Destino no confiable](${href})`} />);
    expect(screen.getByText("Destino no confiable")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(view.container.querySelector("[href]")).toBeNull();
  });

  it("never mounts Markdown images or resource-loading HTML, while retaining safe image descriptions", () => {
    const view = render(<MessageMarkdown text={[
      "![Descripción de imagen](https://example.invalid/private.png)", "", "![Imagen embebida](data:image/png;base64,abc)", "",
      '<img src="https://example.invalid/track" onerror="alert(1)">', "", '<script>alert("unsafe")</script>', "",
      '<iframe src="https://example.invalid/private"></iframe>', "", '<video src="https://example.invalid/track"></video>', "",
      '<form action="/private"><input value="unsafe"></form>', "", "Texto **seguro** preservado.",
    ].join("\n")} />);
    expect(screen.getByText("Descripción de imagen")).toBeInTheDocument();
    expect(screen.getByText("Imagen embebida")).toBeInTheDocument();
    expect(screen.getByText("seguro")).toBeInTheDocument();
    expect(view.container.querySelector("img,script,iframe,video,audio,source,form,input,svg,object,embed")).toBeNull();
    expect(view.container.querySelector("[src],[onclick],[onerror]")).toBeNull();
  });

  it("shows code and escaped HTML as text and does not convert them to active elements", () => {
    const source = '<img src="https://example.invalid/code-only" onerror="alert(1)">';
    const view = render(<MessageMarkdown text={`\`\`\`html\n${source}\n\`\`\`\n\n&lt;script&gt;texto literal&lt;/script&gt;`} />);
    expect(screen.getByRole("region", { name: "Bloque de código del mensaje" })).toHaveTextContent(source);
    expect(screen.getByText("<script>texto literal</script>")).toBeInTheDocument();
    expect(view.container.querySelector("img,script")).toBeNull();
  });

  it("preserves existing local table scroll and renders an incomplete code fence during updates", () => {
    const table = "| Producto | Cantidad |\n| --- | --- |\n| Primero | 1 |";
    const view = render(<MessageMarkdown text={table} />);
    const region = screen.getByRole("region", { name: "Tabla del mensaje" });
    region.scrollLeft = 96;
    view.rerender(<MessageMarkdown text={`${table}\n| Segundo | 0 |`} />);
    expect(screen.getByRole("region", { name: "Tabla del mensaje" })).toBe(region);
    expect(region.scrollLeft).toBe(96);
    expect(screen.getByRole("cell", { name: "Segundo" })).toBeInTheDocument();
    view.rerender(<MessageMarkdown text={"```txt\nRespuesta parcial conservada"} />);
    expect(screen.getByRole("region", { name: "Bloque de código del mensaje" })).toHaveTextContent("Respuesta parcial conservada");
  });

  it("renders GFM task markers as disabled display controls", () => {
    render(<MessageMarkdown text={"- [x] Revisado\n- [ ] Pendiente"} />);
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toBeChecked();
    expect(boxes.every(box => box.hasAttribute("disabled"))).toBe(true);
  });
});
