import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFlashcardImage, useFlashcardWrites } from "../../../../modules/teacher/infrastructure/useFlashcards";
import type { Flashcard } from "../../../../modules/teacher/infrastructure/flashcards";

const stub = vi.hoisted(() => ({
  actor: { user: { id: "owner" }, sessionVersion: 1, active: true },
  get: vi.fn(), post: vi.fn(), delete: vi.fn(), success: vi.fn(), notify: vi.fn(),
}));
vi.mock("../../../../store/authStore", () => ({
  default: Object.assign(<T,>(selector: (state: typeof stub.actor) => T) => selector(stub.actor), { getState: () => stub.actor }),
  hasActiveSession: (actor: typeof stub.actor) => actor.active,
}));
vi.mock("../../../../config/api", () => ({ mainInstance: { get: stub.get, post: stub.post, delete: stub.delete } }));
vi.mock("../../../../config/httpFeedback", () => ({ notifyHttpError: stub.notify }));
vi.mock("sileo", () => ({ sileo: { success: stub.success } }));

const id = "cfc5a2bf-544c-4048-86f5-26ee2038afc1";
const request = "7c1fff63-d792-4fb7-bdc3-a7098a79c9b4";
const card: Flashcard = { id, deck_id: "general", question: "A question", answer: "An answer", revision: 1, image: { side: "answer" }, source: null };
const list = { data: [card], meta: { page: 1, total: 1, total_pages: 1 } };
const prefix = ["teacher", "owner", 1];
const listKey = [...prefix, "flashcards/cards", { deck_id: "general", page: 1 }];
const imageKey = [...prefix, "flashcards/image", id, 1];
const otherImage = ["teacher", "other", 2, "flashcards/image", id, 1];

