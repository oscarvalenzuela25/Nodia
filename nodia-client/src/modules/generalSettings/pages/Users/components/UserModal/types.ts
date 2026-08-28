export type UserFormData = {
  id?: string;
  name?: string | null;
  email: string;
  roles: string[];
  isActive: boolean;
  imageUrl?: string | null;
};

export type UserModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: UserFormData) => void;
  initialData?: UserFormData | null;
  availableRoles?: string[];
};
