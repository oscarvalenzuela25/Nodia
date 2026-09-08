import type { ModuleFormData } from "../../types";

export type { ModuleFormData };

export type ModuleModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ModuleFormData) => void;
  initialData?: ModuleFormData | null;
  isSubmitting?: boolean;
};
