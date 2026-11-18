import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NewsArticleCard from "../../../../../modules/news/components/NewsArticleCard";
import { article } from "../../fixtures";

describe("NewsArticleCard", () => {
  it("distinguishes reception from missing publication and renders an excerpt as text", () => {
    render(<NewsArticleCard article={{ ...article, published_at: null, excerpt: "<script>synthetic</script>" }} />);
    expect(screen.getByText(/Recibido el/)).toBeVisible();
    expect(screen.queryByText(/Publicado el/)).not.toBeInTheDocument();
    expect(screen.getByText("<script>synthetic</script>")).toBeVisible();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByRole("link", { name: article.title })).toHaveAttribute("href", article.url);
    expect(screen.getByRole("link", { name: "Licencia del contenido" })).toHaveAttribute("href", article.license_url);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("keeps links mounted while temporarily blocking interaction", () => {
    const view = render(<NewsArticleCard article={article} />);
    const link = screen.getByRole("link", { name: article.title });
    view.rerender(<NewsArticleCard article={article} disabled />);
    expect(screen.getByRole("link", { name: article.title })).toBe(link);
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(fireEvent.click(link)).toBe(false);
    view.rerender(<NewsArticleCard article={article} />);
    expect(link).not.toHaveAttribute("aria-disabled");
  });

  it("preserves all three publishers and license links on a shared article", () => {
    render(<NewsArticleCard article={{ ...article, provenances: [
      ...article.provenances,
      { source_key: "rust-blog", source_name: "Synthetic Rust editor", license_url: "https://example.test/rust-license" },
      { source_key: "kubernetes-blog", source_name: "Synthetic Kubernetes editor", license_url: "https://example.test/kubernetes-license" },
    ] }} />);
    expect(screen.getByText("Synthetic editor")).toBeVisible();
    expect(screen.getByText("Synthetic Rust editor")).toBeVisible();
    expect(screen.getByText("Synthetic Kubernetes editor")).toBeVisible();
    expect(screen.getByRole("link", { name: "Licencia de Synthetic editor" })).toHaveAttribute("href", article.license_url);
    expect(screen.getByRole("link", { name: "Licencia de Synthetic Rust editor" })).toHaveAttribute("href", "https://example.test/rust-license");
    expect(screen.getByRole("link", { name: "Licencia de Synthetic Kubernetes editor" })).toHaveAttribute("href", "https://example.test/kubernetes-license");
    expect(screen.getByRole("link", { name: "Aviso legal de Rust" })).toHaveAttribute("href", "/legal/news-rust-notice.txt");
    expect(screen.getAllByRole("link", { name: article.title })).toHaveLength(1);
  });

  it("shows the Rust notice with missing optional article metadata", () => {
    render(<NewsArticleCard article={{ ...article, source_key: "rust-blog", source_name: "Synthetic Rust editor", excerpt: null, author: null, provenances: [{ source_key: "rust-blog", source_name: "Synthetic Rust editor", license_url: "https://example.test/rust-license" }] }} />);
    expect(screen.getByRole("link", { name: "Aviso legal de Rust" })).toBeVisible();
    expect(screen.queryByText("Extracto abreviado y presentado como texto.")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
