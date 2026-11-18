import { beforeEach, describe, expect, it, vi } from "vitest";
import { mainInstance } from "../../../../../../config/api";
import { getNews, refreshNews } from "../../../../../../modules/news/pages/News/infrastructure/services";
import { news, refreshed } from "../../../fixtures";

vi.mock("../../../../../../config/api", () => ({ mainInstance: { get: vi.fn(), post: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

describe("News transport boundary", () => {
  it("reads saved results without session credentials and sends every applied filter", async () => {
    vi.mocked(mainInstance.get).mockResolvedValue({ data: news });
    const signal = new AbortController().signal;
    expect(await getNews({ topic: "programming", source: "go-blog", order: "received", page: 2 }, signal)).toEqual(news);
    expect(mainInstance.get).toHaveBeenCalledWith(expect.stringMatching(/\/news$/), expect.objectContaining({ skipAuth: true, withCredentials: false, signal, params: { catalog: 2, topic: "programming", source_key: "go-blog", order: "received", page: 2, limit: 20 } }));
    expect(mainInstance.post).not.toHaveBeenCalled();
  });

  it.each([
    { ...news, items: [{ ...news.items[0], url: "javascript:alert(1)" }] },
    { ...news, items: [{ ...news.items[0], published_at: "unknown" }] },
    { ...news, items: [{ ...news.items[0], excerpt: undefined }] },
    { ...news, pagination: { ...news.pagination, total: null } },
    { ...news, sources: [{ ...news.sources[0], license_url: "https://user:secret@example.test" }] },
    { ...news, items: [{ ...news.items[0], provenances: [] }] },
    { ...news, items: [{ ...news.items[0], provenances: undefined }] },
    { ...news, items: [{ ...news.items[0], provenances: [{ source_key: "unknown", source_name: "Unknown", license_url: "https://example.test/license" }] }] },
    { ...news, items: [{ ...news.items[0], provenances: [...news.items[0].provenances, ...news.items[0].provenances] }] },
    { ...news, items: [{ ...news.items[0], source_key: "rust-blog" }] },
    { ...news, items: [{ ...news.items[0], source_name: "Another publisher" }] },
    { ...news, items: [{ ...news.items[0], license_url: "https://example.test/another-license" }] },
    { ...news, sources: [...news.sources, ...news.sources] },
  ])("rejects malformed remote metadata without manufacturing cards", async (data) => {
    vi.mocked(mainInstance.get).mockResolvedValue({ data });
    await expect(getNews({ topic: "all", source: "all", order: "recent", page: 1 })).rejects.toThrow("La respuesta de noticias");
  });

  it.each(["web-dev", "node-js"])("rejects retired source %s in the new catalog", async (key) => {
    vi.mocked(mainInstance.get).mockResolvedValue({
      data: { ...news, items: [], sources: [{ ...news.sources[0], key }] },
    });
    await expect(getNews({ topic: "all", source: "all", order: "recent", page: 1 })).rejects.toThrow("La respuesta de noticias");
    expect(mainInstance.post).not.toHaveBeenCalled();
  });

  it("reads a technology card with all three provenances and no invented optional metadata", async () => {
    const sources = [
      news.sources[0],
      { ...news.sources[0], key: "rust-blog", name: "Synthetic Rust editor" },
      { ...news.sources[0], key: "kubernetes-blog", name: "Synthetic Kubernetes editor" },
    ];
    const source = sources[2];
    const data = {
      ...news,
      sources,
      items: [{
        ...news.items[0],
        source_key: source.key,
        source_name: source.name,
        topic: "technology",
        published_at: null,
        excerpt: null,
        author: null,
        provenances: sources.map(({ key, name, license_url }) => ({ source_key: key, source_name: name, license_url })),
      }],
    };
    vi.mocked(mainInstance.get).mockResolvedValue({ data });
    expect(await getNews({ topic: "technology", source: "kubernetes-blog", order: "recent", page: 1 })).toEqual(data);
  });

  it("refreshes only the explicit approved source through authenticated transport", async () => {
    vi.mocked(mainInstance.post).mockResolvedValue({ data: refreshed });
    expect(await refreshNews("go-blog")).toEqual(refreshed);
    expect(mainInstance.post).toHaveBeenCalledWith(expect.stringMatching(/\/news\/refresh$/), { source_key: "go-blog" });
  });

  it("reads Rust without refresh and sends its explicit refresh independently", async () => {
    const rustArticle = { ...news.items[0], source_key: "rust-blog", source_name: "Synthetic Rust editor", excerpt: null, author: null, provenances: [{ source_key: "rust-blog", source_name: "Synthetic Rust editor", license_url: news.items[0].license_url }] };
    const rustNews = { ...news, items: [rustArticle], sources: [{ ...news.sources[0], key: "rust-blog", name: "Synthetic Rust editor" }] };
    vi.mocked(mainInstance.get).mockResolvedValue({ data: rustNews });
    expect(await getNews({ topic: "all", source: "rust-blog", order: "recent", page: 1 })).toEqual(rustNews);
    expect(mainInstance.get).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ params: expect.objectContaining({ catalog: 2, source_key: "rust-blog" }), skipAuth: true }));
    expect(mainInstance.post).not.toHaveBeenCalled();
    vi.mocked(mainInstance.post).mockResolvedValue({ data: { ...refreshed, source_key: "rust-blog" } });
    await refreshNews("rust-blog");
    expect(mainInstance.post).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/\/news\/refresh$/), { source_key: "rust-blog" });
  });

  it("rejects a refresh result from another source", async () => {
    vi.mocked(mainInstance.post).mockResolvedValue({ data: refreshed });
    await expect(refreshNews("rust-blog")).rejects.toThrow("La respuesta de noticias");
  });
});
