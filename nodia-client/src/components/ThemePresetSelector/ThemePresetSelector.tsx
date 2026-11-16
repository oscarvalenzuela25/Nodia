import { useId, useRef, useState } from "react";
import type { FC } from "react";
import { Box, GlobalStyles, Tooltip, Typography } from "@mui/material";
import useAutocomplete from "@mui/material/useAutocomplete";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import useThemeStore from "../../store/configStore";
import { resolveThemePreset, themePresets } from "../../themes";
import {
  CurrentName, Option, OptionsList, SearchInput, SearchLabel,
  Swatches, ThemePopover, Trigger,
} from "./styles";

type Preset = (typeof themePresets)[number];
const feedbackStyles = { title: "nodia-theme-feedback-title" };

const PresetOptions: FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useTranslation("layout");
  const themeId = useThemeStore((state) => state.themeId);
  const themeType = useThemeStore((state) => state.themeType);
  const changeTheme = useThemeStore((state) => state.handleChangeThemeId);
  const [search, setSearch] = useState("");
  const selectionFailed = useRef(false);
  const {
    getRootProps, getInputLabelProps, getInputProps,
    getListboxProps, getOptionProps, groupedOptions,
  } = useAutocomplete<Preset, false, true>({
    options: themePresets,
    value: resolveThemePreset(themeId),
    inputValue: search,
    open: true,
    autoHighlight: true,
    disableClearable: true,
    getOptionLabel: (preset) => preset.name,
    getOptionKey: (preset) => preset.id,
    isOptionEqualToValue: (option, value) => option.id === value.id,
    onInputChange: (_event, value, reason) => {
      if (reason === "input" || reason === "clear") setSearch(value);
    },
    onChange: (_event, preset) => {
      if (preset.id === themeId) return;
      try {
        changeTheme(preset.id);
        sileo.success({
          title: t("theme_changed"),
          styles: feedbackStyles,
        });
      } catch {
        selectionFailed.current = true;
        sileo.error({ title: t("theme_save_error"), styles: feedbackStyles });
      }
    },
    onClose: (_event, reason) => {
      if (reason === "selectOption" && selectionFailed.current) {
        selectionFailed.current = false;
        return;
      }
      if (reason === "selectOption" || reason === "escape") onClose();
    },
  });

  return (
    <Box {...getRootProps()}>
      <SearchLabel {...getInputLabelProps()}>{t("theme_search")}</SearchLabel>
      <SearchInput {...getInputProps()} autoFocus placeholder={t("theme_search_placeholder")} />
      {groupedOptions.length > 0 ? (
        <OptionsList {...getListboxProps()}>
          {groupedOptions.map((preset, index) => {
            const { key, ...optionProps } = getOptionProps({ option: preset, index });
            const palette = preset[themeType];
            const primary = palette.primary;
            const secondary = palette.secondary;
            return (
              <Option key={key} {...optionProps}>
                <Swatches aria-hidden="true">
                  <span style={{ backgroundColor: primary && "main" in primary ? primary.main : undefined }} />
                  <span style={{ backgroundColor: secondary && "main" in secondary ? secondary.main : undefined }} />
                  <span style={{ backgroundColor: palette.background?.default }} />
                </Swatches>
                <Box component="span" sx={{ flex: 1 }}>{preset.name}</Box>
                {preset.id === themeId && <CheckOutlinedIcon fontSize="small" aria-hidden="true" />}
              </Option>
            );
          })}
        </OptionsList>
      ) : (
        <Typography role="status" variant="body2" sx={{ px: 2, py: 2, color: "text.secondary" }}>
          {t("theme_no_matches")}
        </Typography>
      )}
    </Box>
  );
};

const ThemePresetSelector: FC = () => {
  const { t } = useTranslation("layout");
  const themeId = useThemeStore((state) => state.themeId);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = useId();
  const current = resolveThemePreset(themeId);
  const label = t("theme_selector_label", { theme: current.name });

  return (
    <>
      <GlobalStyles styles={(theme) => ({
        "[data-sileo-title].nodia-theme-feedback-title": { color: theme.palette.text.inverse },
      })} />
      <Tooltip title={label}>
        <Trigger
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={Boolean(anchor)}
          aria-controls={anchor ? id : undefined}
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <PaletteOutlinedIcon />
          <CurrentName>{current.name}</CurrentName>
        </Trigger>
      </Tooltip>
      <ThemePopover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { id, role: "dialog", "aria-label": t("theme_selector") } }}
      >
        {anchor && <PresetOptions onClose={() => setAnchor(null)} />}
      </ThemePopover>
    </>
  );
};

export default ThemePresetSelector;
