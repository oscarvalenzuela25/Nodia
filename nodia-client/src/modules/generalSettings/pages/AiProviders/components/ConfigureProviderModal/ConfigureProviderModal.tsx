import type { FC } from "react";
import ProviderConnectionForm from "../ProviderConnectionForm";
import type { ConfigureProviderModalProps } from "./types";

const ConfigureProviderModal: FC<ConfigureProviderModalProps> = ({ open, provider, totalProviders, onClose, onSuccess }) => open && provider ? <ProviderConnectionForm key={provider.id} provider={provider} totalProviders={totalProviders} onClose={onClose} onSuccess={onSuccess} /> : null;

export default ConfigureProviderModal;
