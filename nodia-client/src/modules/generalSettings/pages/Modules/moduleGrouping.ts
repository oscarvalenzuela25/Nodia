import type { ModuleEntity } from "./types";

export function startsModuleGroup(current: ModuleEntity, previous?: ModuleEntity): boolean {
  if (!previous) return true;
  const currentId = current.module_group_id ?? current.module_group?.id;
  const previousId = previous.module_group_id ?? previous.module_group?.id;
  return currentId === undefined || previousId === undefined || currentId !== previousId;
}
