import type { FC, ChangeEvent } from "react";
import { useState, useId } from "react";
import { useTranslation } from "react-i18next";
import { Collapse, IconButton, Tooltip, Typography, Box } from "@mui/material";
import TranslateOutlinedIcon from "@mui/icons-material/TranslateOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { TranslationInputProps, LanguageOption } from "./types";
import {
  RootContainer,
  LabelTypography,
  RequiredStar,
  TranslationsBox,
  TranslationsHeader,
  HeaderTitleContainer,
  HeaderTitle,
  HeaderSubtitle,
  LanguagesGrid,
  LanguageFieldContainer,
  LanguageLabel,
  LanguageBadge,
  StyledTextField,
} from "./styles";

const DEFAULT_LANGUAGES: LanguageOption[] = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
];

const TranslationInput: FC<TranslationInputProps> = ({
  id,
  name = "key",
  label,
  value,
  onChangeKey,
  placeholder,
  translations,
  onChangeTranslations,
  languages = DEFAULT_LANGUAGES,
  required = false,
  disabled = false,
  error = false,
  helperText,
  keyHelperText,
  fullWidth = true,
  autoFocus = false,
  sectionTitle,
  sectionSubtitle,
  defaultExpanded,
}) => {
  const { t } = useTranslation(["roles", "core"]);
  const generatedId = useId();
  const inputId = id ?? generatedId;

  // By default, expand if there is a value or explicit defaultExpanded
  const [isManuallyExpanded, setIsManuallyExpanded] = useState<boolean | null>(
    defaultExpanded ?? null
  );

  const isExpanded =
    isManuallyExpanded !== null
      ? isManuallyExpanded
      : value.trim().length > 0 || Object.values(translations).some((v) => v?.trim()?.length > 0);

  const handleKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChangeKey(e.target.value);
  };

  const handleTranslationChange = (code: string, text: string) => {
    onChangeTranslations({
      ...translations,
      [code]: text,
    });
  };

  const toggleExpand = () => {
    setIsManuallyExpanded((prev) => (prev !== null ? !prev : !isExpanded));
  };

  const resolvedSectionTitle =
    sectionTitle ?? t("roles:form.translations_title", "Traducciones del Nombre");
  const resolvedSectionSubtitle =
    sectionSubtitle ??
    t(
      "roles:form.translations_subtitle",
      "Define cómo se mostrará el nombre en cada idioma."
    );

  return (
    <RootContainer fullWidth={fullWidth}>
      {label && (
        <LabelTypography htmlFor={inputId}>
          {label}
          {required && <RequiredStar>*</RequiredStar>}
        </LabelTypography>
      )}

      <StyledTextField
        id={inputId}
        name={name}
        value={value}
        onChange={handleKeyChange}
        placeholder={placeholder ?? t("roles:form.key_placeholder", "ej: super_admin")}
        disabled={disabled}
        error={error}
        helperText={helperText ?? keyHelperText}
        fullWidth
        autoFocus={autoFocus}
        variant="outlined"
        slotProps={{
          input: {
            sx: { fontFamily: value ? "monospace" : "inherit" },
            endAdornment: (
              <Tooltip
                title={isExpanded ? t("core:collapse", "Ocultar traducciones") : t("core:expand", "Ver traducciones")}
                arrow
              >
                <IconButton
                  size="small"
                  onClick={toggleExpand}
                  aria-label="toggle translations"
                  sx={(theme) => ({
                    color: isExpanded ? theme.palette.primary.main : theme.palette.text.secondary,
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: theme.transitions.create("transform", {
                      duration: theme.transitions.duration.shorter,
                    }),
                  })}
                >
                  <ExpandMoreIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ),
          },
        }}
      />

      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <TranslationsBox>
          <TranslationsHeader>
            <HeaderTitleContainer>
              <TranslateOutlinedIcon
                fontSize="small"
                sx={{ color: "primary.main", fontSize: "1.1rem" }}
              />
              <Box>
                <HeaderTitle>{resolvedSectionTitle}</HeaderTitle>
                <HeaderSubtitle>{resolvedSectionSubtitle}</HeaderSubtitle>
              </Box>
            </HeaderTitleContainer>
          </TranslationsHeader>

          <LanguagesGrid>
            {languages.map((lang) => {
              const langCode = lang.code;
              const fieldId = `${inputId}-lang-${langCode}`;
              const langVal = translations[langCode] ?? "";
              const fieldPlaceholder =
                langCode === "es"
                  ? t("roles:form.name_es_placeholder", "ej: Administrador Principal")
                  : t("roles:form.name_en_placeholder", "ej: Super Administrator");

              return (
                <LanguageFieldContainer key={langCode}>
                  <LanguageLabel htmlFor={fieldId}>
                    <LanguageBadge langCode={langCode}>{langCode}</LanguageBadge>
                    <Typography component="span" variant="caption" sx={{ fontWeight: 600 }}>
                      {lang.label}
                    </Typography>
                  </LanguageLabel>
                  <StyledTextField
                    id={fieldId}
                    name={`translation_${langCode}`}
                    value={langVal}
                    onChange={(e) => handleTranslationChange(langCode, e.target.value)}
                    placeholder={fieldPlaceholder}
                    disabled={disabled}
                    fullWidth
                    variant="outlined"
                    size="small"
                  />
                </LanguageFieldContainer>
              );
            })}
          </LanguagesGrid>
        </TranslationsBox>
      </Collapse>
    </RootContainer>
  );
};

export default TranslationInput;
