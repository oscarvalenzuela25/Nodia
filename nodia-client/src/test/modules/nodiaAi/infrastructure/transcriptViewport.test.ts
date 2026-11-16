import { describe, expect, it } from "vitest";
import { captureTranscriptAnchor, restoreTranscriptAnchor } from "../../../../modules/nodiaAi/infrastructure/transcriptViewport";

function rect(top: number, height: number): DOMRect {
  return { top, bottom: top + height, left: 0, right: 320, x: 0, y: top, width: 320, height, toJSON: () => ({}) };
}

describe("transcript viewport anchoring", () => {
  it("retains the partially visible message instead of its old scroll percentage when text reflows", () => {
    const viewport = document.createElement("div");
    viewport.getBoundingClientRect = () => rect(100, 400);
    const older = document.createElement("article"), visible = document.createElement("article");
    older.dataset.messageId = "older"; visible.dataset.messageId = "visible";
    older.getBoundingClientRect = () => rect(-200, 100);
    let top = 80;
    visible.getBoundingClientRect = () => rect(top, 200);
    viewport.append(older, visible); viewport.scrollTop = 300;
    const anchor = captureTranscriptAnchor(viewport);
    expect(anchor).toEqual({ messageId: "visible", offset: -20 });
    top = 230;
    restoreTranscriptAnchor(viewport, anchor);
    expect(viewport.scrollTop).toBe(450);
  });

  it("does not jump when the original message is gone, or only offscreen messages exist", () => {
    const viewport = document.createElement("div");
    viewport.getBoundingClientRect = () => rect(100, 400);
    const message = document.createElement("article");
    message.dataset.messageId = "elsewhere";
    message.getBoundingClientRect = () => rect(600, 100);
    viewport.append(message); viewport.scrollTop = 80;
    expect(captureTranscriptAnchor(viewport)).toBeNull();
    restoreTranscriptAnchor(viewport, { messageId: "removed", offset: 20 });
    restoreTranscriptAnchor(viewport, null);
    expect(viewport.scrollTop).toBe(80);
  });
});
