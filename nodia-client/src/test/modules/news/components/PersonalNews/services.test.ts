import { AxiosError, isCancel } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mainInstance } from "../../../../../config/api";
import useAuthStore from "../../../../../store/authStore";
import {
  connectPersonalSource, currentPersonalNewsActor, getPersonalArticles, getPersonalConnections, personalNewsErrorKey,
} from "../../../../../modules/news/components/PersonalNews/services";

vi.mock("../../../../../config/api", () => ({ mainInstance: { get: vi.fn(), post: vi.fn() } }));

const login = (id: string) => useAuthStore.getState().login({
  token: "synthetic-session", expiresAt: Date.now() + 60_000, user: { id, name: "Synthetic account" },
});
const signal = () => new AbortController().signal;
const dev = "dev-community";
const daily = "daily-dev";
const syntheticKey = "synthetic-key-for-test-only";
const article = {
  id: "dev-123",
  provider: dev,
  title: "An example article",
  url: "https://dev.to/example/an-example-article",
  published_at: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  login("42");
});
afterEach(() => useAuthStore.getState().logout());

describe("Personal News private transport", () => {
  it("reads the selected provider through the normal session client without sending a provider request", async () => {
    vi.mocked(mainInstance.get).mockResolvedValue({ data: { items: [] } });
    await expect(getPersonalArticles(currentPersonalNewsActor()!, dev, signal())).resolves.toEqual({ items: [] });
    expect(mainInstance.get).toHaveBeenCalledWith(expect.stringMatching(/\/news\/personal\/articles$/), {
      params: { provider: dev },
      signal: expect.any(AbortSignal),
    });
    expect(mainInstance.post).not.toHaveBeenCalled();
  });

  it("preserves a DEV CDN cover and accepts older snapshots without a cover", async () => {
    const withCover = { ...article, id: "dev-456", cover_image_url: "https://media2.dev.to/cdn-cgi/image/width=960/cover.png" };
    vi.mocked(mainInstance.get).mockResolvedValue({ data: { items: [article, withCover] } });

    await expect(getPersonalArticles(currentPersonalNewsActor()!, dev, signal())).resolves.toEqual({
      items: [article, withCover],
    });
  });

  it.each([
    null,
    { url: "https://media2.dev.to/cover.png" },
    "not a URL",
    "http://media2.dev.to/cover.png",
    "blob:https://media2.dev.to/cover-id",
    "https://media2.dev.to.example.org/cover.png",
    "https://user:secret@media2.dev.to/cover.png",
    "https://media2.dev.to:8443/cover.png",
  ])("keeps the article when its optional cover is unusable (%j)", async (cover_image_url) => {
    vi.mocked(mainInstance.get).mockResolvedValue({ data: { items: [{ ...article, cover_image_url }] } });

    await expect(getPersonalArticles(currentPersonalNewsActor()!, dev, signal())).resolves.toEqual({
      items: [article],
    });
  });

  it("normalizes and deduplicates article tags from DEV while keeping legacy and malformed articles", async () => {
    const finite = { ...article, id: "dev-456", tags: [" REACT ", "react", "Sécurité", "dev-ops", "ci_cd"] };
    const malformed = { ...article, id: "dev-789", tags: ["react", "invalid/tag"] };
    vi.mocked(mainInstance.get).mockResolvedValue({ data: { items: [article, finite, malformed] } });
    const response = await getPersonalArticles(currentPersonalNewsActor()!, dev, signal());

    expect(response.items.map(({ id, tags }) => ({ id, tags }))).toEqual([
      { id: article.id, tags: undefined },
      { id: finite.id, tags: ["react", "sécurité", "dev-ops", "ci_cd"] },
      { id: malformed.id, tags: undefined },
    ]);
  });

  it("requires an explicit daily.dev reading selection and caps the private brief at ten links", async () => {
    const dailyItems = Array.from({ length: 10 }, (_, index) => ({ ...article, provider: daily, id: `daily-${index}` }));
    vi.mocked(mainInstance.get).mockResolvedValue({ data: { items: dailyItems } });
    const actor = currentPersonalNewsActor()!;
    await expect(getPersonalArticles(actor, undefined, signal())).rejects.toMatchObject({ code: "invalid_response" });
    await expect(getPersonalArticles(actor, daily, signal())).resolves.toEqual({ items: dailyItems });

    vi.mocked(mainInstance.get).mockResolvedValueOnce({ data: { items: [...dailyItems, { ...dailyItems[0], id: "daily-10" }] } });
    await expect(getPersonalArticles(actor, daily, signal())).rejects.toMatchObject({ code: "invalid_response" });
    expect(personalNewsErrorKey("news:provider_credentials_invalid", daily)).toBe("news:personal_daily_credentials_invalid");
  });

  it("rejects mixed-account or provider results after a change of session", async () => {
    const actor = currentPersonalNewsActor()!;
    let resolve!: (value: { data: { items: [] } }) => void;
    vi.mocked(mainInstance.get).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const pending = getPersonalArticles(actor, dev, signal());
    login("43");
    const request = vi.mocked(mainInstance.get).mock.calls[0][1];
    expect(request?.signal?.aborted).toBe(true);
    resolve({ data: { items: [] } });
    try {
      await pending;
      expect.fail("The previous account's result was accepted");
    } catch (error) {
      expect(isCancel(error)).toBe(true);
    }
    await expect(getPersonalConnections(actor, signal())).rejects.toMatchObject({ code: "ERR_CANCELED" });
    expect(mainInstance.get).toHaveBeenCalledOnce();
  });

  it("sends a key only when actively connecting, disables automatic replay and redacts upstream errors", async () => {
    const failure = new AxiosError(syntheticKey);
    failure.response = {
      status: 400, statusText: "Bad Request", headers: {},
      config: { headers: failure.config?.headers ?? {} },
      data: { message: syntheticKey },
    } as NonNullable<AxiosError["response"]>;
    vi.mocked(mainInstance.post).mockRejectedValueOnce(failure);
    await expect(connectPersonalSource(currentPersonalNewsActor()!, dev, syntheticKey, signal())).rejects.toEqual(
      expect.objectContaining({ message: "unknown", code: "unknown" }),
    );
    expect(mainInstance.post).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/\/news\/personal\/connections\/dev-community$/),
      { api_key: syntheticKey },
      { authRetried: true, signal: expect.any(AbortSignal) },
    );
  });

  it("rejects a malformed or unmasked connection response", async () => {
    vi.mocked(mainInstance.get).mockResolvedValue({ data: { connections: [{ provider: dev, key_hint: syntheticKey }] } });
    await expect(getPersonalConnections(currentPersonalNewsActor()!, signal())).rejects.toMatchObject({ code: "invalid_response" });
  });
});
