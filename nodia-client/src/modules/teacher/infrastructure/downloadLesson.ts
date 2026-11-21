import { mainInstance } from "../../../config/api";
import { apiPath } from "../../../config/apiPath";
import { preparePwaRegistration, waitForActivation } from "../../../pwa/pushRegistration";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import { OfflineStudyError, offlineStudyScope, saveOfflineStudy, type OfflineStudyMaterial } from "./offlineStudy";
import { offlineStudyGrantSnapshot } from "./offlineStudyIdentity";
import { materialSchema } from "./schemas";

export type DownloadLessonInput = {
  studyId: string;
  unitId: string;
  planRevisionId: string;
  contentVersionId: string;
  title: string;
  readingContext?: OfflineStudyMaterial["readingContext"];
};

// The worker owns public shell readiness. No private material is sent to it.
async function prepareReader(signal: AbortSignal): Promise<void> {
  const registration = await preparePwaRegistration();
  await waitForActivation(registration);
  signal.throwIfAborted();
  const worker = registration.active;
  if (!worker || worker.state !== "activated") throw new OfflineStudyError("unavailable");
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => finish(false), 15_000);
    function cancel() { finish(false); }
    function finish(ready: boolean) {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      channel.port1.close();
      if (ready && !signal.aborted && registration.active === worker) resolve();
      else reject(signal.reason ?? new OfflineStudyError("unavailable"));
    }
    signal.addEventListener("abort", cancel, { once: true });
    channel.port1.onmessage = ({ data }) => finish(data === true);
    try { worker.postMessage({ type: "nodia:teacher-offline-ready" }, [channel.port2]); }
    catch { finish(false); }
  });
}

export async function downloadLesson(input: DownloadLessonInput, signal: AbortSignal) {
  const auth = useAuthStore.getState();
  const scope = offlineStudyScope(auth.token, auth.user?.id);
  if (!scope || !hasActiveSession(auth)) throw new OfflineStudyError("stale");
  const initialGrant = offlineStudyGrantSnapshot().raw;
  const isCurrent = () => {
    const current = useAuthStore.getState();
    const match = offlineStudyScope(current.token, current.user?.id);
    return !signal.aborted && current.sessionVersion === auth.sessionVersion &&
      match?.ownerId === scope.ownerId && match.sessionId === scope.sessionId && hasActiveSession(current) &&
      offlineStudyGrantSnapshot().raw === initialGrant;
  };

  await prepareReader(signal);
  if (!isCurrent()) throw new OfflineStudyError("stale");
  const { data } = await mainInstance.get<unknown>(apiPath(`/teacher/sessions/${input.studyId}/units/${input.unitId}`), {
    signal,
    expectedAuthSessionVersion: auth.sessionVersion,
    params: { plan_revision_id: input.planRevisionId },
  });
  const parsed = materialSchema.safeParse(data);
  if (!parsed.success) throw new OfflineStudyError("invalid");
  const material = parsed.data;
  if (material.kind !== "material" || material.unit_id !== input.unitId ||
    material.plan_revision_id !== input.planRevisionId || material.content_version_id !== input.contentVersionId ||
    !material.allowed_actions.read_theory?.enabled) throw new OfflineStudyError("stale");
  // Store the reading blocks only, without prompts for interactive practice, actions or answers.
  return saveOfflineStudy(scope, {
    ...input,
    blocks: material.blocks.filter(({ kind }) => kind === undefined || ["explanation", "example", "summary"].includes(kind))
      .map(({ id, title, body_markdown }) => ({ id, title, body_markdown })),
  }, isCurrent, signal);
}
