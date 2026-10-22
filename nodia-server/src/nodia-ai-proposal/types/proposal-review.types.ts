/** Trusted presentation registration. Values never come from model-produced JSON. */
export interface NodiaAiProposalReviewField {
  readonly field_key: string;
  readonly label_key: string;
  readonly kind:
    | 'text'
    | 'bigint'
    | 'integer'
    | 'enum'
    | 'boolean'
    | 'rental_cancellation_rules'
    | 'core_id_list'
    | 'core_translations';
  readonly nullable: boolean;
  readonly max_length: number | null;
  readonly minimum: string | null;
  readonly maximum: string | null;
  readonly options: readonly {
    readonly value: string;
    readonly label_key: string;
  }[];
}
