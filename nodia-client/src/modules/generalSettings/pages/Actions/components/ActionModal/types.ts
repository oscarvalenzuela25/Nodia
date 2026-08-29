import type { ActionFormData, ModuleOption } from "../../types";

export type { ActionFormData, ModuleOption };

export type ActionModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ActionFormData) => void;
  initialData?: ActionFormData | null;
  availableModules?: ModuleOption[];
};
