// Current AI-19 AST/hash delta only; does not rewrite historical stage evidence.
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require('../nodia-server/node_modules/typescript');
const target = 'docs/mvp/nodia-ai-current-endpoints.json';
const inventory = JSON.parse(fs.readFileSync(target, 'utf8'));
const moduleSources = [
  ['nodia-server/src/nodia-ai-execution/nodia-ai-execution.module.ts', 'NodiaAiExecutionModule'],
  ['nodia-server/src/nodia-ai-finance-effect/nodia-ai-finance-effect.module.ts', 'NodiaAiFinanceEffectModule'],
  ['nodia-server/src/nodia-ai/nodia-ai.module.ts', 'NodiaAiModule'],
];
for (const [file, name] of moduleSources) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === name);
  if (!declaration) throw Error('Missing module ' + name);
  const decorators = ts.canHaveDecorators(declaration) ? ts.getDecorators(declaration) ?? [] : [];
  const decorator = decorators.find(node => ts.isCallExpression(node.expression) && node.expression.expression.getText(source) === 'Module')?.expression;
  const argument = decorator?.arguments[0];
  if (!argument || !ts.isObjectLiteralExpression(argument)) throw Error('Missing module metadata ' + name);
  const identifiers = key => {
    const value = argument.properties.find(node => node.name?.getText(source) === key)?.initializer;
    return value && ts.isArrayLiteralExpression(value) ? value.elements.filter(ts.isIdentifier).map(node => node.text) : [];
  };
  const previous = inventory.modules.find(module => module.module === name);
  inventory.modules = inventory.modules.filter(module => module.module !== name);
  inventory.modules.push({ ...previous, module: name, file, line: source.getLineAndCharacterOfPosition(declaration.getStart(source)).line + 1, controllers: identifiers('controllers'), imports: identifiers('imports') });
}
inventory.modules.sort((left, right) => left.module.localeCompare(right.module));
Object.assign(inventory.counts, {
  localModules: inventory.modules.length,
  staticallyComposedModules: inventory.modules.filter(module => !module.conditional).length,
  conditionalModules: inventory.modules.filter(module => module.conditional).length,
});
const files = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(directory + '/' + entry.name) : [directory + '/' + entry.name]);
const newSources = ['nodia-server/src/nodia-ai-execution', 'nodia-server/src/nodia-ai-finance-effect'].flatMap(files).filter(file => file.endsWith('.ts') && !file.endsWith('.spec.ts'));
newSources.push('nodia-server/src/migrations/1792600000000-FreezeNodiaAiFinancialWitness.ts');
inventory.sourceChecksums = [...new Set([...inventory.sourceChecksums.map(source => source.file), ...newSources])].sort().map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }));
inventory.ai19 = { date: '2026-10-17', scope: 'Current AST internal financial-effect delta; no new HTTP/MCP routes or production execution admission', newModules: ['NodiaAiExecutionModule', 'NodiaAiFinanceEffectModule'], newControllers: [], newHandlers: [] };
fs.writeFileSync(target, JSON.stringify(inventory, null, 2) + '\n');
console.log(JSON.stringify({ counts: inventory.counts, hashes: inventory.sourceChecksums.length, ai19: inventory.ai19 }));
