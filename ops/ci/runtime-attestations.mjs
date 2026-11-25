import { isHex, isSha, requireCd } from './cd-github.mjs';
import { isGeminiRuntimeProof } from './gemini-runtime-proof.mjs';

function exactProof(value, fields) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === Object.keys(fields).length &&
    Object.entries(fields).every(([key, valid]) => Object.hasOwn(value, key) && valid(value[key]));
}

const sha512 = value => typeof value === 'string' && value.length === 128 && /^[a-f0-9]{128}$/.test(value);
const image = value => typeof value === 'string' && value.startsWith('sha256:') && isHex(value.slice(7));
const identity = { schema_version: value => value === 1, source_sha: isSha, source_tree_sha: isSha };

export const isCodexCvRuntimeProof = value => exactProof(value, {
  ...identity, binary_sha512: sha512, catalog_sha512: sha512, manifest_sha256: isHex,
});

export const isGeminiCvSdkProof = value => exactProof(value, {
  ...identity, image_id: image, manifest_sha256: isHex, runtime_hash: isHex, policy_hash: isHex,
});

export function geminiSdkMatchesImage(sdk, runtime) {
  return isGeminiCvSdkProof(sdk) && isGeminiRuntimeProof(runtime) &&
    sdk.source_sha === runtime.source_sha && sdk.source_tree_sha === runtime.source_tree_sha &&
    sdk.image_id === runtime.image_id;
}

export const runtimeProofValidators = Object.freeze({
  gemini_runtime: isGeminiRuntimeProof, codex_cv_runtime: isCodexCvRuntimeProof, gemini_cv_sdk: isGeminiCvSdkProof,
});

export function requireRuntimeProofMatch(expected, observed) {
  const proof = {};
  for (const [key, valid] of Object.entries(runtimeProofValidators)) {
    if (!Object.hasOwn(expected, key)) continue;
    requireCd(valid(expected[key]), key + '_attestation_invalid');
    const current = observed?.[key];
    requireCd(valid(current) && Object.entries(expected[key]).every(([field, value]) => current[field] === value),
      key + '_attestation_changed');
    proof[key] = current;
  }
  requireCd(!Object.hasOwn(proof, 'gemini_cv_sdk') || geminiSdkMatchesImage(proof.gemini_cv_sdk, proof.gemini_runtime),
    'gemini_cv_sdk_attestation_changed');
  return proof;
}
