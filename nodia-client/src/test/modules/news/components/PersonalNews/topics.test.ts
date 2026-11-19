import { describe, expect, it } from "vitest";
import { allPersonalTopics, getPersonalReading } from "../../../../../modules/news/components/PersonalNews/topics";
import type { PersonalArticle } from "../../../../../modules/news/components/PersonalNews/types";

function article(id: string, title: string, tags?: string[]): PersonalArticle {
  return { id, title, tags, provider: "dev-community", url: `https://dev.to/examples/${id}`, published_at: null };
}

const fullStack = article("react-node", "Rendering a page", ["react", "nodejs"]);
const operations = article("automation", "Automating changes", ["kubernetes", "serverless"]);
const models = article("models", "Improving responses", ["llm", "security"]);
const legacy = article("legacy", "Tutorial for React and Kubernetes");
const items = [fullStack, operations, models, legacy];

describe("Personal News topics", () => {
  it("matches only the returned tags and lets an article appear under related groups", () => {
    expect(getPersonalReading(items, "group:frontend").items).toEqual([fullStack]);
    expect(getPersonalReading(items, "group:backend").items).toEqual([fullStack, operations]);
    expect(getPersonalReading(items, "group:devops").items).toEqual([operations]);
    expect(getPersonalReading(items, "group:ai").items).toEqual([models]);
    expect(getPersonalReading(items, "tag:security").items).toEqual([models]);
    expect(getPersonalReading(items, allPersonalTopics).tags).toEqual([
      "kubernetes", "llm", "nodejs", "react", "security", "serverless",
    ]);
  });

  it("keeps the full DEV reading visible when a saved snapshot has no tags", () => {
    const untagged = article("untagged", "An untagged article", []);
    expect(getPersonalReading([legacy, untagged], "group:frontend")).toMatchObject({
      items: [legacy, untagged],
      groups: [],
      tags: [],
      canFilterTopics: false,
      missingTags: true,
      noTopicMatches: false,
    });
    expect(getPersonalReading([], "group:frontend")).toMatchObject({
      items: [], missingTags: false, noTopicMatches: false,
    });
    const dailyArticle: PersonalArticle = { ...legacy, provider: "daily-dev" };
    expect(getPersonalReading([dailyArticle], allPersonalTopics)).toMatchObject({
      items: [dailyArticle], canFilterTopics: false, missingTags: false,
    });
  });

  it("offers matching groups and retains a selected topic that lost its matches", () => {
    const reading = getPersonalReading([operations], "tag:react");
    expect(reading).toMatchObject({
      items: [],
      tags: ["kubernetes", "react", "serverless"],
      canFilterTopics: true,
      missingTags: false,
      noTopicMatches: true,
    });
    expect(reading.groups.map(({ value }) => value)).toEqual(["group:backend", "group:devops"]);
    expect(getPersonalReading([operations], "group:frontend").groups.map(({ value }) => value))
      .toEqual(["group:frontend", "group:backend", "group:devops"]);
  });
});
