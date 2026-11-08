import { describe, expect, it } from 'vitest';
import { canonicalModuleRoute, compatibleModuleRoutes, contractModuleRoute, moduleRouteIncluded } from './canonical-module-route.js';
import { canReadNodiaAiManifest } from '../nodia-ai-conversation/use-case/list-nodia-ai-messages.use-case.js';
import { isNodiaAiScopeVisible } from '../nodia-ai-context/use-case/build-nodia-ai-context.use-case.js';

describe('canonical navigation identity and historical scopes', () => {
  it('normalizes only enumerated resource aliases without deriving permissions from groups or prefixes', () => {
    expect(canonicalModuleRoute('/general-settings/users')).toBe('/users');
    expect(canonicalModuleRoute('/tools/business')).toBe('/business');
    expect(canonicalModuleRoute('/tools/unknown')).toBe('/tools/unknown');
    expect(moduleRouteIncluded(['/business'], '/tools/business')).toBe(true);
    expect(moduleRouteIncluded(['/business'], '/tools/business/42')).toBe(false);
    expect(moduleRouteIncluded(['/business'], '/users')).toBe(false);
    expect(moduleRouteIncluded([], '/tools/business')).toBe(false);
  });
  it('projects SQL aliases under the same current resource grant and keeps wire v1 identities stable', () => {
    expect(compatibleModuleRoutes(['/users'])).toEqual(['/users', '/settings/users', '/general-settings/users']);
    expect(compatibleModuleRoutes(['/business'])).not.toContain('/tools/reservations');
    expect(contractModuleRoute('/business')).toBe('/tools/business');
    expect(contractModuleRoute('/users')).toBe('/settings/users');
    expect(contractModuleRoute('/nodia-teacher')).toBe('/nodia-teacher');
  });
  it('reads historical manifests without rewriting signed bytes and redacts them after revocation', () => {
    const original = Object.freeze({ schema_version: 1, module_routes: Object.freeze(['/tools/business']) });
    const before = JSON.stringify(original);
    expect(canReadNodiaAiManifest(original, ['/business'])).toBe(true);
    expect(isNodiaAiScopeVisible(original, new Set(['/business']))).toBe(true);
    expect(canReadNodiaAiManifest(original, ['/users'])).toBe(false);
    expect(isNodiaAiScopeVisible(original, new Set())).toBe(false);
    expect(JSON.stringify(original)).toBe(before);
  });
});
