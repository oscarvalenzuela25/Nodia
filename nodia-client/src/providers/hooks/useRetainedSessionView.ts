import { useState } from "react";
import useAuth from "../../hooks/useAuth";

/** Retain only a view admitted in this actor's current session, never persisted credentials. */
export default function useRetainedSessionView() {
  const auth = useAuth();
  const actorScope = auth.user?.id ? `${auth.user.id}:${auth.sessionVersion}` : null;
  const validated = Boolean(actorScope && auth.isSessionValid);
  const [validatedActor, setValidatedActor] = useState(validated ? actorScope : null);

  // Adjust identity before rendering children so an actor replacement cannot expose the old view.
  if (validated && validatedActor !== actorScope) setValidatedActor(actorScope);
  else if (validatedActor !== null && (!auth.token || auth.isDemo || validatedActor !== actorScope)) setValidatedActor(null);

  return {
    ...auth,
    actorScope,
    canMount: validated || Boolean(auth.token && actorScope && validatedActor === actorScope && !auth.isDemo),
  };
}
