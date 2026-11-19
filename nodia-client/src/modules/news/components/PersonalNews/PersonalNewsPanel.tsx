import { useId, useState, type ReactNode } from "react";
import KeyboardArrowRightOutlinedIcon from "@mui/icons-material/KeyboardArrowRightOutlined";
import { Typography } from "@mui/material";
import { PanelBody, PanelToggle } from "./styles";

export default function PersonalNewsPanel({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  const [expanded, setExpanded] = useState(true);

  return (
    <section aria-labelledby={`${id}-title`}>
      <Typography component="h2" variant="h6" id={`${id}-title`} sx={{ fontWeight: 700 }}>
        <PanelToggle
          type="button"
          aria-expanded={expanded}
          aria-controls={`${id}-body`}
          onClick={() => setExpanded((previous) => !previous)}
        >
          <KeyboardArrowRightOutlinedIcon aria-hidden="true" />
          {title}
        </PanelToggle>
      </Typography>
      <PanelBody id={`${id}-body`} hidden={!expanded}>
        {children}
      </PanelBody>
    </section>
  );
}
