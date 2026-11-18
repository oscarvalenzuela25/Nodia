import DateInput, { type DateInputProps } from "../../../../components/inputs/DateInput";
import { DateRangeRow } from "./styles";

type RangeField = Pick<DateInputProps, "label" | "value" | "onChange" | "disabled" | "error" | "minDate" | "dataTestId">;
type Props = { from: RangeField; to: RangeField };

export default function BusinessDateRange({ from, to }: Props) {
  return (
    <DateRangeRow>
      <DateInput {...from} />
      <DateInput {...to} />
    </DateRangeRow>
  );
}
