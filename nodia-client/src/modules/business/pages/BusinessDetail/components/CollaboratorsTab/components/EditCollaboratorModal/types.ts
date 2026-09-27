import type { BusinessCollaborator } from "../../../../../../infrastructure/types";

export interface EditCollaboratorModalProps {
  open: boolean;
  onClose: () => void;
  businessId: string;
  collaborator: BusinessCollaborator | null;
}
