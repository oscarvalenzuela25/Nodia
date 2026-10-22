export interface KnowledgePin {
  schema_version: 1;
  release_id: string;
  catalog_release: string;
  schema_sha256: string;
}
export interface KnowledgeRequirement {
  capability_id: string;
  revision: number;
  input_schema_sha256: string;
  output_schema_sha256: string;
}
/** Trusted executable publication proof, distinct from a fragment's bare contract reference. */
export interface KnowledgeRegisteredCapability extends KnowledgeRequirement {
  kind: string;
  required_module_routes: readonly string[];
}
export interface KnowledgeFragment {
  document_id: string;
  fragment_id: string;
  purpose: string;
  sections: string[];
  asset_path: string;
  sha256: string;
  byte_length: number;
  required_module_routes: string[];
  requires: KnowledgeRequirement[];
}
export interface KnowledgeManifest {
  schema_version: 1;
  registry_sha256: string;
  contract_schema_sha256: string;
  catalog_release: string;
  context_module_route: string | null;
  documents: {
    document_id: string;
    revision: number;
    content_sha256: string;
  }[];
  fragments: KnowledgeFragment[];
  capability_contracts: {
    capability_id: string;
    revision: number;
    publication: string;
    kind: string;
    required_module_routes: string[];
    input_schema: { sha256: string };
    output_schema: { sha256: string };
  }[];
  release_id: string;
}
export const NODIA_AI_KNOWLEDGE_ROOT = Symbol('NODIA_AI_KNOWLEDGE_ROOT');
export const NODIA_AI_KNOWLEDGE_PIN = Symbol('NODIA_AI_KNOWLEDGE_PIN');
export const NODIA_AI_KNOWLEDGE_SCHEMA = Symbol('NODIA_AI_KNOWLEDGE_SCHEMA');
export const NODIA_AI_REGISTERED_CAPABILITIES = Symbol(
  'NODIA_AI_REGISTERED_CAPABILITIES',
);
