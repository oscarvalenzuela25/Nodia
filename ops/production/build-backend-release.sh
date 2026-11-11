#!/usr/bin/env bash
# Run from an isolated git-archive snapshot, never on the VPS or an active checkout.
set -Eeuo pipefail
umask 022
[[ $# -eq 3 ]] || { printf 'Usage: build-backend-release.sh SOURCE_SHA OUTPUT_DIR SOURCE_MANIFEST_JSON\n' >&2; exit 1; }
SOURCE_SHA=$1
SNAPSHOT=$(pwd -P)
OUTPUT=$(realpath -m -- "$2")
SOURCE_MANIFEST=$(realpath -- "$3")
TOOLING=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
[[ $EUID -ne 0 && $(uname -s) == Linux && $(uname -m) == x86_64 && $(node --version) == v24.22.2 ]] || {
  printf 'Linux x64 with Node24.22.2 is required.\n' >&2; exit 1;
}
case "$OUTPUT/" in "$SNAPSHOT/"*) printf 'Output must be outside the source snapshot.\n' >&2; exit 1 ;; esac
mkdir -p -- "$OUTPUT/.build-home"
chmod 0700 "$OUTPUT/.build-home"
for config in npmrc-user npmrc-global; do
  [[ ! -L $OUTPUT/.build-home/$config ]] || { printf 'Refusing symlinked npm configuration.\n' >&2; exit 1; }
  : >"$OUTPUT/.build-home/$config"
  chmod 0600 "$OUTPUT/.build-home/$config"
done
export PATH
# No production environment, user npmrc, sessions or provider configuration reaches child commands.
run() {
  env -i PATH="$PATH" HOME="$OUTPUT/.build-home" LANG=C.UTF-8 LC_ALL=C.UTF-8 TZ=UTC \
    NPM_CONFIG_USERCONFIG="$OUTPUT/.build-home/npmrc-user" \
    NPM_CONFIG_GLOBALCONFIG="$OUTPUT/.build-home/npmrc-global" "$@"
}
run node --input-type=module - "$TOOLING/package-backend-release.mjs" "$SNAPSHOT" "$SOURCE_SHA" "$SOURCE_MANIFEST" "$OUTPUT" <<'JS'
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [tool, root, sha, sourceManifest, output] = process.argv.slice(2);
const { verifySource } = await import(pathToFileURL(tool));
const result = verifySource(root, sha, sourceManifest);
fs.writeFileSync(path.join(output, 'verified-source.json'), JSON.stringify(result, null, 2) + '\n');
console.log(`Verified source snapshot (${result.source_provenance}): ${result.files_verified} files, base ${sha}, documentation overlays ${result.overlay.length}`);
JS
cd -- "$SNAPSHOT/nodia-server"
run npm ci --include=optional --no-audit --no-fund
run npm run build
# The current verifier checks both source/dist pins. A clean git archive omits
# these ignored, build-owned source assets; prepare them from the compiled bundle.
run npm run context:prepare
run npm run lint
# Static/offline catalog, publication and small runtime units: no DB or provider operations.
run npm run test:nodia-ai:catalog
run npm run test:nodia-ai:knowledge
run npm run test:nodia-ai:common-contract-fixtures
run npm test -- --no-file-parallelism \
  src/nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.spec.ts \
  src/nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.spec.ts \
  src/nodia-ai-context/use-case/execute-nodia-ai-knowledge-tool.use-case.spec.ts
run node test/build-assets.integration.mjs
run node --input-type=module - "$OUTPUT" "$SOURCE_SHA" <<'JS'
import fs from 'node:fs';
import path from 'node:path';
const [output, sha] = process.argv.slice(2);
fs.writeFileSync(path.join(output, 'build-checks.json'), JSON.stringify({ status: 'passed', source_sha: sha,
  checks: ['full_nest_and_postbuild_assets', 'context_build_owned_source_pins', 'backend_lint', 'catalog_units', 'knowledge_compiler_and_pin',
    'common_contract_fixtures', 'runtime_policy_and_knowledge_units', 'compiled_asset_contracts'],
  database_or_inference_executed: false }, null, 2) + '\n');
JS
cd -- "$SNAPSHOT"
run node "$TOOLING/package-backend-release.mjs" --root "$SNAPSHOT" --source-sha "$SOURCE_SHA" \
  --output "$OUTPUT" --source-manifest "$SOURCE_MANIFEST"
