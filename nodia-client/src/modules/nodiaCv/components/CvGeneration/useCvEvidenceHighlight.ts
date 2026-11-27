import { useState, type RefObject } from "react";
import type { CvRequirement } from "../../infrastructure/generationSchema";

type Interaction = {
  draftId: string | null;
  hovered: string | null;
  focused: string | null;
  pinned: string | null;
};
const emptyInteraction: Interaction = { draftId: null, hovered: null, focused: null, pinned: null };

export function useCvEvidenceHighlight(draftId: string | null, previewRef: RefObject<HTMLDivElement | null>, requirements: readonly CvRequirement[] = []) {
  const [interaction, setInteraction] = useState(emptyInteraction);
  if (draftId !== interaction.draftId) setInteraction({ ...emptyInteraction, draftId });

  const activeId = interaction.hovered ?? interaction.focused ?? interaction.pinned;
  const activeRequirement = requirements.find(({ id }) => id === activeId) ?? null;
  const pinnedRequirement = requirements.find(({ id }) => id === interaction.pinned) ?? null;
  const onPin = (requirementId: string) => {
    const pinned = interaction.pinned === requirementId ? null : requirementId;
    setInteraction({ ...emptyInteraction, draftId, pinned });
    if (!pinned) return;
    requestAnimationFrame(() => {
      const region = previewRef.current;
      if (!region || region.dataset.cvPreviewDraft !== draftId || region.dataset.cvScrollRequirement !== pinned) return;
      const anchor = region.querySelector("[data-cv-evidence-highlighted]") ?? region;
      anchor.scrollIntoView?.({ block: "nearest" });
    });
  };

  return {
    activeRequirement,
    pinnedRequirement,
    scrollRequirementId: activeRequirement?.id === pinnedRequirement?.id ? activeRequirement?.id : undefined,
    clear: () => setInteraction({ ...emptyInteraction, draftId }),
    target: {
      activeId,
      pinnedId: interaction.pinned,
      onHover: (hovered: string | null) => setInteraction((previous) => ({ ...previous, hovered })),
      onFocus: (focused: string | null) => setInteraction((previous) => ({ ...previous, focused })),
      onPin,
    },
  };
}
