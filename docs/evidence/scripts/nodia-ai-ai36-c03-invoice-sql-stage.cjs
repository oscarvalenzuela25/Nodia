// Package only current compiled outputs and explicit synthetic fixture sources.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  cp = require("node:child_process");
const root = path.resolve(__dirname, "../../.."),
  server = path.join(root, "nodia-server");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const walk = (relative) =>
  fs
    .readdirSync(path.join(server, relative), { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(relative + "/" + entry.name)
        : [relative + "/" + entry.name],
    );
const compiled = walk("dist").sort();
const input = [
  ...compiled,
  "package.json",
  "package-lock.json",
  "test/nodia-ai.integration.fixture.mjs",
  "test/nodia-ai-ai15.fixture.mjs",
  "test/nodia-ai-context-budget.fixture.mjs",
  "test/nodia-ai-ai36-invoice-analysis.integration.mjs",
  "test/nodia-ai-ai36-write-preparation.integration.mjs",
  "test/nodia-ai-ai36-secure-preparation.integration.mjs",
  "scripts/nodia-ai-knowledge/contracts.schema.json",
];
const files = Object.fromEntries(
  input.map((relative) => [
    relative,
    hash(fs.readFileSync(path.join(server, relative))),
  ]),
);
fs.mkdirSync(path.join(server, ".tmp"), { recursive: true });
fs.mkdirSync(path.join(root, ".tmp"), { recursive: true });
const manifestPath = ".tmp/ai36-c03-invoice-sql-stage-manifest.json";
const manifest = {
  stage: "AI-36-C03",
  scope: "compiled_worker_mcp_invoice_analysis",
  fixture_namespace: "ai3603",
  compiled_files: compiled.length,
  configured_environment_included: false,
  files,
};
fs.writeFileSync(
  path.join(server, manifestPath),
  JSON.stringify(manifest, null, 2) + "\n",
);
const archive = path.join(root, ".tmp/ai36-c03-invoice-sql-stage.tar");
const listPath = ".tmp/ai36-c03-invoice-sql-stage-files.txt";
fs.writeFileSync(
  path.join(server, listPath),
  [...input, manifestPath].join("\n") + "\n",
);
cp.execFileSync("tar", ["-cf", archive, "-T", listPath], {
  cwd: server,
  stdio: "pipe",
});
console.log(
  JSON.stringify({
    stage: "AI-36-C03",
    compiled_files: compiled.length,
    manifest_sha256: hash(fs.readFileSync(path.join(server, manifestPath))),
    archive_sha256: hash(fs.readFileSync(archive)),
    archive_bytes: fs.statSync(archive).size,
    test_sha256: files["test/nodia-ai-ai36-invoice-analysis.integration.mjs"],
  }),
);
