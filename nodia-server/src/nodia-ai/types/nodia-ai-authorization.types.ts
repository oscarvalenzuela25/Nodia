/** Internal identity only: HTTP derives it from request.auth; workers from a validated grant. */
export interface NodiaAiActorReference {
  userId: string;
  sessionId: string;
}

export interface NodiaAiModuleAccess {
  id: string;
  key: string;
  route: string;
  assigned: boolean;
}

export interface NodiaAiAuthorizationSnapshot {
  actorId: string;
  sessionId: string;
  isSuperAdmin: boolean;
  modules: NodiaAiModuleAccess[];
  actionKeys: string[];
}

/** Requirements come from backend registrations, never from model arguments or public DTOs. */
export interface NodiaAiAccessRequirements {
  moduleRoutes?: readonly string[];
  actionKeys?: readonly string[];
}

/** A point-in-time decision, not a durable grant or permission cache. */
export interface NodiaAiAuthorizedActor {
  actorId: string;
  sessionId: string;
  isSuperAdmin: boolean;
  modules: ReadonlyArray<{ id: string; key: string; route: string }>;
}
