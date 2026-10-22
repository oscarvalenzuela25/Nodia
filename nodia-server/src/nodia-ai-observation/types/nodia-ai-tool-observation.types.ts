export interface NodiaAiResultNavigation {
  readonly kind: 'business_detail' | 'rental_property' | 'module';
  readonly id: string | null;
  readonly module_route: string;
  readonly label: string | null;
}

/** Trusted UI projection; the separately fetched result retains its exact domain schema. */
export interface NodiaAiToolObservation {
  readonly result_ref: {
    readonly tool_call_id: string;
    readonly tool_name: string;
    readonly contract_hash: string;
  };
  readonly observed_at: string;
  readonly source: {
    readonly module_key: string;
    readonly resource_key: string;
    readonly operation_key: string;
    readonly description_key: string;
  };
  readonly summary: {
    readonly total: number | string | null;
    readonly returned: number | null;
  };
  readonly navigation: readonly NodiaAiResultNavigation[];
}
