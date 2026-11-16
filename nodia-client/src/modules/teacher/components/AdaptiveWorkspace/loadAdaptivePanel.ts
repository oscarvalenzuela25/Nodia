const loaders = {
  sources: () => import("./SourcesPanel"),
  evidence: () => import("./LearningPanel"),
  review: () => import("./ReviewPanel"),
  activities: () => import("./ActivitiesPanel"),
  concepts: () => import("./ConceptsPanel"),
  clarifications: () => import("./ClarificationPanel"),
} as const;

export type AdaptivePanelKey = keyof typeof loaders;
export const adaptivePanelKeys = Object.keys(loaders) as AdaptivePanelKey[];
export const loadAdaptivePanel = async (key: AdaptivePanelKey) => (await loaders[key]()).default;
