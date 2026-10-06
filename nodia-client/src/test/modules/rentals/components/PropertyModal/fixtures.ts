import { vi } from "vitest";
import { createElement } from "react";
import type {
  RentalAck,
  RentalCollaborator,
  RentalPolicy,
  RentalProperty,
} from "../../../../../modules/rentals/types";
import i18n from "../../../../../translate";
import translations from "../../../../../modules/rentals/components/PropertyModal/translations.json";

const administrationMock = vi.hoisted(() => ({
  execute: vi.fn(),
  recover: vi.fn(),
  retry: vi.fn(),
  list: vi.fn(),
  record: vi.fn(),
  busy: false,
  uncertain: false,
  pending: false,
}));
export { administrationMock };
vi.mock("../../../../../modules/rentals/infrastructure/useServices", () => ({
  useRentalMutation: () => ({
    execute: administrationMock.execute,
    recover: administrationMock.recover,
    retry: administrationMock.retry,
    isPending: administrationMock.pending,
    isUncertain: administrationMock.uncertain,
    error: null,
    intent: null,
  }),
  useRentalBusy: () => administrationMock.busy,
  useRentalList: (...args: unknown[]) => administrationMock.list(...args),
  useRentalRecord: (...args: unknown[]) => administrationMock.record(...args),
  useRentalOptions: (...args: unknown[]) => ({
    ...administrationMock.list(...args),
    hasNextPage: false,
    fetchNextPage: vi.fn(),
  }),
}));
vi.mock("../../../../../modules/rentals/components/RentalRemoteSelect", () => ({
  default: (props: {
    label: string;
    value: string | null;
    onChange: (value: string | null) => void;
    selectedLabel?: string;
    disabled?: boolean;
  }) =>
    createElement(
      "select",
      {
        "aria-label": props.label,
        value: props.value ?? "",
        disabled: props.disabled,
        onChange: (event: { target: { value: string } }) =>
          props.onChange(event.target.value || null),
      },
      createElement("option", { value: "" }, ""),
      props.value
        ? createElement(
            "option",
            { value: props.value },
            props.selectedLabel ?? props.value,
          )
        : createElement("option", { value: "2" }, "Persona sintética"),
    ),
}));
const authorship = {
  created_by: "1",
  updated_by: "1",
  created_at: "2026-10-04T12:00:00Z",
  updated_at: "2026-10-04T12:00:00Z",
};
export const property: RentalProperty = {
  ...authorship,
  id: "10",
  owner_id: "1",
  name: "Casa de prueba",
  location: null,
  timezone: "America/Santiago",
  max_guests: 4,
  check_in_time: "15:00",
  check_out_time: "11:00",
  default_nightly_rate: null,
  default_deposit_percent: null,
  minimum_turnover_minutes: 0,
  default_cancellation_policy_id: null,
  notes: null,
  is_active: true,
  membership: {
    type: "owner",
    can_manage_configuration: true,
    can_manage_collaborators: true,
  },
};
export const memberProperty: RentalProperty = {
  ...property,
  membership: {
    type: "collaborator",
    can_manage_configuration: false,
    can_manage_collaborators: false,
  },
};
export const policy: RentalPolicy = {
  ...authorship,
  id: "20",
  property_id: "10",
  name: "Flexible",
  is_active: true,
  rules: [
    {
      ...authorship,
      id: "21",
      policy_id: "20",
      min_days_before: 0,
      refund_percent: "0.00",
    },
    {
      ...authorship,
      id: "22",
      policy_id: "20",
      min_days_before: 7,
      refund_percent: "50.00",
    },
  ],
};
export const collaborator: RentalCollaborator = {
  ...authorship,
  id: "30",
  property_id: "10",
  user_id: "2",
  position: "Apoyo",
  is_active: true,
  user: { id: "2", name: "Persona sintética", image_url: null },
};
export const ack: RentalAck = {
  operation: "property.update",
  property_id: "10",
  resource_type: "property",
  resource_id: "10",
  status: "active",
  updated_at: "2026-10-04T12:00:00Z",
};
export const readResult = <T>(data?: T) => ({
  data,
  isLoading: false,
  isFetching: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
});
export function resetAdministrationMocks() {
  vi.clearAllMocks();
  administrationMock.busy = false;
  administrationMock.uncertain = false;
  administrationMock.pending = false;
  administrationMock.execute.mockResolvedValue(ack);
  administrationMock.retry.mockResolvedValue(ack);
  administrationMock.recover.mockResolvedValue(ack);
  for (const language of ["es", "en"] as const)
    i18n.addResourceBundle(
      language,
      "rental",
      translations[language],
      true,
      true,
    );
  administrationMock.list.mockImplementation((resource: string) =>
    readResult({
      data:
        resource === "collaborators"
          ? [collaborator]
          : resource === "collaborator-candidates"
            ? [{ id: "2", name: "Persona sintética", image_url: null }]
            : [policy],
      meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
    }),
  );
  administrationMock.record.mockImplementation(
    (_resource: string, _propertyId: string, id?: string) =>
      readResult(id ? policy : undefined),
  );
}
