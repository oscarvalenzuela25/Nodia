const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
process.chdir(path.resolve(__dirname, '../../..'));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = read('docs/evidence/nodia-ai-ai33-validation.json');
assert.equal(report.stage, 'AI-33');
assert.equal(report.status, 'implemented_and_verified_in_lab');
for (const item of report.evidence) {
  assert.equal(sha(item.path), item.sha256, `Evidence changed: ${item.path}`);
}
for (const item of report.source_pins) {
  assert.equal(sha(item.path), item.sha256, `Implementation changed: ${item.path}`);
}
assert.equal(report.provider_generations, 0);
assert.equal(report.new_mcp_tools_published, 0);
const feature = fs.readFileSync('docs/nodia-ai/knowledge/nodia-ai/features/accepted-preferences.md', 'utf8');
const frontmatter = JSON.parse(feature.split('---')[1]);
assert.equal(frontmatter.document_status, 'draft');
assert.equal(frontmatter.integration_status, 'unregistered');
assert.equal(frontmatter.approval, null);
assert.equal(frontmatter.implementation.status, 'implemented');
assert.match(fs.readFileSync('docs/mvp/45-nodia-ai-implementation-plan.md', 'utf8'), /\[x\] \*\*AI-33/);
assert.match(fs.readFileSync('docs/architecture/decisions/ADR-058-nodia-ai-accepted-preferences.md', 'utf8'), /Estado: propuesto/);
console.log(JSON.stringify({ stage: 'AI-33', status: 'passed', evidence: report.evidence.length, source_pins: report.source_pins.length, approvals_preserved: true }));
