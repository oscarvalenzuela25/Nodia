import type { ModuleFormData, ParentModuleOption, ModuleType } from "../../types";

export type { ModuleFormData, ParentModuleOption, ModuleType };

export type ModuleModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ModuleFormData) => void;
  initialData?: ModuleFormData | null;
  availableParents?: ParentModuleOption[];
};
