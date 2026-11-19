import type { PersonalArticle } from "./types";

export const allPersonalTopics = "all";

export const personalTopicGroups = [
  {
    value: "group:frontend",
    label: "news:personal_topic_frontend",
    tags: new Set([
      "frontend", "webdev", "html", "css", "javascript", "typescript",
      "react", "vue", "angular", "svelte", "nextjs", "accessibility",
    ]),
  },
  {
    value: "group:backend",
    label: "news:personal_topic_backend",
    tags: new Set([
      "backend", "api", "graphql", "database", "sql", "postgres", "postgresql",
      "nodejs", "django", "rails", "springboot", "microservices", "serverless",
    ]),
  },
  {
    value: "group:devops",
    label: "news:personal_topic_devops",
    tags: new Set([
      "devops", "docker", "kubernetes", "k8s", "terraform", "aws",
      "azure", "gcp", "cicd", "githubactions", "sre", "serverless",
    ]),
  },
  {
    value: "group:ai",
    label: "news:topic_ai",
    tags: new Set(["ai", "machinelearning", "deeplearning", "generativeai", "llm", "openai", "chatgpt", "claude", "gemini", "rag"]),
  },
] as const;

type PersonalTagTopic = `tag:${string}`;
export type PersonalTopic = typeof allPersonalTopics | typeof personalTopicGroups[number]["value"] | PersonalTagTopic;

export function getPersonalReading(sourceItems: PersonalArticle[], topic: PersonalTopic) {
  const selectedTag = topic.startsWith("tag:") ? topic.slice(4) : undefined;
  const groupTags = personalTopicGroups.find(({ value }) => value === topic)?.tags;
  const rawTags = new Set(sourceItems.flatMap(({ tags }) => tags ?? []));
  const canFilterTopics = rawTags.size > 0;
  const availableTags = [...rawTags];
  const groups = canFilterTopics ? personalTopicGroups.filter(({ value, tags }) =>
    value === topic || availableTags.some((tag) => tags.has(tag)),
  ) : [];
  if (canFilterTopics && selectedTag) rawTags.add(selectedTag);

  const items = !canFilterTopics || topic === allPersonalTopics ? sourceItems : sourceItems.filter(({ tags }) =>
    tags?.some((tag) => tag === selectedTag || groupTags?.has(tag)),
  );

  return {
    items,
    canFilterTopics,
    groups,
    tags: [...rawTags].sort((a, b) => a.localeCompare(b)),
    missingTags: !canFilterTopics && sourceItems.some(({ provider }) => provider === "dev-community"),
    noTopicMatches: sourceItems.length > 0 && items.length === 0,
  };
}
