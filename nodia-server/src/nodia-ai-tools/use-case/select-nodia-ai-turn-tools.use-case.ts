import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import {
  isNodiaAiMcpToolDescriptorValid,
  NODIA_AI_MCP_CATALOG_LIMITS,
  nodiaAiMcpCatalogUtf8Bytes,
} from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import {
  canonicalKnowledge,
  knowledgeHash,
} from '../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import { parseNodiaAiStrictJson } from '../../nodia-ai-context/strict-json.js';
import { NodiaAiKnownPreDispatchError } from '../../nodia-ai-runtime/types/worker.types.js';
import { isNodiaAiMcpExecutableRegistration } from '../types/tool-registry.types.js';
import type {
  NodiaAiSelectTurnToolsInput,
  NodiaAiSelectedTurnTools,
  NodiaAiToolSelectionProfiles,
} from '../types/tool-selection.types.js';

const invalid = (code = 'tool_selection_invalid'): never => {
  throw new NodiaAiKnownPreDispatchError(`nodia_ai:${code}`);
};
const object = (value: unknown): value is Record<string, unknown> =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  canonicalKnowledge(Object.keys(value).sort()) ===
  canonicalKnowledge([...keys].sort());
const validIds = (value: unknown, maximum: number): value is string[] =>
  Array.isArray(value) &&
  value.length <= maximum &&
  value.every(
    (item) => typeof item === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(item),
  ) &&
  new Set(value).size === value.length;
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Trusted deployment metadata only. No dynamic paths, discovery, model or user-supplied JSON. */
export function loadNodiaAiToolSelectionProfiles(
  source = readFileSync(
    new URL('../config/tool-selection-profiles.json', import.meta.url),
    'utf8',
  ),
): NodiaAiToolSelectionProfiles {
  if (Buffer.byteLength(source, 'utf8') > 65536) invalid();
  let document: unknown;
  try {
    document = parseNodiaAiStrictJson(source);
  } catch {
    return invalid();
  }
  if (
    !object(document) ||
    !exactKeys(document, [
      'schema_version',
      'default_profile_id',
      'technical_tool_names',
      'profiles',
    ]) ||
    document.schema_version !== 1 ||
    typeof document.default_profile_id !== 'string' ||
    !validIds(document.technical_tool_names, 7) ||
    document.technical_tool_names.length !== 7 ||
    !Array.isArray(document.profiles) ||
    !document.profiles.length ||
    document.profiles.length > 32
  )
    return invalid();
  const ids = new Set<string>();
  for (const profile of document.profiles) {
    if (
      !object(profile) ||
      !exactKeys(profile, [
        'profile_id',
        'revision',
        'capability_ids',
        'required_capability_ids',
      ]) ||
      typeof profile.profile_id !== 'string' ||
      !/^[a-z][a-z0-9_]{0,63}$/.test(profile.profile_id) ||
      ids.has(profile.profile_id) ||
      !Number.isSafeInteger(profile.revision) ||
      (profile.revision as number) < 1 ||
      !validIds(
        profile.capability_ids,
        NODIA_AI_MCP_CATALOG_LIMITS.tools - 7,
      ) ||
      !validIds(
        profile.required_capability_ids,
        NODIA_AI_MCP_CATALOG_LIMITS.tools - 7,
      )
    )
      return invalid();
    const capabilities = profile.capability_ids;
    if (
      profile.required_capability_ids.some((id) => !capabilities.includes(id))
    )
      return invalid();
    ids.add(profile.profile_id);
  }
  if (!ids.has(document.default_profile_id)) invalid();
  return freeze(document as unknown as NodiaAiToolSelectionProfiles);
}

/** Explicit allow-list selection, intersected with current authority. Never ranking or truncation. */
@Injectable()
export class SelectNodiaAiTurnToolsUseCase {
  // Read deployment assets once when composing the use case, never during a SQL checkpoint.
  private readonly configuredProfiles = loadNodiaAiToolSelectionProfiles();

