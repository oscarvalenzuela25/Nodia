import type { FC } from "react";
import ProviderConnectionForm from "../ProviderConnectionForm";
import type { AddProviderModalProps } from "./types";

const AddProviderModal: FC<AddProviderModalProps> = ({ open, onClose, onSuccess }) => open ? <ProviderConnectionForm onClose={onClose} onSuccess={onSuccess} /> : null;

export default AddProviderModal;
