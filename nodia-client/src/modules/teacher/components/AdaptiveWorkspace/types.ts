import type { Session, CommandResult } from "../../infrastructure/schemas";
import type { useTeacherCommand } from "../../infrastructure/useServices";

export type AdaptivePanelProps = {
  session: Session;
  visible: boolean;
  busy: boolean;
  command: ReturnType<typeof useTeacherCommand>;
  onResult: (result: CommandResult) => void;
  onPractice: (unitId: string) => void;
};
