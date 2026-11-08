import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { canonicalModuleRoute } from '../../authorization/canonical-module-route.js';
import { NodiaAiAuthorizationService } from '../nodia-ai-authorization.service.js';
import {
  NODIA_AI_MODULE_KEY,
  NODIA_AI_MODULE_ROUTE,
} from '../nodia-ai.constants.js';
import type {
  NodiaAiAccessRequirements,
  NodiaAiActorReference,
  NodiaAiAuthorizedActor,
  NodiaAiAuthorizationSnapshot,
} from '../types/nodia-ai-authorization.types.js';

const idPattern = /^[1-9][0-9]{0,18}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AuthorizeNodiaAiUseCase {
  constructor(private readonly authorization: NodiaAiAuthorizationService) {}

  async execute(
    identity: NodiaAiActorReference,
    requirements: NodiaAiAccessRequirements = {},
    manager?: EntityManager,
  ): Promise<NodiaAiAuthorizedActor> {
    if (
      !identity ||
      !idPattern.test(identity.userId) ||
      BigInt(identity.userId) > 9223372036854775807n ||
      !uuidPattern.test(identity.sessionId)
    ) {
      throw new UnauthorizedException('auth:session_expired');
    }
    const current = await this.authorization.loadCurrentActor(
      identity,
      manager,
    );
    return this.authorizeSnapshot(identity, current, requirements);
  }
  /** One current authority read for a bounded catalog page; never exposes role/action details. */
  async filterAuthorized(
    identity: NodiaAiActorReference,
    requirements: readonly NodiaAiAccessRequirements[],
    manager?: EntityManager,
  ): Promise<{ actor: NodiaAiAuthorizedActor; allowed: readonly boolean[] }> {
    if (!Array.isArray(requirements) || requirements.length > 2048)
      throw new ForbiddenException('nodia_ai:capability_denied');
    if (
      !identity ||
      !idPattern.test(identity.userId) ||
      BigInt(identity.userId) > 9223372036854775807n ||
      !uuidPattern.test(identity.sessionId)
    ) throw new UnauthorizedException('auth:session_expired');
    const current = await this.authorization.loadCurrentActor(identity, manager);
    const actor = this.authorizeSnapshot(identity, current, {});
    const allowed = requirements.map((requirement) => {
      try {
        this.authorizeSnapshot(identity, current, requirement);
        return true;
      } catch (error) {
        if (error instanceof ForbiddenException) return false;
        throw error;
      }
    });
    return { actor, allowed: Object.freeze(allowed) };
  }
  private authorizeSnapshot(
    identity: NodiaAiActorReference,
    current: NodiaAiAuthorizationSnapshot | null,
    requirements: NodiaAiAccessRequirements,
  ): NodiaAiAuthorizedActor {
    if (
      !current ||
      current.actorId !== identity.userId ||
      current.sessionId.toLowerCase() !== identity.sessionId.toLowerCase()
    ) {
      throw new UnauthorizedException('auth:session_expired');
    }
    const denied = () => new ForbiddenException('nodia_ai:capability_denied');
    const routes = requirements.moduleRoutes ?? [];
    const actions = requirements.actionKeys ?? [];
    // These are backend registrations, not an unrestricted routes/permissions API.
    if (
      routes.length > 64 ||
      actions.length > 64 ||
      routes.some(
        (route) =>
          typeof route !== 'string' ||
          !route.startsWith('/') ||
          route.length > 255,
      ) ||
      actions.some(
        (key) =>
          typeof key !== 'string' || key.length === 0 || key.length > 255,
      )
    )
      throw denied();
    const modules = current.modules.map(module => ({ ...module, route: canonicalModuleRoute(module.route) }));
    const byRoute = new Map<string, typeof current.modules>();
    for (const module of modules) {
      const matching = byRoute.get(module.route) ?? [];
      matching.push(module);
      byRoute.set(module.route, matching);
    }
    const nodia = byRoute.get(NODIA_AI_MODULE_ROUTE);
    if (
      nodia?.length !== 1 ||
      nodia[0].key !== NODIA_AI_MODULE_KEY ||
      (!current.isSuperAdmin && !nodia[0].assigned)
    )
      throw denied();
    for (const route of new Set(routes.map(canonicalModuleRoute))) {
      const matching = byRoute.get(route);
      if (
        matching?.length !== 1 ||
        (!current.isSuperAdmin && !matching[0].assigned)
      )
        throw denied();
    }
    // Role actions remain registration metadata; current product access is module-based.
    return Object.freeze({
      actorId: current.actorId,
      sessionId: current.sessionId,
      isSuperAdmin: current.isSuperAdmin,
      // Discovery/context consumers get only unambiguous, currently permitted destinations.
      modules: Object.freeze(modules
        .filter(
          (module) =>
            byRoute.get(module.route)?.length === 1 &&
            (current.isSuperAdmin || module.assigned),
        )
        .map(({ id, key, route }) => Object.freeze({ id, key, route }))),
    });
  }
}
