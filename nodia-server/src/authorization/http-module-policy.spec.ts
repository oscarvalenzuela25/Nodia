import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { resolveHttpModulePolicy } from './http-module-policy.js';

describe('HTTP module policy', () => {
  it.each([
    [['user', 'users'], '/users'],
    [['role', 'roles'], '/roles'],
    [['action', 'actions'], '/actions'],
    [['module-group', 'module-groups'], '/modules'],
    [['ai-provider', 'ai-providers'], '/ai-providers'],
    [['ai-api-key', 'ai-api-keys'], '/ai-providers'],
    [['ai-provider-event', 'ai-provider-events'], '/ai-providers'],
    [['invoice', 'invoices'], '/business'],
    [['providers/:providerId/contacts'], '/business'],
    [['finance/movements'], '/finances-personal'],
    [['rental/properties/:propertyId/reservations'], '/reservations'],
    [['nodia-ai/conversations'], '/nodia-ai'],
  ] as const)('requires the product module for %j', (paths, route) => {
    expect(resolveHttpModulePolicy(paths, [''], 'POST')).toEqual({
      routes: [route],
      match: 'all',
    });
  });

  it('keeps invoice OCR under Business rather than AI administration', () => {
    for (const handler of [
      'verify-ia-providers',
      'verify-ia-provider',
      'analyze',
    ]) {
      expect(
        resolveHttpModulePolicy(['invoice', 'invoices'], [handler], 'POST'),
      ).toEqual({ routes: ['/business'], match: 'all' });
    }
  });

  it.each([
    ['roles', ['/roles', '/users']],
    ['actions', ['/actions', '/roles']],
    ['modules', ['/modules', '/users']],
  ] as const)(
    'shares only the %s collection with its real editor consumers',
    (path, readers) => {
      expect(resolveHttpModulePolicy([path], [''], 'GET')).toEqual({
        routes: readers,
        match: 'any',
      });
      expect(resolveHttpModulePolicy([path], [':id'], 'GET')).toEqual({
        routes: [readers[0]],
        match: 'all',
      });
      expect(resolveHttpModulePolicy([path], [''], 'POST')).toEqual({
        routes: [readers[0]],
        match: 'all',
      });
    },
  );

  it('classifies session endpoints explicitly and denies unknown route families', () => {
    expect(resolveHttpModulePolicy(['auth'], ['me'], 'GET')).toEqual({
      routes: [],
      match: 'all',
    });
    expect(
      resolveHttpModulePolicy(['authorization'], ['context'], 'GET'),
    ).toEqual({ routes: [], match: 'all' });
    expect(
      resolveHttpModulePolicy(['authorization'], ['new-operation'], 'GET'),
    ).toBeUndefined();
    expect(
      resolveHttpModulePolicy(['invoices-unprotected'], [''], 'GET'),
    ).toBeUndefined();
    expect(
      resolveHttpModulePolicy(['new-resource'], [''], 'GET'),
    ).toBeUndefined();
    expect(
      resolveHttpModulePolicy(['constructor'], [''], 'GET'),
    ).toBeUndefined();
    expect(resolveHttpModulePolicy(['toString'], [''], 'POST')).toBeUndefined();
    expect(
      resolveHttpModulePolicy(['users', 'roles'], [''], 'POST'),
    ).toBeUndefined();
  });

  it('classifies every current nonpublic HTTP handler, including aliases', () => {
    const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
    const routeDecorators = new Map([
      ['Get', 'GET'],
      ['Post', 'POST'],
      ['Put', 'PUT'],
      ['Patch', 'PATCH'],
      ['Delete', 'DELETE'],
      ['Head', 'HEAD'],
      ['Options', 'OPTIONS'],
      ['All', 'ALL'],
    ]);
    const decorators = (node: ts.Node) =>
      ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
    const calls = (node: ts.Node) =>
      decorators(node)
        .map((item) => item.expression)
        .filter(ts.isCallExpression);
    const name = (call: ts.CallExpression) =>
      ts.isIdentifier(call.expression) ? call.expression.text : '';
    const literalPaths = (argument: ts.Expression | undefined): string[] => {
      if (!argument) return [''];
      if (ts.isStringLiteral(argument)) return [argument.text];
      if (ts.isArrayLiteralExpression(argument)) {
        return argument.elements.map((item) => {
          if (!ts.isStringLiteral(item))
            throw new Error(
              'Nonliteral controller alias requires explicit coverage',
            );
          return item.text;
        });
      }
      throw new Error(
        'Controller/handler paths require explicit coverage for nonliteral metadata',
      );
    };
    let checked = 0;
    for (const relativePath of globSync('**/*.controller.ts', {
      cwd: sourceRoot,
    })) {
      const source = ts.createSourceFile(
        relativePath,
        readFileSync(join(sourceRoot, relativePath), 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      for (const statement of source.statements) {
        if (!ts.isClassDeclaration(statement)) continue;
        const controller = calls(statement).find(
          (call) => name(call) === 'Controller',
        );
        if (!controller) continue;
        const controllerPaths = literalPaths(controller.arguments[0]);
        for (const member of statement.members) {
          const metadata = calls(member);
          if (metadata.some((call) => name(call) === 'Public')) continue;
          for (const handler of metadata) {
            const method = routeDecorators.get(name(handler));
            if (!method) continue;
            expect(
              resolveHttpModulePolicy(
                controllerPaths,
                literalPaths(handler.arguments[0]),
                method,
              ),
              `${relativePath}:${member.name?.getText(source)}`,
            ).toBeDefined();
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
