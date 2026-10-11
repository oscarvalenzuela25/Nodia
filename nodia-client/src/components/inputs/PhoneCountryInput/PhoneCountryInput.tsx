import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  type CountryCode,
} from "libphonenumber-js/max";
import SelectSingleInput from "../SelectSingleInput";
import type { SelectSingleInputProps } from "../SelectSingleInput/types";
import { Wrapper } from "./styles";

type Props = Omit<
  SelectSingleInputProps,
  "options" | "onChange" | "value" | "clearable"
> & {
  value: CountryCode;
  onChange: (country: CountryCode) => void;
};
export default function PhoneCountryInput({
  value,
  onChange,
  label,
  ...props
}: Props) {
  const { t, i18n } = useTranslation();
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([i18n.language], { type: "region" });
    return getCountries()
      .map((country) => ({
        value: country,
        label: `${names.of(country)} (+${getCountryCallingCode(country)})`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, i18n.language));
  }, [i18n.language]);
  return (
    <Wrapper>
      <SelectSingleInput
        {...props}
        label={label ?? t("core:phone_country")}
        value={value}
        onChange={(country) => {
          if (country && isSupportedCountry(country))
            onChange(country as CountryCode);
        }}
        options={countries}
        clearable={false}
      />
    </Wrapper>
  );
}
