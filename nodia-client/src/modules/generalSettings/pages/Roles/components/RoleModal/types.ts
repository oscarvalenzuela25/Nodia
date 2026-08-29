import type { RoleFormData, ActionOption } from "../../types";

export type { RoleFormData, ActionOption };

export type RoleModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: RoleFormData) => void;
  initialData?: RoleFormData | null;
  availableActions?: ActionOption[];
};
