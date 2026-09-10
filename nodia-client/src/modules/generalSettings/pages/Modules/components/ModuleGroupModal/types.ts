import type { ModuleGroupFormData } from "../../types";

export type { ModuleGroupFormData };

export type ModuleGroupModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ModuleGroupFormData) => void;
  initialData?: ModuleGroupFormData | null;
  isSubmitting?: boolean;
};
