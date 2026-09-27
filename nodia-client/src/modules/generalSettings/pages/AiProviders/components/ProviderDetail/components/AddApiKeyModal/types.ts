export interface AddApiKeyModalProps {
  open: boolean;
  providerId: string;
  providerName: string;
  onClose: () => void;
  onSuccess?: () => void;
}
