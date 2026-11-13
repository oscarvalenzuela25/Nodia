#!/usr/bin/env bash
# Invoke compiled/offline readers directly. npm wrappers here would build again.
set -euo pipefail
test -f dist/main.js
test -f dist/nodia-ai-worker.js
node test/build-assets.integration.mjs
node --test --test-concurrency=2 \
  test/nodia-ai-catalog.spec.mjs \
  test/nodia-ai-catalog-runtime.spec.mjs \
  test/nodia-ai-common-contract-fixtures.spec.mjs \
  test/nodia-ai-knowledge-compiler.spec.mjs \
  test/nodia-ai-knowledge-links.spec.mjs \
  test/nodia-ai-knowledge-pin.spec.mjs \
  test/nodia-ai-backup-database.spec.mjs \
  test/nodia-ai-sales-readonly-publication.spec.mjs \
  test/published-canary-catalog.spec.mjs \
  test/retire-web-ai-modes-cli.spec.mjs \
  test/teacher-qualification-cli.spec.mjs \
  test/nodia-ai-ai40-recovery-contract.spec.mjs \
  test/nodia-ai-ai40-audio-diagnostic.spec.mjs
node scripts/check-nodia-ai-contracts.mjs
node scripts/check-nodia-ai-knowledge.mjs
