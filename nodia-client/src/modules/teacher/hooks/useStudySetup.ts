import { useEffect, useRef, useState, type BaseSyntheticEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type FieldErrors } from "react-hook-form";
import { useBlocker, useNavigate } from "react-router";
import { sessionFormDefaults, sessionPayload } from "../components/SessionForm/formValues";
import { NODIA_TEACHER_ROUTE } from "../constants/routes";
import { createSessionSchema, type CommandResult, type CreateSession, type Selection } from "../infrastructure/schemas";
import { useTeacherCommand } from "../infrastructure/useServices";

export const setupSteps = ["goal", "organization", "review"] as const;
const goalFields = ["title", "topic", "objective"] as const;
const organizationFields = ["explanation_language", "organization", "day_count", "declared_base", "context"] as const;

export function useStudySetup(language: string) {
  const navigate = useNavigate();
  const command = useTeacherCommand();
  const [step, setStep] = useState(0);
  const [visited, setVisited] = useState(0);
  const [contextOpen, setContextOpen] = useState(false);
  const [selectionState, setSelectionState] = useState<{ selection: Selection | null; ready: boolean }>({ selection: null, ready: false });
  const completed = useRef(false);
  const submitting = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const previousStep = useRef(step);
  const form = useForm<CreateSession>({
    // Hidden day counts are not sent when a different organization is chosen.
    resolver: (values, context, options) => zodResolver(createSessionSchema)({ ...values, day_count: values.organization === "days" ? values.day_count : null }, context, options),
    defaultValues: sessionFormDefaults(language),
  });
  const values = useWatch({ control: form.control }) as CreateSession;
  const busy = command.blocked || form.formState.isSubmitting;
  const hasUnsaved = form.formState.isDirty || command.isPending || Boolean(command.uncertain);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    !completed.current && Boolean(hasUnsaved) && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (completed.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);
  useEffect(() => {
    if (previousStep.current !== step) headingRef.current?.focus();
    previousStep.current = step;
  }, [step]);

  const focusField = (name: string) => requestAnimationFrame(() => {
    const field = formRef.current?.querySelector<HTMLElement>(`[name="${name}"], [data-setup-field="${name}"] [role="button"]`);
    (field ?? headingRef.current)?.focus();
  });
  const showErrors = (errors: FieldErrors<CreateSession>) => {
    const field = [...goalFields, ...organizationFields].find(name => errors[name]);
    if (!field) return;
    setStep(goalFields.some(name => name === field) ? 0 : 1);
    if (field === "context" || field === "declared_base") setContextOpen(true);
    focusField(field);
  };
  const goTo = async (target: number) => {
    if (busy || target < 0 || target > Math.min(visited + 1, 2)) return;
    if (target > step) {
      const fields = target === 1 ? [...goalFields] : [...goalFields, ...organizationFields];
      if (!await form.trigger(fields)) {
        const field = fields.find(name => form.getFieldState(name).invalid);
        if (field) showErrors({ [field]: form.getFieldState(field).error });
        return;
      }
    }
    setStep(target);
    setVisited(current => Math.max(current, target));
  };
  const openSession = (result: CommandResult) => {
    if (!result.session_id) return;
    completed.current = true;
    if (blocker.state === "blocked") blocker.proceed();
    else void navigate(`${NODIA_TEACHER_ROUTE}/${result.session_id}`);
  };
  const save = async (value: CreateSession, generate: boolean) => {
    if (command.blocked || submitting.current || completed.current || (generate && (!selectionState.ready || !selectionState.selection))) return;
    submitting.current = true;
    try {
      const result = await command.execute("sessions", {
        ...sessionPayload(value),
        ...(selectionState.selection ? { selection: selectionState.selection } : {}),
        start_plan: generate,
      });
      if (result) openSession(result);
    } finally { submitting.current = false; }
  };
  const saveDraft = (event?: BaseSyntheticEvent) => form.handleSubmit(value => save(value, false), showErrors)(event);
  const createProposal = (event?: BaseSyntheticEvent) => form.handleSubmit(value => save(value, true), showErrors)(event);
  const leaveWithoutSaving = () => {
    // Leaving never clears an uncertain request or claims cancellation of its job.
    if (command.isPending || blocker.state !== "blocked") return;
    completed.current = true;
    blocker.proceed();
  };
  return {
    form, values, formRef, headingRef, step, visited, goTo, contextOpen, setContextOpen,
    selectionState, setSelectionState, command, busy, openSession, saveDraft, createProposal,
    blocker, leaveWithoutSaving, canSaveDraft: !busy && createSessionSchema.safeParse(sessionPayload(values)).success,
  };
}
