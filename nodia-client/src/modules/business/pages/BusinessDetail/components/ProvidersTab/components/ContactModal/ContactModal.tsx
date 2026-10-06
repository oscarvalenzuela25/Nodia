import { useId, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { isAxiosError } from "axios";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  IconButton,
  Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import { getCountries, getCountryCallingCode } from "libphonenumber-js/max";
import BaseModal from "../../../../../../../../components/BaseModal";
import TextInput from "../../../../../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../../../../../components/inputs/SelectSingleInput";
import {
  CONTACT_DAYS,
  type ContactValues,
  type ProviderContact,
} from "../ProviderContacts/types";
import {
  contactFormSchema,
  contactPayload,
  defaultContactForm,
  normalizedPhone,
  type ContactForm,
} from "./schema";
import {
  ContactActions,
  ContactFormContainer,
  DayRow,
  PhoneRow,
  StyledFormControlLabel,
  StyledSwitch,
  SwitchWrapper,
} from "./styles";

type Props = {
  providerName: string;
  contact?: ProviderContact;
  busy: boolean;
  onClose: () => void;
  onSave: (values: ContactValues, requestKey: string) => Promise<unknown>;
};
export default function ContactModal({
  providerName,
  contact,
  busy,
  onClose,
  onSave,
}: Props) {
  const { t, i18n } = useTranslation(["provider_contacts", "core"]);
  const formId = useId();
  const [expanded, setExpanded] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [conflict, setConflict] = useState(false);
  const request = useRef<{ key: string; values: ContactValues } | null>(null);
  const submitting = useRef(false);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactForm>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: defaultContactForm(contact),
  });
  const { fields, append, remove } = useFieldArray({ control, name: "phone" });
  const phones = useWatch({ control, name: "phone" });
  const locked = busy || isSubmitting;
  const disabled = locked || uncertain;
  const canAdd =
    fields.length < 10 &&
    phones.every(
      (phone) =>
        phone.number.trim() && normalizedPhone(phone.country, phone.number),
    );
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([i18n.language], { type: "region" });
    return getCountries()
      .map((country) => ({
        value: country,
        label: `${names.of(country)} (+${getCountryCallingCode(country)})`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, i18n.language));
  }, [i18n.language]);
  async function save(form: ContactForm) {
    if (submitting.current || busy) return;
    submitting.current = true;
    setConflict(false);
    if (!request.current || !uncertain)
      request.current = {
        key: request.current?.key ?? crypto.randomUUID(),
        values: contactPayload(form),
      };
    try {
      await onSave(request.current.values, request.current.key);
      onClose();
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const definiteRejection =
        status !== undefined && status >= 400 && status < 500 && status !== 408;
      setUncertain(!definiteRejection);
      setConflict(status === 409);
      if (definiteRejection) request.current = null;
    } finally {
      submitting.current = false;
    }
  }
  const errorText = (message?: string) => (message ? t(message) : undefined);
  return (
    <BaseModal
      open
      onClose={() => {
        if (!locked) onClose();
      }}
      showCloseButton={!locked}
      disableEscapeKeyDown={locked}
      title={t(contact ? "provider_contacts:edit" : "provider_contacts:new")}
      subtitle={providerName}
      size="lg"
      actions={
        <ContactActions>
          <Button color="error" disabled={locked} onClick={onClose}>
            {t("core:cancel")}
          </Button>
          <Button
            variant="contained"
            type="submit"
            form={formId}
            disabled={locked || conflict}
          >
            {t(uncertain ? "provider_contacts:recover" : "core:save")}
          </Button>
        </ContactActions>
      }
    >
      {uncertain && (
        <Alert severity="warning">{t("provider_contacts:uncertain")}</Alert>
      )}
      {conflict && (
        <Alert severity="error">{t("provider_contacts:conflict")}</Alert>
      )}
      <ContactFormContainer
        id={formId}
        noValidate
        onSubmit={(event) =>
          void handleSubmit(save, (invalid) => {
            if (invalid.schedule) setExpanded(true);
          })(event)
        }
      >
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextInput
              {...field}
              id={`${formId}-name`}
              label={t("provider_contacts:name")}
              required
              autoFocus
              disabled={disabled}
              error={!!errors.name}
              helperText={errorText(errors.name?.message)}
            />
          )}
        />
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t("provider_contacts:phones")}
          </Typography>
          {fields.map((phone, index) => (
            <PhoneRow key={phone.id}>
              <Controller
                name={`phone.${index}.country`}
                control={control}
                render={({ field }) => (
                  <SelectSingleInput
                    id={`${formId}-country-${index}`}
                    label={t("provider_contacts:country")}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "CL")}
                    options={countries}
                    clearable={false}
                    disabled={disabled}
                  />
                )}
              />
              <Controller
                name={`phone.${index}.number`}
                control={control}
                render={({ field }) => (
                  <TextInput
                    {...field}
                    id={`${formId}-phone-${index}`}
                    type="tel"
                    label={t("provider_contacts:phone_number", {
                      number: index + 1,
                    })}
                    disabled={disabled}
                    error={!!errors.phone?.[index]?.number}
                    helperText={errorText(
                      errors.phone?.[index]?.number?.message,
                    )}
                  />
                )}
              />
              <IconButton
                sx={{ mt: 3.5 }}
                disabled={disabled}
                aria-label={t("provider_contacts:remove_phone", {
                  number: index + 1,
                })}
                onClick={() => remove(index)}
              >
                <DeleteOutlinedIcon />
              </IconButton>
            </PhoneRow>
          ))}
          <Button
            startIcon={<AddOutlinedIcon />}
            variant="outlined"
            onClick={() => append({ country: "CL", number: "" })}
            disabled={disabled || !canAdd}
            sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
          >
            {t("provider_contacts:add_phone")}
          </Button>
          <Typography variant="caption" color="text.secondary">
            {t("provider_contacts:phone_help")}
          </Typography>
        </Box>
        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <TextInput
              {...field}
              id={`${formId}-email`}
              type="email"
              label={t("provider_contacts:email")}
              disabled={disabled}
              error={!!errors.email}
              helperText={errorText(errors.email?.message)}
            />
          )}
        />
        <Accordion
          disabled={locked}
          expanded={expanded || !!errors.schedule}
          onChange={(_, next) => setExpanded(next)}
          disableGutters
          elevation={0}
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            "&:before": { display: "none" },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreOutlinedIcon />}
            aria-controls={`${formId}-schedule`}
            id={`${formId}-schedule-title`}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t("provider_contacts:schedule")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("provider_contacts:schedule_help")}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails id={`${formId}-schedule`}>
            {CONTACT_DAYS.map((day) => (
              <DayRow key={day}>
                <Typography variant="subtitle2">
                  {t(`provider_contacts:days.${day}`)}
                </Typography>
                <Controller
                  name={`schedule.${day}.from`}
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      {...field}
                      id={`${formId}-${day}-from`}
                      type="time"
                      label={t("provider_contacts:from")}
                      disabled={disabled}
                      error={!!errors.schedule?.[day]?.from}
                      helperText={errorText(
                        errors.schedule?.[day]?.from?.message,
                      )}
                    />
                  )}
                />
                <Controller
                  name={`schedule.${day}.to`}
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      {...field}
                      id={`${formId}-${day}-to`}
                      type="time"
                      label={t("provider_contacts:to")}
                      disabled={disabled}
                      error={!!errors.schedule?.[day]?.to}
                      helperText={errorText(
                        errors.schedule?.[day]?.to?.message,
                      )}
                    />
                  )}
                />
                <Controller
                  name={`schedule.${day}.description`}
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      {...field}
                      id={`${formId}-${day}-description`}
                      label={t("provider_contacts:visit_description")}
                      disabled={disabled}
                      error={!!errors.schedule?.[day]?.description}
                      helperText={errorText(
                        errors.schedule?.[day]?.description?.message,
                      )}
                    />
                  )}
                />
              </DayRow>
            ))}
          </AccordionDetails>
        </Accordion>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <TextInput
              {...field}
              id={`${formId}-description`}
              label={t("provider_contacts:description")}
              multiline
              minRows={3}
              disabled={disabled}
              error={!!errors.description}
              helperText={errorText(errors.description?.message)}
            />
          )}
        />
        <SwitchWrapper>
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <StyledFormControlLabel
                labelPlacement="start"
                label={t("provider_contacts:active")}
                control={
                  <StyledSwitch
                    checked={field.value}
                    onChange={(_, checked) => field.onChange(checked)}
                    disabled={disabled}
                  />
                }
              />
            )}
          />
        </SwitchWrapper>
      </ContactFormContainer>
    </BaseModal>
  );
}
