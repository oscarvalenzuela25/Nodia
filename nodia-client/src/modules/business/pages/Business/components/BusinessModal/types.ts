import type { BusinessEntity, BusinessFormData } from "../../../../infrastructure/types";

export interface BusinessModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: BusinessFormData) => void;
  initialData?: BusinessEntity | null;
  isSubmitting?: boolean;
}
