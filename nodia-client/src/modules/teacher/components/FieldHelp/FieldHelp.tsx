import { Tooltip } from "@mui/material";
import HelpOutlineOutlined from "@mui/icons-material/HelpOutlineOutlined";
import { useTranslation } from "react-i18next";
import { HelpButton } from "./styles";

type Props = { label: string; message: string };

export default function FieldHelp({ label, message }: Props) {
  const { t } = useTranslation();
  return <Tooltip title={message} arrow describeChild>
    <HelpButton type="button" aria-label={t("teacher:field_help_label", { field: label })}>
      <HelpOutlineOutlined fontSize="small" />
    </HelpButton>
  </Tooltip>;
}
