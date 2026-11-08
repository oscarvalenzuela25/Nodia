import { useState } from "react";
import { Tooltip } from "@mui/material";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import { useTranslation } from "react-i18next";
import { Image, ThumbnailButton } from "./styles";

interface Props {
  name: string;
  image?: { url: string } | null;
  disabled: boolean;
  onOpen: () => void;
}

export default function ProductImageThumbnail({ name, image, disabled, onOpen }: Props) {
  const { t } = useTranslation("business");
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = image?.url;
  const showImage = Boolean(source && source !== failedSource);

  return <Tooltip title={t("business:pos.image_preview_open")}>
    <span>
      <ThumbnailButton type="button" disabled={disabled} onClick={onOpen} aria-label={t("business:pos.image_preview_product", { name })}>
        {showImage ? <Image key={source} src={source} alt="" width={50} height={50} loading="lazy" decoding="async" onError={() => setFailedSource(source ?? null)} /> : <VisibilityOutlined fontSize="small" />}
      </ThumbnailButton>
    </span>
  </Tooltip>;
}
