import type { BusinessActionFormData } from "../../types";

export type { BusinessActionFormData };

export type BusinessActionModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: BusinessActionFormData) => void;
  initialData?: BusinessActionFormData | null;
  isSubmitting?: boolean;
};
