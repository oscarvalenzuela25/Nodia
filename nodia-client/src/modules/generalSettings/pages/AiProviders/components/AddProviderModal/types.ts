export interface AddProviderModalProps {
  open: boolean;
  totalProviders?: number;
  onClose: () => void;
  onSuccess?: () => void;
}
