import { Injectable } from '@nestjs/common';
import type { NodiaAiToolFamily } from '../../nodia-ai-tools/types/tool-registry.types.js';

/** Approval selects explicit exports; it cannot create a handler or widen a capability. */
@Injectable()
export class ComposeNodiaAiReadFamiliesUseCase {
  execute(
    candidates: readonly NodiaAiToolFamily[],
    ids: readonly string[],
  ): readonly NodiaAiToolFamily[] {
    const selected = new Set(ids);
    if (selected.size !== ids.length)
      throw new Error('nodia_ai:knowledge_release_invalid');
    const families = candidates.flatMap((family) => {
      const capabilities = family.capabilities.filter((tool) =>
        selected.has(tool.capabilityId),
      );
      if (capabilities.length === 0) return [];
      const resources = family.resources.filter((resource) =>
        capabilities.some((tool) => tool.resourceKey === resource.key),
      );
      return [
        {
          ...family,
          capabilities,
          resources,
          modules: family.modules.filter((module) =>
            capabilities.some((tool) =>
              tool.requiredModuleRoutes.includes(module.route),
            ),
          ),
        },
      ];
    });
    const actual = families.flatMap((family) =>
      family.capabilities.map((tool) => tool.capabilityId),
    );
    if (
      actual.length !== selected.size ||
      ids.some((id) => !actual.includes(id))
    )
      throw new Error('nodia_ai:knowledge_release_invalid');
    return Object.freeze(families);
  }
}
