import { describe, expect, it } from "vitest";
import { createAttachmentDraftContinuity } from "../../../../modules/nodiaAi/infrastructure/attachmentDraftContinuity";
import type { NodiaAiAdmitInput } from "../../../../modules/nodiaAi/infrastructure/types";

const input: NodiaAiAdmitInput = { client_message_id: "synthetic-message", expected_conversation_revision: 1, parts: [{ kind: "text", text: "Synthetic value: 0" }] };
describe("attachment continuity operation fences", () => {
  it("serializes binary and admission operations across chats without replaying on release", () => {
    const store = createAttachmentDraftContinuity(); store.setOwner("synthetic-owner:1");
    const release = store.acquireUpload("synthetic-owner:1")!;
    expect(store.acquireUpload("synthetic-owner:1")).toBeNull();
    expect(store.reserveAdmission("synthetic-owner:1", "chat-a", input, "draft")).toBeNull();
    release();
    const admission = store.reserveAdmission("synthetic-owner:1", "chat-a", input, "draft")!;
    expect(store.reserveAdmission("synthetic-owner:1", "chat-b", input, "other")).toBeNull();
    expect(store.acquireUpload("synthetic-owner:1")).toBeNull();
    release(); // A stale release cannot affect the admission.
    expect(store.getSnapshot().admissions["chat-a"]).toBe(admission);
  });
  it("discards the previous owner's state and prevents its late release or settlement affecting a new owner", () => {
    const store = createAttachmentDraftContinuity(); store.setOwner("synthetic-owner:1");
    const old = store.reserveAdmission("synthetic-owner:1", "chat-a", input, "private draft")!;
    store.setOwner(null); store.setOwner("synthetic-owner:2");
    const release = store.acquireUpload("synthetic-owner:2")!;
    const snapshot = store.getSnapshot();
    store.settleAdmission("synthetic-owner:1", "chat-a", old, "uncertain");
    store.update("synthetic-owner:1", "chat-a", () => { throw new Error("Old owner must never run a draft transform"); });
    expect(store.getSnapshot()).toBe(snapshot);
    expect(store.getSnapshot().admissions).toEqual({});
    release(); expect(store.getSnapshot().upload).toBeNull();
  });
  it("uses a fresh intent only after a definitive rejection; a delayed earlier result cannot replace recovery", () => {
    const store = createAttachmentDraftContinuity(); store.setOwner("synthetic-owner:1");
    const first = store.reserveAdmission("synthetic-owner:1", "chat-a", input, "first")!;
    store.settleAdmission("synthetic-owner:1", "chat-a", first, "uncertain");
    const candidate = { ...input, client_message_id: "fresh-synthetic-message", parts: [{ kind: "text" as const, text: "Edited draft" }] };
    const recovery = store.reserveAdmission("synthetic-owner:1", "chat-a", candidate, "edited")!;
    expect(recovery.input).toBe(input);
    store.settleAdmission("synthetic-owner:1", "chat-a", first, "accepted");
    expect(store.getSnapshot().admissions["chat-a"]).toBe(recovery);
    store.settleAdmission("synthetic-owner:1", "chat-a", recovery, "rejected");
    const fresh = store.reserveAdmission("synthetic-owner:1", "chat-a", candidate, "edited")!;
    expect(fresh.input).toBe(candidate);
    expect(fresh.text).toBe("edited");
  });
});
