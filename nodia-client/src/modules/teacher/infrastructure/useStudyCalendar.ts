import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { sileo } from "sileo";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import { notifyHttpError } from "../../../config/httpFeedback";
import i18n from "../../../translate";
import { useTeacherQuery } from "./useServices";
import {
  calendarCategoriesSchema, calendarDaySchema, calendarPlanSchema, calendarPlansSchema,
  type CalendarCategory, type DayUpdate,
} from "./studyCalendar";
import {
  createCalendarCategory, createStudyCalendar, updateCalendarCategory, updateStudyDay,
  type CalendarCategoryUpdate, type CalendarCreate,
} from "./studyCalendarServices";
import type { StudyCalendarImportPlan } from "./studyCalendarImport";

const planPath = (planId?: string) => "calendar/plans/" + planId;
const dayPath = (planId?: string, dayId?: string) => planPath(planId) + "/days/" + dayId;

export const useStudyCalendarPlans = (page: number, categoryId: string, enabled: boolean) =>
  useTeacherQuery("calendar/plans", calendarPlansSchema, { page, category_id: categoryId || undefined }, enabled);
export const useStudyCalendarPlan = (planId: string | undefined, enabled: boolean) =>
  useTeacherQuery(planPath(planId), calendarPlanSchema, undefined, Boolean(enabled && planId));
export const useStudyCalendarDay = (planId: string | undefined, dayId: string | undefined, enabled: boolean) =>
  useTeacherQuery(dayPath(planId, dayId), calendarDaySchema, undefined, Boolean(enabled && planId && dayId));
export const useStudyCalendarCategories = (enabled: boolean) => useTeacherQuery("calendar/categories", calendarCategoriesSchema, undefined, enabled);

type WriteIntent =
  | { kind: "create"; payload: CalendarCreate }
  | { kind: "day"; planId: string; dayId: string; update: DayUpdate }
  | { kind: "category-create"; payload: Pick<CalendarCategory, "name" | "color"> }
  | { kind: "category-update"; id: string; payload: CalendarCategoryUpdate };

async function writeCalendar(intent: WriteIntent) {
  switch (intent.kind) {
    case "create": return { kind: intent.kind, data: await createStudyCalendar(intent.payload) } as const;
    case "day": return { kind: intent.kind, data: await updateStudyDay(intent.planId, intent.dayId, intent.update) } as const;
    case "category-create": return { kind: intent.kind, data: await createCalendarCategory(intent.payload) } as const;
    case "category-update": return { kind: intent.kind, data: await updateCalendarCategory(intent.id, intent.payload) } as const;
  }
}

function uncertainCreateError(error: unknown) {
  return !isAxiosError(error) || !error.response || error.response.status === 408 || error.response.status >= 500;
}

export function useStudyCalendarWrites() {
  const cache = useQueryClient();
  const userId = useAuthStore(state => state.user?.id);
  const sessionVersion = useAuthStore(state => state.sessionVersion);
  const active = useAuthStore(hasActiveSession);
  const mutation = useMutation({ mutationFn: writeCalendar, retry: false });
  const inFlight = useRef(false);
  const pendingCreate = useRef<CalendarCreate>(null);
  const [uncertain, setUncertain] = useState(false);
  const writeOwner = ["teacher", userId, sessionVersion] as const;
  const currentActor = () => {
    const state = useAuthStore.getState();
    return state.user?.id === userId && state.sessionVersion === sessionVersion;
  };

  const write = async (intent: WriteIntent) => {
    if (inFlight.current || !currentActor() || !hasActiveSession(useAuthStore.getState())) return null;
    inFlight.current = true;
    try {
      const result = await mutation.mutateAsync(intent);
      if (!currentActor()) return null;
      if (result.kind === "create") {
        pendingCreate.current = null;
        setUncertain(false);
        cache.setQueryData([...writeOwner, planPath(result.data.id), undefined], result.data);
      }
      if (result.kind === "day" && intent.kind === "day") {
        cache.setQueryData([...writeOwner, dayPath(intent.planId, intent.dayId), undefined], result.data);
      }
      sileo.success({ title: i18n.t("teacher:calendar.saved") });
      void cache.invalidateQueries({ queryKey: [...writeOwner, "calendar/plans"] });
      if (intent.kind !== "day") void cache.invalidateQueries({ queryKey: [...writeOwner, "calendar/categories"] });
      if (intent.kind === "day") {
        void cache.invalidateQueries({ queryKey: [...writeOwner, planPath(intent.planId)] });
      }
      if (intent.kind === "category-update") {
        void cache.invalidateQueries({ queryKey: writeOwner, predicate: query => typeof query.queryKey[3] === "string" && /^calendar\/plans\/[^/]+$/.test(query.queryKey[3]) });
      }
      return result;
    } catch (error) {
      if (!currentActor()) return null;
      if (intent.kind === "create") {
        const unknown = uncertainCreateError(error);
        if (!unknown) pendingCreate.current = null;
        setUncertain(unknown);
      }
      notifyHttpError(error);
      throw error;
    } finally {
      inFlight.current = false;
    }
  };

  const create = async (plan: StudyCalendarImportPlan, newCategories: string[] = []) => {
    if (inFlight.current || !currentActor() || !hasActiveSession(useAuthStore.getState())) return null;
    const payload = { plan, new_categories: newCategories };
    const existing = pendingCreate.current;
    if (existing && JSON.stringify({ plan: existing.plan, new_categories: existing.new_categories }) !== JSON.stringify(payload)) {
      sileo.error({ title: i18n.t("teacher:calendar.uncertain") });
      return null;
    }
    const request = existing ?? { ...structuredClone(payload), request_key: crypto.randomUUID() };
    pendingCreate.current = request;
    const result = await write({ kind: "create", payload: request });
    return result?.kind === "create" ? result.data : null;
  };

  return {
    busy: mutation.isPending || !active,
    uncertain,
    create,
    retryCreate: async () => {
      const request = pendingCreate.current;
      if (!request) return null;
      const result = await write({ kind: "create", payload: request });
      return result?.kind === "create" ? result.data : null;
    },
    updateDay: async (planId: string, dayId: string, update: DayUpdate) => {
      const result = await write({ kind: "day", planId, dayId, update });
      return result?.kind === "day" ? result.data : null;
    },
    saveCategory: async (name: string, color: CalendarCategory["color"], id?: string) => Boolean(await write(id
      ? { kind: "category-update", id, payload: { name, color } }
      : { kind: "category-create", payload: { name, color } })),
    setCategoryActive: async (id: string, categoryActive: boolean) => Boolean(await write({ kind: "category-update", id, payload: { active: categoryActive } })),
  };
}
