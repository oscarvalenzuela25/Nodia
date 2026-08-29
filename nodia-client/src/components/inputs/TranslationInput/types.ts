export type LanguageOption = {
  code: string;
  label: string;
  flag?: string;
};

export type TranslationInputProps = {
  id?: string;
  name?: string;
  label?: string;
  value: string;
  onChangeKey: (keyValue: string) => void;
  placeholder?: string;
  translations: Record<string, string>;
  onChangeTranslations: (translations: Record<string, string>) => void;
  languages?: LanguageOption[];
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  keyHelperText?: string;
  fullWidth?: boolean;
  autoFocus?: boolean;
  sectionTitle?: string;
  sectionSubtitle?: string;
  defaultExpanded?: boolean;
};
