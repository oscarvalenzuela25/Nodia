import type { ActionFormData } from "../../types";

export type { ActionFormData };

export type ActionModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ActionFormData) => void;
  initialData?: ActionFormData | null;
  isSubmitting?: boolean;
};
