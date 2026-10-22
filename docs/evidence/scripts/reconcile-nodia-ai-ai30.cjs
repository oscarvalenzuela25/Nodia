// Refresh only the current source inventory. Historical stage evidence is immutable here.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'nodia-server/node_modules/typescript'));
const destination = path.join(root, 'docs/mvp/nodia-ai-current-endpoints.json');
const inventory = JSON.parse(fs.readFileSync(destination, 'utf8'));
const historical = JSON.stringify(Object.fromEntries(Object.entries(inventory).filter(([key]) => /^ai\d/.test(key) && key !== 'ai30')));
const relativeModuleFiles = [
  ['nodia-server/src/nodia-ai-reports/nodia-ai-reports.module.ts', 'NodiaAiReportsModule'],
  ['nodia-server/src/nodia-ai-tools/nodia-ai-tools.module.ts', 'NodiaAiToolsModule'],
];

function sourceFile(file) {
  return ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
}
for (const [file, name] of relativeModuleFiles) {
  const ast = sourceFile(file);
  const declaration = ast.statements.find((node) => ts.isClassDeclaration(node) && node.name?.text === name);
  if (!declaration) throw new Error(`Missing module ${name}`);
  const decorators = ts.canHaveDecorators(declaration) ? ts.getDecorators(declaration) || [] : [];
  const decorator = decorators.find((node) => ts.isCallExpression(node.expression) && node.expression.expression.getText(ast) === 'Module');
  const metadata = decorator?.expression.arguments[0];
  if (!metadata || !ts.isObjectLiteralExpression(metadata)) throw new Error(`Unresolved module ${name}`);
  const references = (key) => {
    const property = metadata.properties.find((node) => node.name?.getText(ast) === key);
    if (!property) return [];
    if (!ts.isPropertyAssignment(property) || !ts.isArrayLiteralExpression(property.initializer)) throw new Error(`Unresolved ${name}.${key}`);
    return property.initializer.elements.filter(ts.isIdentifier).map((node) => node.text);
  };
  const previous = inventory.modules.find((module) => module.module === name);
  const module = {
    ...previous,
    module: name,
    file,
    line: ast.getLineAndCharacterOfPosition(declaration.getStart(ast)).line + 1,
    controllers: references('controllers'),
    imports: references('imports'),
  };
  if (name === 'NodiaAiReportsModule' && module.controllers.length) throw new Error('AI-30 has no public controller');
  if (name === 'NodiaAiToolsModule' && !module.imports.includes('NodiaAiReportsModule')) throw new Error('Missing internal reports composition');
  inventory.modules = inventory.modules.filter((item) => item.module !== name);
  inventory.modules.push(module);
}
inventory.modules.sort((left, right) => left.module.localeCompare(right.module));
Object.assign(inventory.counts, {
  localModules: inventory.modules.length,
  staticallyComposedModules: inventory.modules.filter((module) => !module.conditional).length,
  conditionalModules: inventory.modules.filter((module) => module.conditional).length,
});

const listFiles = (directory) => fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
  const file = `${directory}/${entry.name}`;
  return entry.isDirectory() ? listFiles(file) : [file];
});
const added = listFiles('nodia-server/src/nodia-ai-reports').filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'));
const files = [...new Set([...inventory.sourceChecksums.map((item) => item.file), ...added, ...relativeModuleFiles.map(([file]) => file)])].sort();
inventory.sourceChecksums = files.map((file) => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') }));

const catalog = sourceFile('nodia-server/src/nodia-ai-reports/config/report-sources.ts');
let registeredSources;
for (const statement of catalog.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (declaration.name.getText(catalog) !== 'NODIA_AI_REPORT_SOURCES') continue;
    const initializer = declaration.initializer;
    if (!initializer || !ts.isCallExpression(initializer) || initializer.expression.getText(catalog) !== 'deepFreeze' || !ts.isArrayLiteralExpression(initializer.arguments[0])) throw new Error('Unresolved report source array');
    const entries = initializer.arguments[0].elements;
    if (entries.some((entry) => !ts.isCallExpression(entry) || !['source', 'paymentSource'].includes(entry.expression.getText(catalog)))) throw new Error('Unresolved report source entry');
    registeredSources = entries.length;
  }
}
if (registeredSources !== 11) throw new Error('AI-30 source count requires explicit reconciliation');
inventory.ai30 = {
  date: '2026-10-17',
  scope: 'Internal typed source registry and restricted single-source report compiler/executor; no report tools, cross-source presentation or new HTTP routes published',
  internalReports: {
    registeredSources,
    sqlMappingsPublic: false,
    queryCombination: 'single_source_separate',
    publishedTools: 0,
  },
  newControllers: [],
  newHandlers: [],
  newHttpRoutes: 0,
  databaseMigrations: 0,
  newTables: 0,
  newColumns: [],
  newModules: ['NodiaAiReportsModule'],
};
const afterHistorical = JSON.stringify(Object.fromEntries(Object.entries(inventory).filter(([key]) => /^ai\d/.test(key) && key !== 'ai30')));
if (historical !== afterHistorical) throw new Error('Historical stage inventory was altered');
fs.writeFileSync(destination, `${JSON.stringify(inventory, null, 2)}\n`);
console.log(JSON.stringify({ counts: inventory.counts, checksums: inventory.sourceChecksums.length, ai30: inventory.ai30 }));