beforeEach(() => {
  vi.resetAllMocks();
  stub.actor.user.id = "owner";
  stub.actor.sessionVersion = 1;
  stub.actor.active = true;
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe("Teacher flashcard queries and mutations", () => {
  it("waits for a confirmed deletion before removing the card and the owner's image", async () => {
    const { client, wrapper } = setup();
    client.setQueryData(listKey, list);
    client.setQueryData(imageKey, "private-image");
    client.setQueryData(otherImage, "separate-owner");
    stub.delete.mockResolvedValueOnce({ status: 200 }).mockResolvedValueOnce({ status: 204 });
    const { result } = renderHook(() => useFlashcardWrites(), { wrapper });

    await act(async () => { await expect(result.current.deleteCard(id)).rejects.toThrow("flashcard_delete_unconfirmed"); });
    expect(client.getQueryData(listKey)).toEqual(list);
    expect(client.getQueryData(imageKey)).toBe("private-image");
    expect(stub.success).not.toHaveBeenCalled();
    expect(stub.notify).toHaveBeenCalledOnce();

    await act(async () => { expect(await result.current.deleteCard(id)).toBe(true); });
    expect(client.getQueryData(listKey)).toMatchObject({ data: [] });
    expect(client.getQueryData(imageKey)).toBeUndefined();
    expect(client.getQueryData(otherImage)).toBe("separate-owner");
  });

  it("keeps the caller's idempotency key on an explicit retry and ignores a late acknowledgment after a change of actor", async () => {
    const { client, wrapper } = setup();
    const payload = { question: card.question, answer: card.answer };
    client.setQueryData(listKey, list);
    let reply: (value: { data: Flashcard }) => void = () => {};
    stub.post.mockRejectedValueOnce(new Error("transient"))
      .mockImplementationOnce(() => new Promise<{ data: Flashcard }>(resolve => { reply = resolve; }));
    const { result } = renderHook(() => useFlashcardWrites(), { wrapper });
    await act(async () => { await expect(result.current.createCard(payload, request)).rejects.toThrow("transient"); });
    const retry = result.current.createCard(payload, request);
    await waitFor(() => expect(stub.post).toHaveBeenCalledTimes(2));
    expect(stub.post.mock.calls).toEqual([
      ["/teacher/flashcards/cards", { ...payload, request_key: request }],
      ["/teacher/flashcards/cards", { ...payload, request_key: request }],
    ]);
    stub.actor.sessionVersion += 1;
    await act(async () => { reply({ data: card }); expect(await retry).toBeNull(); });
    expect(stub.success).not.toHaveBeenCalled();
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(false);
  });

  it("keeps a Set on failure, then removes only its descendants on a confirmed deletion", async () => {
    const { client, wrapper } = setup();
    const setId = "8d87bff0-a2c3-4f8e-9a91-ad29d17d6c26";
    const set = { id: setId, title: "Vocabulary", deck_count: 1 };
    const deck = { id: request, title: "Greetings", set_id: setId, card_count: 1 };
    const general = { id: "general", title: "General", set_id: null, card_count: 1 };
    const deckKey = [...prefix, "flashcards/decks", undefined];
    const setKey = [...prefix, "flashcards/sets", undefined];
    const otherDeckKey = ["teacher", "other", 2, "flashcards/decks", undefined];
    client.setQueryData(setKey, [set]);
    client.setQueryData(deckKey, [general, deck]);
    client.setQueryData(otherDeckKey, [deck]);
    const deckCardKey = [...prefix, "flashcards/cards", { deck_id: deck.id, page: 1 }];
    const deckPage = { ...list, data: [{ ...card, deck_id: deck.id }] };
    client.setQueryData(deckCardKey, deckPage);
    client.setQueryData(listKey, list);
    client.setQueryData(imageKey, "private-image");
    client.setQueryData(otherImage, "separate-owner");
    stub.delete.mockRejectedValueOnce(new Error("server unavailable")).mockResolvedValueOnce({ status: 204 });
    const { result } = renderHook(() => useFlashcardWrites(), { wrapper });

    await act(async () => { await expect(result.current.deleteSet(setId)).rejects.toThrow("server unavailable"); });
    expect(client.getQueryData(setKey)).toEqual([set]);
    expect(client.getQueryData(deckKey)).toEqual([general, deck]);
    expect(client.getQueryData(deckCardKey)).toEqual(deckPage);
    expect(client.getQueryData(imageKey)).toBe("private-image");
    expect(stub.success).not.toHaveBeenCalled();
    await act(async () => { expect(await result.current.deleteSet(setId)).toBe(true); });
    expect(stub.delete).toHaveBeenLastCalledWith("/teacher/flashcards/sets/" + setId);
    expect(client.getQueryData(setKey)).toEqual([]);
    expect(client.getQueryData(deckKey)).toEqual([general]);
    expect(client.getQueryData(otherDeckKey)).toEqual([deck]);
    expect(client.getQueryData(deckCardKey)).toBeUndefined();
    expect(client.getQueryData(imageKey)).toBeUndefined();
    expect(client.getQueryData(otherImage)).toBe("separate-owner");
    expect(client.getQueryData(listKey)).toEqual(list);
  });

  it("validates receipt identity when importing by Set title or a selected Set ID", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useFlashcardWrites(), { wrapper });
    const setId = "8d87bff0-a2c3-4f8e-9a91-ad29d17d6c26";
    const receipt = { set: { id: setId, title: "Inglés", deck_count: 7 }, imported_count: 1 };
    const cards = [{ question: card.question, answer: card.answer }];
    stub.post.mockResolvedValueOnce({ status: 201, data: receipt })
      .mockResolvedValueOnce({ status: 201, data: { deck: { id, title: "Día 1", card_count: 1, set_id: request }, imported_count: 1 } });
    await act(async () => {
      expect(await result.current.importCards({ set: { title: "INGLÉS" }, decks: [{ title: "Día 1", cards }] }, request)).toEqual(receipt);
    });
    await act(async () => {
      await expect(result.current.importCards({ destination: { kind: "new", title: "Día 1", set_id: setId }, cards }, request))
        .rejects.toThrow("flashcard_import_unconfirmed");
    });
    expect(stub.post).toHaveBeenNthCalledWith(2, "/teacher/flashcards/imports", {
      destination: { kind: "new", title: "Día 1", set_id: setId }, cards, request_key: request,
    });
  });

  it("clears cached pages and their private images only for a confirmed deleted deck", async () => {
    const { client, wrapper } = setup();
    const deck = { id: request, title: "Greetings", set_id: null, card_count: 1 };
    const deckKey = [...prefix, "flashcards/decks", undefined];
    const deckCardKey = [...prefix, "flashcards/cards", { deck_id: deck.id, page: 2 }];
    client.setQueryData(deckKey, [deck]);
    client.setQueryData(deckCardKey, { ...list, data: [{ ...card, deck_id: deck.id }] });
    client.setQueryData(listKey, { ...list, data: [] });
    client.setQueryData(imageKey, "private-image");
    client.setQueryData(otherImage, "separate-owner");
    stub.delete.mockResolvedValue({ status: 204 });
    const { result } = renderHook(() => useFlashcardWrites(), { wrapper });

    await act(async () => { expect(await result.current.deleteDeck(deck.id)).toBe(true); });
    expect(client.getQueryData(deckKey)).toEqual([]);
    expect(client.getQueryData(deckCardKey)).toBeUndefined();
    expect(client.getQueryData(listKey)).toMatchObject({ data: [] });
    expect(client.getQueryData(imageKey)).toBeUndefined();
    expect(client.getQueryData(otherImage)).toBe("separate-owner");
  });

  it("keeps the image private until enabled and rejects an unexpected response type", async () => {
    const { wrapper } = setup();
    stub.get.mockResolvedValue({ data: new Blob(["bad"], { type: "text/html" }) });
    const hook = renderHook(({ enabled }) => useFlashcardImage(card, enabled), { wrapper, initialProps: { enabled: false } });
    expect(hook.result.current.src).toBeNull();
    expect(stub.get).not.toHaveBeenCalled();
    hook.rerender({ enabled: true });
    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(stub.get).toHaveBeenCalledWith("/teacher/flashcards/cards/" + id + "/image", {
      responseType: "blob", signal: expect.any(AbortSignal),
    });
    expect(hook.result.current.src).toBeNull();
    await waitFor(() => expect(stub.notify).toHaveBeenCalledOnce());
  });
});
