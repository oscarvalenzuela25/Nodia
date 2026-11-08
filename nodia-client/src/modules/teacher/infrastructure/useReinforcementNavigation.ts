import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import useAuthStore from "../../../store/authStore";
import { notifyHttpError } from "../../../config/httpFeedback";
import { readTeacherData } from "./services";
import { materialSchema, type CommandResult, type Cursor, type Material, type Reinforcement } from "./schemas";

type Destination = { projection: Reinforcement; currentPlanId: string | null; unitId: string; cursor: Cursor };
type Ports = { read: () => Promise<Material>; save: (cursor: Cursor) => Promise<CommandResult | null>; current: () => boolean };

/** The unit is authoritative; lookup and confirmed cursor precede presentation changes. */
export async function openReinforcementUnit(input: Destination, ports: Ports): Promise<Cursor | null> {
  const { projection, unitId } = input;
  if (projection.navigation !== "current_plan" || projection.plan_revision_id !== input.currentPlanId ||
    !projection.objectives.some(objective => objective.units.some(unit => unit.unit_id === unitId))) return null;
  const material = await ports.read();
  if (!ports.current()) return null;
  if (material.kind === "material" && (material.unit_id !== unitId || material.plan_revision_id !== projection.plan_revision_id)) return null;
  const cursor: Cursor = { ...input.cursor, phase: material.kind === "material" ? "theory" : "setup",
    plan_revision_id: projection.plan_revision_id, section_id: projection.section_id, unit_id: unitId,
    content_version_id: material.kind === "material" ? material.content_version_id : null,
    block_id: material.kind === "material" ? material.blocks[0]?.id ?? null : null, attempt_id: null, item_id: null };
  const saved = await ports.save(cursor);
  return saved && ports.current() ? cursor : null;
}

export function useReinforcementNavigation(sessionId: string, contextKey: string) {
  const client = useQueryClient();
  const userId = useAuthStore(state => state.user?.id);
  const sessionVersion = useAuthStore(state => state.sessionVersion);
  const actor = `${userId}:${sessionVersion}`;
  const context = `${actor}:${sessionId}:${contextKey}`;
  const currentContext = useRef(context);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  useLayoutEffect(() => { currentContext.current = context; }, [context]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const run = async (operation: (current: Ports["current"]) => Promise<Cursor | null>) => {
    if (inFlight.current) return null;
    const current = () => {
      const state = useAuthStore.getState();
      return mounted.current && currentContext.current === context && `${state.user?.id}:${state.sessionVersion}` === actor && state.sessionStatus === "authenticated";
    };
    if (!current()) return null;
    inFlight.current = true; setPending(true); setFailed(false);
    try {
      const result = await operation(current);
      if (current() && !result) setFailed(true);
      return result;
    } catch (error) {
      if (current()) { setFailed(true); notifyHttpError(error); }
      return null;
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
  };
  const open = (input: Destination, save: Ports["save"]) => run(current => openReinforcementUnit(input, { current, save, read: async () => {
    const path = `sessions/${sessionId}/units/${input.unitId}`;
    const params = { plan_revision_id: input.projection.plan_revision_id };
    const data = await client.fetchQuery({ queryKey: ["teacher", userId, sessionVersion, path, params],
      queryFn: ({ signal }) => readTeacherData(path, signal, params), staleTime: 0, retry: false });
    return materialSchema.parse(data);
  } }));
  const choose = (cursor: Cursor, save: Ports["save"]) => run(async current => {
    const result = await save(cursor);
    return result && current() ? cursor : null;
  });
  return { open, choose, pending, failed };
}
