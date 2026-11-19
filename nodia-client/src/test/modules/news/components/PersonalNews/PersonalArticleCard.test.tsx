import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import PersonalArticleCard from "../../../../../modules/news/components/PersonalNews/PersonalArticleCard";
import type { PersonalArticle } from "../../../../../modules/news/components/PersonalNews/types";

const dates = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
const article: PersonalArticle = {
  id: "dev-123",
  provider: "dev-community",
  title: "An article from DEV",
  url: "https://dev.to/example/an-article-from-dev",
  published_at: "2026-11-17T14:00:00.000Z",
};
const cover = "https://media2.dev.to/cover.png";

describe("Personal News article card", () => {
  it("wraps the cover, heading and metadata in a single named native link", async () => {
    const user = userEvent.setup();
    render(<PersonalArticleCard article={{ ...article, cover_image_url: cover }} providerName="DEV Community" dates={dates} />);

    const link = screen.getByRole("link", { name: article.title });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", article.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getAllByRole("link")).toEqual([link]);
    expect(screen.getByRole("article").parentElement).toBe(link);
    expect(screen.getByRole("heading", { name: article.title, level: 3 }).closest("a")).toBe(link);
    expect(screen.getByAltText("").closest("a")).toBe(link);
    expect(screen.getByText("Nov 17, 2026").closest("a")).toBe(link);
    await user.tab();
    expect(link).toHaveFocus();
  });

  it("replaces an unavailable cover and keeps the accessible link and article details", () => {
    render(<PersonalArticleCard article={{ ...article, cover_image_url: cover }} providerName="DEV Community" dates={dates} />);

    const image = screen.getByAltText("");
    expect(image).toHaveAttribute("src", cover);
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
    fireEvent.error(image);

    expect(screen.queryByAltText("")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: article.title })).toHaveAttribute("href", article.url);
    expect(screen.getByText(/DEV Community/)).toBeVisible();
    expect(screen.getByText("Nov 17, 2026")).toHaveAttribute("datetime", article.published_at);
  });

  it("renders older articles and accepts a later cover after an earlier one failed", () => {
    const card = (article: PersonalArticle) => <PersonalArticleCard article={article} providerName="DEV Community" dates={dates} />;
    const { rerender } = render(card(article));
    expect(screen.queryByAltText("")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: article.title })).toBeVisible();

    rerender(card({ ...article, cover_image_url: cover }));
    fireEvent.error(screen.getByAltText(""));
    const nextCover = "https://media2.dev.to/new-cover.png";
    rerender(card({ ...article, cover_image_url: nextCover }));
    expect(screen.getByAltText("")).toHaveAttribute("src", nextCover);
  });
});
