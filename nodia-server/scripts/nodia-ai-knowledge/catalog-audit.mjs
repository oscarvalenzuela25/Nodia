// Build tooling: pure checks over the supplied catalog/publication snapshots.
// Publication remains controlled exclusively by the registry and knowledge compiler.
const ensure = (condition, code) => {
  if (!condition) throw new Error(code);
};
const unique = (values, code) => ensure(new Set(values).size === values.length, code);

/** Explicit semantic additions to existing handlers; never rewrite the historical snapshot. */
export function mergeCatalogExtensions(catalog, extension) {
  const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const keys = (value, expected) => object(value) && Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
  const hasNewHandlers = object(extension) && Object.hasOwn(extension, 'newHandlers');
  ensure(keys(extension, ['schema_version', 'domainTools', 'handlerCoverage', ...(hasNewHandlers ? ['newHandlers'] : [])]) && extension.schema_version === 1 &&
    Array.isArray(extension.domainTools) && Array.isArray(extension.handlerCoverage), 'catalog_extension_invalid');
  ensure(object(catalog) && ['domainTools', 'commonTools', 'secureFlowTools', 'handlerCoverage'].every((key) => Array.isArray(catalog[key])), 'catalog_collections_invalid');
  ensure(catalog.handlerCoverage.every((entry) => object(entry) && typeof entry.operationId === 'string' && Array.isArray(entry.toolNames)), 'handler_coverage_invalid');
  const baseline = [...catalog.domainTools, ...catalog.commonTools, ...catalog.secureFlowTools];
  ensure(baseline.every((tool) => object(tool) && typeof tool.name === 'string'), 'candidate_name_invalid');
  unique(baseline.map((tool) => tool.name), 'candidate_duplicate');
  unique(catalog.handlerCoverage.map((entry) => entry.operationId), 'handler_coverage_duplicate');
  const byName = new Map(baseline.map((tool) => [tool.name, tool]));
  const coverage = new Map(catalog.handlerCoverage.map((entry) => [entry.operationId, entry]));
  // New vertical resources have no handler in the immutable historical snapshot.
  // Their reviewed, explicit cohort is separate from derivations of old handlers.
  const newHandlers = hasNewHandlers ? extension.newHandlers : [];
  ensure(Array.isArray(newHandlers) && newHandlers.length <= 1000, 'catalog_extension_new_handlers_invalid');
  for (const handler of newHandlers) {
    ensure(keys(handler, ['operationId', 'treatment', 'toolNames', 'sourcePath', 'method', 'path']) &&
      /^[A-Za-z][A-Za-z0-9]*Controller\.[A-Za-z][A-Za-z0-9]*$/.test(handler.operationId) &&
      handler.treatment === 'domain_tool' && Array.isArray(handler.toolNames) && handler.toolNames.length === 0 &&
      /^nodia-server\/src\/[A-Za-z0-9/_-]+\.controller\.ts$/.test(handler.sourcePath) &&
      ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(handler.method) &&
      typeof handler.path === 'string' && /^\/[A-Za-z0-9_/:.-]+$/.test(handler.path), 'catalog_extension_new_handlers_invalid');
    ensure(!coverage.has(handler.operationId), 'catalog_extension_handler_collision');
    coverage.set(handler.operationId, handler);
  }
  const additions = new Map();
  const semantic = (value) => keys(value, ['kind', 'note']) && value.kind === 'semantic_derivation' &&
    typeof value.note === 'string' && value.note.trim().length > 0 && value.note.length <= 2048;
  for (const tool of extension.domainTools) {
    ensure(object(tool) && typeof tool.name === 'string' && /^nodia_[a-z0-9_]+$/.test(tool.name), 'candidate_name_invalid');
    ensure(!byName.has(tool.name) && !additions.has(tool.name), 'catalog_extension_candidate_collision');
    ensure(['read', 'read_artifact', 'analyze_attachment', 'prepare_change'].includes(tool.kind) &&
      typeof tool.targetModuleRoute === 'string' && tool.targetModuleRoute.startsWith('/'), 'catalog_extension_candidate_invalid');
    ensure(semantic(tool.derivation), 'catalog_extension_derivation_invalid');
    ensure(Array.isArray(tool.backendBindings) && tool.backendBindings.length === 0, 'catalog_extension_http_binding_denied');
    ensure(object(tool.publication) && tool.publication.published === false, 'catalog_extension_publication_denied');
    ensure(Array.isArray(tool.sourceHandlerIds) && tool.sourceHandlerIds.length > 0 &&
      tool.sourceHandlerIds.every((handler) => typeof handler === 'string'), 'candidate_source_handlers_missing');
    unique(tool.sourceHandlerIds, 'candidate_source_handler_duplicate');
    for (const handler of tool.sourceHandlerIds) {
      const mapping = coverage.get(handler);
      ensure(mapping, 'catalog_extension_handler_unknown');
      ensure(mapping.treatment === 'domain_tool', 'catalog_extension_handler_excluded');
    }
    additions.set(tool.name, tool);
  }
  unique(extension.handlerCoverage.map((entry) => entry?.operationId), 'catalog_extension_coverage_duplicate');
  const extendedCoverage = new Map();
  for (const mapping of extension.handlerCoverage) {
    ensure(keys(mapping, ['operationId', 'toolNames', 'derivation']) && typeof mapping.operationId === 'string' &&
      Array.isArray(mapping.toolNames) && mapping.toolNames.length > 0 && semantic(mapping.derivation), 'catalog_extension_coverage_invalid');
    const original = coverage.get(mapping.operationId);
    ensure(original, 'catalog_extension_handler_unknown');
    ensure(original.treatment === 'domain_tool', 'catalog_extension_handler_excluded');
    ensure(Array.isArray(original.toolNames), 'handler_tool_names_invalid');
    unique(mapping.toolNames, 'handler_tool_duplicate');
    for (const name of mapping.toolNames) {
      const tool = additions.get(name);
      ensure(tool && tool.sourceHandlerIds.includes(mapping.operationId), 'catalog_extension_coverage_inconsistent');
    }
    extendedCoverage.set(mapping.operationId, mapping);
  }
  for (const tool of additions.values())
    for (const handler of tool.sourceHandlerIds)
      ensure(extendedCoverage.get(handler)?.toolNames.includes(tool.name), 'catalog_extension_coverage_inconsistent');
  const merged = structuredClone(catalog);
  for (const handler of newHandlers) ensure(extendedCoverage.has(handler.operationId), 'catalog_extension_coverage_inconsistent');
  merged.handlerCoverage.push(...structuredClone(newHandlers));
  merged.domainTools.push(...structuredClone(extension.domainTools));
  for (const mapping of merged.handlerCoverage)
    mapping.toolNames.push(...(extendedCoverage.get(mapping.operationId)?.toolNames ?? []));
  return merged;
}

