import type { BusinessCollaborator } from "../../../../infrastructure/types";

export interface BusinessCollaboratorModalProps {
  open: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
  initialCollaborators?: BusinessCollaborator[];
}

export interface CollaboratorRowState {
  tempId: string;
  user_id: string;
  position: string;
  action_ids: string[];
}
