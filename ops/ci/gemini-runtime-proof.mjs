import { isHex, isSha } from './cd-github.mjs';

const keys = 'image_id,schema_version,source_sha,source_tree_sha';

export function isGeminiRuntimeProof(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === keys && value.schema_version === 1 &&
    isSha(value.source_sha) && isSha(value.source_tree_sha) &&
    typeof value.image_id === 'string' && value.image_id.startsWith('sha256:') &&
    isHex(value.image_id.slice('sha256:'.length));
}

export function sameGeminiRuntimeProof(expected, observed) {
  return isGeminiRuntimeProof(expected) && isGeminiRuntimeProof(observed) &&
    expected.source_sha === observed.source_sha && expected.source_tree_sha === observed.source_tree_sha &&
    expected.image_id === observed.image_id;
}
