import type { Dispatch, SetStateAction } from "react";
import type { Outline } from "../../infrastructure/schemas";

export type PlanStructureEditorProps = {
  value: Outline;
  busy: boolean;
  onChange: Dispatch<SetStateAction<Outline>>;
  onValidation: (valid: boolean) => void;
};
