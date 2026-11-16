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
    expect(await getNews({ topic: "ai", source: "web-dev", order: "received", page: 2 }, signal)).toEqual(news);
    expect(mainInstance.get).toHaveBeenCalledWith(expect.stringMatching(/\/news$/), expect.objectContaining({ skipAuth: true, withCredentials: false, signal, params: { topic: "ai", source_key: "web-dev", order: "received", page: 2, limit: 20 } }));
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
    { ...news, items: [{ ...news.items[0], source_key: "node-js" }] },
    { ...news, items: [{ ...news.items[0], source_name: "Another publisher" }] },
    { ...news, items: [{ ...news.items[0], license_url: "https://example.test/another-license" }] },
    { ...news, sources: [...news.sources, ...news.sources] },
  ])("rejects malformed remote metadata without manufacturing cards", async (data) => {
    vi.mocked(mainInstance.get).mockResolvedValue({ data });
    await expect(getNews({ topic: "all", source: "all", order: "recent", page: 1 })).rejects.toThrow("La respuesta de noticias");
  });

  it("refreshes only the explicit approved source through authenticated transport", async () => {
    vi.mocked(mainInstance.post).mockResolvedValue({ data: refreshed });
    expect(await refreshNews("web-dev")).toEqual(refreshed);
    expect(mainInstance.post).toHaveBeenCalledWith(expect.stringMatching(/\/news\/refresh$/), { source_key: "web-dev" });
  });

  it("reads Node.js without refresh and sends its explicit refresh independently", async () => {
    const nodeArticle = { ...news.items[0], source_key: "node-js", source_name: "Node.js®", excerpt: null, author: null, provenances: [{ source_key: "node-js", source_name: "Node.js®", license_url: news.items[0].license_url }] };
    const nodeNews = { ...news, items: [nodeArticle], sources: [{ ...news.sources[0], key: "node-js", name: "Node.js®" }] };
    vi.mocked(mainInstance.get).mockResolvedValue({ data: nodeNews });
    expect(await getNews({ topic: "all", source: "node-js", order: "recent", page: 1 })).toEqual(nodeNews);
    expect(mainInstance.get).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ params: expect.objectContaining({ source_key: "node-js" }), skipAuth: true }));
    expect(mainInstance.post).not.toHaveBeenCalled();
    vi.mocked(mainInstance.post).mockResolvedValue({ data: { ...refreshed, source_key: "node-js" } });
    await refreshNews("node-js");
    expect(mainInstance.post).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/\/news\/refresh$/), { source_key: "node-js" });
  });

  it("rejects a refresh result from another source", async () => {
    vi.mocked(mainInstance.post).mockResolvedValue({ data: refreshed });
    await expect(refreshNews("node-js")).rejects.toThrow("La respuesta de noticias");
  });
});