export function auditCurrentCatalog(catalog, manifest, selection, limits, selectionToolName) {
  const collections = ['domainTools', 'commonTools', 'secureFlowTools'];
  ensure(collections.every((key) => Array.isArray(catalog[key])), 'catalog_collections_invalid');
  const candidates = collections.flatMap((key) => catalog[key]);
  ensure(candidates.every((tool) => typeof tool.name === 'string' && /^nodia_[a-z0-9_]+$/.test(tool.name)), 'candidate_name_invalid');
  ensure([...catalog.domainTools, ...catalog.secureFlowTools].every((tool) => Array.isArray(tool.sourceHandlerIds) && tool.sourceHandlerIds.length > 0), 'candidate_source_handlers_missing');
  unique(candidates.map((tool) => tool.name), 'candidate_duplicate');
  const byName = new Map(candidates.map((tool) => [tool.name, tool]));
  ensure(Array.isArray(manifest.capability_contracts), 'published_contracts_invalid');
  const published = manifest.capability_contracts;
  unique(published.map((tool) => tool.capability_id), 'published_duplicate');
  const publishedIds = new Set(published.map((tool) => tool.capability_id));
  ensure(Array.isArray(catalog.handlerCoverage), 'handler_coverage_invalid');
  ensure(catalog.handlerCoverage.every((item) => Array.isArray(item.toolNames)), 'handler_tool_names_invalid');
  unique(catalog.handlerCoverage.map((item) => item.operationId), 'handler_coverage_duplicate');
  const coverage = new Map(catalog.handlerCoverage.map((item) => [item.operationId, item]));
  for (const tool of candidates) {
    unique(tool.sourceHandlerIds ?? [], 'candidate_source_handler_duplicate');
    for (const handler of tool.sourceHandlerIds ?? []) {
      const mapping = coverage.get(handler);
      ensure(mapping && mapping.toolNames.includes(tool.name), 'candidate_handler_unmapped');
      ensure(['domain_tool', 'secure_client_flow'].includes(mapping.treatment), 'candidate_handler_excluded');
    }
  }
  for (const mapping of coverage.values()) {
    ensure(Array.isArray(mapping.toolNames), 'handler_tool_names_invalid');
    unique(mapping.toolNames, 'handler_tool_duplicate');
    for (const name of mapping.toolNames) {
      const tool = byName.get(name);
      ensure(tool && tool.sourceHandlerIds?.includes(mapping.operationId), 'handler_candidate_unmapped');
    }
  }
  for (const tool of published) {
    const candidate = byName.get(tool.capability_id);
    ensure(candidate, 'published_candidate_missing');
    ensure(tool.kind === candidate.kind, 'published_kind_mismatch');
    ensure(tool.publication === 'published', 'publication_state_invalid');
    if (candidate.targetModuleRoute?.startsWith('/'))
      ensure(tool.required_module_routes.includes(candidate.targetModuleRoute), 'published_target_module_mismatch');
  }
  const technical = selection.technical_tool_names;
  ensure(Array.isArray(technical) && technical.every((name) => typeof name === 'string'), 'technical_names_invalid');
  unique(technical, 'technical_duplicate');
  ensure(!technical.some((name) => publishedIds.has(name)), 'technical_published_overlap');
  ensure(typeof selectionToolName === 'string' && !technical.includes(selectionToolName) && !publishedIds.has(selectionToolName), 'discovery_selection_tool_invalid');
  ensure(Number.isSafeInteger(limits.tools) && limits.tools > technical.length, 'catalog_limits_invalid');
  const selectedMaximum = limits.tools - technical.length;
  ensure(Array.isArray(selection.profiles), 'selection_profiles_invalid');
  unique(selection.profiles.map((profile) => profile.profile_id), 'selection_profile_duplicate');
  ensure(selection.profiles.some((profile) => profile.profile_id === selection.default_profile_id), 'default_profile_missing');
  const profiles = selection.profiles.map((profile) => {
    ensure(Array.isArray(profile.capability_ids) && Array.isArray(profile.required_capability_ids), 'selection_profile_invalid');
    unique(profile.capability_ids, 'selection_capability_duplicate');
    unique(profile.required_capability_ids, 'selection_required_duplicate');
    ensure(profile.capability_ids.length <= selectedMaximum, 'selection_count_exceeded');
    ensure(profile.capability_ids.every((name) => publishedIds.has(name)), 'selection_unpublished');
    ensure(profile.required_capability_ids.every((name) => profile.capability_ids.includes(name)), 'selection_required_missing');
    return { profile_id: profile.profile_id, configured_capabilities: profile.capability_ids.length };
  });
  const excludedHandlers = [...coverage.values()].filter((item) => !['domain_tool', 'secure_client_flow'].includes(item.treatment));
  ensure(excludedHandlers.every((item) => item.toolNames.length === 0), 'excluded_handler_published');
  return {
    proposed_candidates: candidates.length,
    published_capabilities: published.length,
    published_by_kind: Object.fromEntries([...new Set(published.map((tool) => tool.kind))].sort().map((kind) => [kind, published.filter((tool) => tool.kind === kind).length])),
    unpublished_candidates: candidates.filter((tool) => !publishedIds.has(tool.name) && !technical.includes(tool.name)).map((tool) => tool.name).sort(),
    technical_candidates: candidates.filter((tool) => technical.includes(tool.name)).map((tool) => tool.name).sort(),
    excluded_handlers_by_treatment: Object.fromEntries([...new Set(excludedHandlers.map((item) => item.treatment))].sort().map((treatment) => [treatment, excludedHandlers.filter((item) => item.treatment === treatment).map((item) => item.operationId).sort()])),
    historical_publication_flag_differences: candidates.filter((tool) => Boolean(tool.publication?.published) !== publishedIds.has(tool.name)).map((tool) => tool.name).sort(),
    generation_limits: { discovery_tools: technical.length + 1, discovery_selection_tool: selectionToolName, execution_technical_tools: technical.length, selected_capabilities_maximum: selectedMaximum, execution_tools_maximum: limits.tools, catalog_utf8_bytes: limits.utf8Bytes },
    profiles,
  };
}

/** Runtime schema compiler returns only the reachable definition graph. */
export function assertNoAdministrativeModuleFields(capability, schema) {
  if (!/^nodia_(modules|module_groups)_/.test(capability)) return;
  const forbidden = new Set(['sort_order', 'ordering', 'group_ordering', 'locate_id', 'expected_sort_order', 'expected_neighbor']);
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.properties)
      ensure(Object.keys(node.properties).every((name) => !forbidden.has(name)), 'administrative_module_field_published');
    // Closed module contracts currently have no free-form field maps. Inspect
    // admitted names, rather than banning patterns or other products' maps.
    if (node.patternProperties) {
      const patterns = Object.keys(node.patternProperties).map((pattern) => new RegExp(pattern, 'u'));
      ensure([...forbidden].every((name) => patterns.every((pattern) => !pattern.test(name))), 'administrative_module_field_published');
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else visit(value);
    }
  };
  visit(schema);
}
