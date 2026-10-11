import {
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";

export function normalizedPhone(
  country: string,
  number: string,
): string | undefined {
  if (!isSupportedCountry(country)) return undefined;
  const parsed = parsePhoneNumberFromString(number, {
    defaultCountry: country as CountryCode,
    extract: false,
  });
  if (
    !parsed?.isValid() ||
    parsed.ext ||
    parsed.countryCallingCode !== getCountryCallingCode(country as CountryCode)
  )
    return undefined;
  return parsed.number;
}

/** Only split a complete international telephone; never reinterpret legacy free-text contacts. */
export function phoneContactParts(value: string): {
  country: CountryCode;
  number: string;
} {
  const parsed = value.trim().startsWith("+")
    ? parsePhoneNumberFromString(value, { extract: false })
    : undefined;
  return parsed?.isValid() && parsed.country && !parsed.ext
    ? { country: parsed.country, number: String(parsed.nationalNumber) }
    : { country: "CL", number: value };
}
export function isPhoneContact(value: string): boolean {
  return !!value.trim() && /^[+\d\s().-]+$/.test(value);
}
