import { Injectable } from '@nestjs/common';
import { canonicalModuleRoute, canonicalModuleRoutes, moduleRouteIncluded } from '../../authorization/canonical-module-route.js';
import type {
  NodiaAiToolFamily,
  NodiaAiToolModuleRegistration,
  NodiaAiToolResourceRegistration,
  NodiaAiToolRegistration,
} from '../types/tool-registry.types.js';

function invalid(): never {
  throw new Error('nodia_ai:tool_registry_invalid');
}
const sameRoutes = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length &&
  new Set(canonicalModuleRoutes(a)).size === a.length &&
  new Set(canonicalModuleRoutes(b)).size === b.length &&
  a.every((route) => moduleRouteIncluded(b, route));
type MutableFamily = {
  familyKey: string;
  modules: NodiaAiToolModuleRegistration[];
  resources: NodiaAiToolResourceRegistration[];
  capabilities: NodiaAiToolRegistration[];
};

/** Keeps one owner per resource while sharing canonical module metadata by route. It grants no authority. */
@Injectable()
export class ComposeNodiaAiPublishedFamiliesUseCase {
  execute(
    reads: readonly NodiaAiToolFamily[],
    writes: readonly NodiaAiToolFamily[],
  ): readonly NodiaAiToolFamily[] {
    // Preserve the historical published read surface exactly when no writers have been approved.
    if (!writes.some((family) => family.capabilities.length)) return reads;
    const families: MutableFamily[] = reads.map((family) => ({
      ...family,
      modules: [...family.modules],
      resources: [...family.resources],
      capabilities: [...family.capabilities],
    }));
    const familyKeys = new Set<string>();
    const modulesByRoute = new Map<string, NodiaAiToolModuleRegistration>();
    const modulesByKey = new Map<string, NodiaAiToolModuleRegistration>();
    const resources = new Map<
      string,
      { family: MutableFamily; resource: NodiaAiToolResourceRegistration }
    >();
    const capabilities = new Set<string>(),
      names = new Set<string>();
    for (const family of families) {
      if (familyKeys.has(family.familyKey)) invalid();
      familyKeys.add(family.familyKey);
      for (const module of family.modules) {
        const destination = canonicalModuleRoute(module.route);
        const byRoute = modulesByRoute.get(destination),
          byKey = modulesByKey.get(module.key);
        if (
          (byRoute &&
            (byRoute.key !== module.key || byRoute.label !== module.label)) ||
          (byKey &&
            (canonicalModuleRoute(byKey.route) !== destination || byKey.label !== module.label))
        )
          invalid();
        modulesByRoute.set(destination, module);
        modulesByKey.set(module.key, module);
      }
      for (const resource of family.resources) {
        if (resources.has(resource.key)) invalid();
        resources.set(resource.key, { family, resource });
      }
      for (const capability of family.capabilities) {
        if (
          capabilities.has(capability.capabilityId) ||
          names.has(capability.toolName)
        )
          invalid();
        capabilities.add(capability.capabilityId);
        names.add(capability.toolName);
      }
    }
    for (const source of writes) {
      const localModules = new Map<string, NodiaAiToolModuleRegistration>();
      const localResources = new Map<string, NodiaAiToolResourceRegistration>();
      for (const module of source.modules) {
        if (localModules.has(module.key)) invalid();
        const sameKey = modulesByKey.get(module.key),
          sameRoute = modulesByRoute.get(canonicalModuleRoute(module.route));
        if (sameKey && canonicalModuleRoute(sameKey.route) !== canonicalModuleRoute(module.route)) invalid();
        const canonical = sameRoute ?? module;
        localModules.set(module.key, canonical);
        modulesByRoute.set(canonicalModuleRoute(canonical.route), canonical);
        modulesByKey.set(canonical.key, canonical);
      }
      for (const resource of source.resources) {
        if (localResources.has(resource.key)) invalid();
        localResources.set(resource.key, resource);
      }
      let newFamily: MutableFamily | undefined;
      for (const capability of source.capabilities) {
        if (
          capabilities.has(capability.capabilityId) ||
          names.has(capability.toolName)
        )
          invalid();
        capabilities.add(capability.capabilityId);
        names.add(capability.toolName);
        const resource = localResources.get(capability.resourceKey),
          module = localModules.get(capability.moduleKey);
        if (
          !resource ||
          !module ||
          !moduleRouteIncluded(capability.requiredModuleRoutes, module.route) ||
          resource.requiredModuleRoutes.some(
            (route) => !moduleRouteIncluded(capability.requiredModuleRoutes, route),
          )
        )
          invalid();
        let target = resources.get(resource.key);
        if (target) {
          if (
            !sameRoutes(
              target.resource.requiredModuleRoutes,
              resource.requiredModuleRoutes,
            ) ||
            (resource.resolveCapabilityId !== undefined &&
              resource.resolveCapabilityId !==
                target.resource.resolveCapabilityId)
          )
            invalid();
        } else {
          if (!newFamily) {
            if (familyKeys.has(source.familyKey)) invalid();
            familyKeys.add(source.familyKey);
            newFamily = {
              familyKey: source.familyKey,
              modules: [],
              resources: [],
              capabilities: [],
            };
            families.push(newFamily);
          }
          newFamily.resources.push(resource);
          target = { family: newFamily, resource };
          resources.set(resource.key, target);
        }
        for (const route of new Set([
          ...resource.requiredModuleRoutes,
          ...capability.requiredModuleRoutes,
        ])) {
          const metadata = modulesByRoute.get(canonicalModuleRoute(route));
          if (
            !metadata ||
            ![...localModules.values()].some((item) => canonicalModuleRoute(item.route) === canonicalModuleRoute(route))
          )
            invalid();
          if (!target.family.modules.some((item) => item.key === metadata.key))
            target.family.modules.push(metadata);
        }
        target.family.capabilities.push(
          module.key === capability.moduleKey
            ? capability
            : { ...capability, moduleKey: module.key },
        );
      }
    }
    return Object.freeze(
      families.map((family) =>
        Object.freeze({
          ...family,
          modules: Object.freeze(family.modules),
          resources: Object.freeze(family.resources),
          capabilities: Object.freeze(family.capabilities),
        }),
      ),
    );
  }
}
