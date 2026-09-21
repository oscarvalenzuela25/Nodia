import type { FC, FormEvent, ChangeEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@mui/material";
import BaseModal from "../../../../../../components/BaseModal";
import TextInput from "../../../../../../components/inputs/TextInput";
import TranslationInput from "../../../../../../components/inputs/TranslationInput";
import type { BusinessModalProps } from "./types";
import type { BusinessFormData } from "../../../../infrastructure/types";
import {
  FormContainer,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  ModalActionsContainer,
} from "./styles";

const BusinessModalInner: FC<BusinessModalProps> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  isSubmitting = false,
}) => {
  const { t } = useTranslation(["business", "core"]);
  const isEditing = Boolean(initialData?.id);

  const [name, setName] = useState<string>(initialData?.name ?? "");
  const [isActive, setIsActive] = useState<boolean>(initialData?.is_active ?? true);
  const [descriptionTranslations, setDescriptionTranslations] = useState<
    Record<string, string>
  >(() => {
    const descItem = initialData?.translates?.find(
      (tr) => tr.key === "description" || tr.key === "comment"
    );
    return {
      es: descItem?.es ?? "",
      en: descItem?.en ?? "",
    };
  });

  const isFormValid = name.trim().length >= 2;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    const translates = [
      {
        key: "description",
        es: descriptionTranslations.es?.trim() ?? "",
        en: descriptionTranslations.en?.trim() ?? "",
      },
    ];

    const payload: BusinessFormData = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      name: name.trim(),
      is_active: isActive,
      translates,
    };

    onSubmit(payload);
  };

  const modalTitle = isEditing
    ? t("business:edit_business")
    : t("business:new_business");

  const modalActions = (
    <ModalActionsContainer>
      <Button
        variant="contained"
        color="error"
        onClick={onClose}
        disabled={isSubmitting}
        sx={{ borderRadius: 2, px: 2.5 }}
      >
        {t("business:cancel")}
      </Button>
      <Button
        type="submit"
        form="business-form"
        variant="contained"
        color="primary"
        disabled={!isFormValid || isSubmitting}
        sx={{ borderRadius: 2, px: 2.5 }}
      >
        {t("business:save")}
      </Button>
    </ModalActionsContainer>
  );

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={modalTitle}
      subtitle={t("business:subtitle")}
      actions={modalActions}
    >
      <FormContainer id="business-form" onSubmit={handleSubmit}>
        <SwitchWrapper>
          <StyledFormControlLabel
            control={
              <StyledSwitch
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isSubmitting}
              />
            }
            label={t("business:active_label")}
            labelPlacement="start"
          />
        </SwitchWrapper>

        <TextInput
          id="business-name"
          name="name"
          label={t("business:name_label")}
          placeholder={t("business:name_placeholder")}
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          required
          autoFocus
          disabled={isSubmitting}
        />

        <TranslationInput
          id="business-description"
          name="description"
          label={t("business:description_label")}
          placeholder={t("business:description_placeholder")}
          value={descriptionTranslations.es || descriptionTranslations.en || ""}
          onChangeKey={(val: string) =>
            setDescriptionTranslations((prev) => ({ ...prev, es: val }))
          }
          translations={descriptionTranslations}
          onChangeTranslations={setDescriptionTranslations}
          sectionTitle={t("business:description_label")}
          sectionSubtitle={t("business:description_placeholder")}
          disabled={isSubmitting}
        />
      </FormContainer>
    </BaseModal>
  );
};

const BusinessModal: FC<BusinessModalProps> = (props) => {
  const { open, initialData } = props;
  if (!open) return null;

  return (
    <BusinessModalInner
      key={initialData?.id ?? "create-new-business"}
      {...props}
    />
  );
};

export default BusinessModal;