  execute(
    input: NodiaAiSelectTurnToolsInput,
    profiles: NodiaAiToolSelectionProfiles = this.configuredProfiles,
  ): NodiaAiSelectedTurnTools {
    // Even an internal caller cannot bypass validation with a cast or mutate parsed metadata.
    profiles = loadNodiaAiToolSelectionProfiles(JSON.stringify(profiles));
    const profileId =
      input.profileId ??
      input.expectedProfile?.profile_id ??
      profiles.default_profile_id;
    const profile = profiles.profiles.find(
      (item) => item.profile_id === profileId,
    );
    if (!profile) return invalid('tool_selection_unknown');
    const frozenProfile = {
      schema_version: 1 as const,
      profile_id: profile.profile_id,
      revision: profile.revision,
      sha256: knowledgeHash(
        canonicalKnowledge({
          schema_version: profiles.schema_version,
          technical_tool_names: [...profiles.technical_tool_names].sort(),
          profile: {
            ...profile,
            capability_ids: [...profile.capability_ids].sort(),
            required_capability_ids: [
              ...profile.required_capability_ids,
            ].sort(),
          },
        }),
      ),
    };
    if (
      input.expectedProfile &&
      canonicalKnowledge(input.expectedProfile) !==
        canonicalKnowledge(frozenProfile)
    )
      return invalid('tool_selection_changed');
    const registered = new Map(
      input.registeredTools.map((tool) => [tool.capabilityId, tool]),
    );
    if (
      registered.size !== input.registeredTools.length ||
      new Set(input.registeredTools.map((tool) => tool.toolName)).size !==
        registered.size ||
      new Set(input.publishedCapabilityIds).size !==
        input.publishedCapabilityIds.length ||
      new Set(input.authorizedToolNames).size !==
        input.authorizedToolNames.length
    )
      return invalid();
    const published = new Set(input.publishedCapabilityIds);
    const authorized = new Set(input.authorizedToolNames);
    const required = new Set(profile.required_capability_ids);
    const selected = profile.capability_ids
      .flatMap((id) => {
        const tool = registered.get(id);
        if (
          !tool ||
          !published.has(id) ||
          !isNodiaAiMcpExecutableRegistration(tool)
        )
          return invalid('tool_selection_unpublished');
        if (!authorized.has(tool.toolName)) {
          if (required.has(id)) return invalid('capability_denied');
          return [];
        }
        if (!/^[a-f0-9]{64}$/.test(tool.contractHash)) return invalid();
        return [tool];
      })
      .sort((left, right) => left.toolName.localeCompare(right.toolName, 'en'));
    const technical = input.technicalTools;
    if (
      technical.length !== profiles.technical_tool_names.length ||
      new Set(technical.map((item) => item.descriptor.name)).size !==
        technical.length ||
      technical.some(
        (item) =>
          !profiles.technical_tool_names.includes(item.descriptor.name) ||
          !/^[a-f0-9]{64}$/.test(item.contractHash),
      )
    )
      return invalid();
    const descriptors = [
      ...technical.map((item) => structuredClone(item.descriptor)),
      ...selected.map((tool) => ({
        name: tool.toolName,
        description: tool.description,
        inputSchema: structuredClone(tool.inputSchema),
      })),
    ];
    const catalogUtf8Bytes = nodiaAiMcpCatalogUtf8Bytes(descriptors);
    if (
      descriptors.length > NODIA_AI_MCP_CATALOG_LIMITS.tools ||
      new Set(descriptors.map((item) => item.name)).size !==
        descriptors.length ||
      descriptors.some((item) => !isNodiaAiMcpToolDescriptorValid(item)) ||
      catalogUtf8Bytes > NODIA_AI_MCP_CATALOG_LIMITS.utf8Bytes ||
      descriptors.length + 1 > 128
    )
      return invalid('tool_catalog_limit');
    return freeze({
      profile: frozenProfile,
      capabilityIds: selected.map((tool) => tool.capabilityId),
      toolContracts: Object.fromEntries([
        ...technical.map((item) => [item.descriptor.name, item.contractHash]),
        ...selected.map((tool) => [tool.toolName, tool.contractHash]),
      ]),
      descriptors,
      catalogUtf8Bytes,
    });
  }
}
