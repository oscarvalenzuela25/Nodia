// Current inventory only; historical stage records retain their original meaning.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'nodia-server/node_modules/typescript'));
const file = 'docs/mvp/nodia-ai-current-endpoints.json';
const inventory = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const historical = JSON.stringify(Object.fromEntries(Object.entries(inventory).filter(([key]) => /^ai\d/.test(key) && key !== 'ai31')));
for (const name of ['NodiaAiReportsModule', 'NodiaAiToolsModule', 'NodiaAiContextModule']) {
  const previous = inventory.modules.find(module => module.module === name);
  if (!previous) throw Error(`Missing ${name}`);
  const ast = ts.createSourceFile(previous.file, fs.readFileSync(path.join(root, previous.file), 'utf8'), ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === name);
  const decorators = ts.getDecorators(declaration) || [];
  const metadata = decorators.find(node => ts.isCallExpression(node.expression) && node.expression.expression.getText(ast) === 'Module').expression.arguments[0];
  const references = key => {
    const property = metadata.properties.find(node => node.name?.getText(ast) === key);
    if (!property) return [];
    if (!ts.isPropertyAssignment(property) || !ts.isArrayLiteralExpression(property.initializer)) throw Error(`Unresolved ${name}.${key}`);
    return property.initializer.elements.filter(ts.isIdentifier).map(node => node.text);
  };
  Object.assign(previous, { line: ast.getLineAndCharacterOfPosition(declaration.getStart(ast)).line + 1, controllers: references('controllers'), imports: references('imports') });
}
const walk = folder => fs.readdirSync(path.join(root, folder), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(`${folder}/${entry.name}`) : [`${folder}/${entry.name}`]);
const added = walk('nodia-server/src/nodia-ai-reports').filter(file => file.endsWith('.ts') && !file.endsWith('.spec.ts'));
added.push('nodia-server/src/nodia-ai-tools/use-case/nodia-ai-report-tools.use-case.ts');
const files = [...new Set([...inventory.sourceChecksums.map(item => item.file), ...added])].sort();
inventory.sourceChecksums = files.map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') }));
inventory.ai31 = { date: '2026-10-17', scope: 'Bounded cross-source reports, independently versioned technical read helpers and reauthorized durable chat presentation', technicalTools: ['nodia_reports_describe', 'nodia_reports_run'], newControllers: [], newHandlers: [], newHttpRoutes: 0, databaseMigrations: 0, newTables: 0, newColumns: [], publishedKnowledgeChanged: false };
if (historical !== JSON.stringify(Object.fromEntries(Object.entries(inventory).filter(([key]) => /^ai\d/.test(key) && key !== 'ai31')))) throw Error('Historical inventory changed');
fs.writeFileSync(path.join(root, file), JSON.stringify(inventory, null, 2) + '\n');
console.log(JSON.stringify({ counts: inventory.counts, checksums: inventory.sourceChecksums.length, ai31: inventory.ai31 }));
