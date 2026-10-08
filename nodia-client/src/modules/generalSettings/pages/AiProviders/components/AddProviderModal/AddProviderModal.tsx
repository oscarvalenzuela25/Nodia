import type { FC } from "react";
import ProviderConnectionForm from "../ProviderConnectionForm";
import type { AddProviderModalProps } from "./types";

const AddProviderModal: FC<AddProviderModalProps> = ({ open, totalProviders, onClose, onSuccess }) => open ? <ProviderConnectionForm totalProviders={totalProviders} onClose={onClose} onSuccess={onSuccess} /> : null;

export default AddProviderModal;
