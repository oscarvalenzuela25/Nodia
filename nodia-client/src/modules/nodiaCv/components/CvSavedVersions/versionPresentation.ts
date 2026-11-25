import type { TFunction } from "i18next";
import type { CvVersionSummary } from "../../infrastructure/pdfVersions";

export function cvVersionLabel(version: CvVersionSummary, t: TFunction) {
  return t("version_named", {
    number: version.version_number,
    title: version.vacancy_title || version.profile_name,
  });
}
