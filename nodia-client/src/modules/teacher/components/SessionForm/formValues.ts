import type { CreateSession, Session } from "../../infrastructure/schemas";

export function sessionFormDefaults(language: string, initial?: Session): CreateSession {
  return initial ? {
    topic: initial.topic, objective: initial.objective, title: initial.title ?? "", context: initial.context,
    declared_base: initial.declared_base, explanation_language: initial.explanation_language,
    organization: initial.requested_organization, day_count: initial.requested_day_count,
  } : {
    topic: "", objective: "", title: "", context: null, declared_base: null,
    explanation_language: language, organization: "teacher_suggests", day_count: null,
  };
}

export function sessionPayload(value: CreateSession) {
  return {
    ...value,
    title: value.title?.trim() || undefined,
    context: value.context || null,
    declared_base: value.declared_base || null,
    day_count: value.organization === "days" ? value.day_count : null,
  };
}
