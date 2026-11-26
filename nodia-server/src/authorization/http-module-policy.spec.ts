import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { resolveHttpModulePolicy } from './http-module-policy.js';

describe('HTTP module policy', () => {
  it('keeps personal installation management and business preferences under separate authority', () => {
    const installation = ['notifications/web-push'];
    for (const method of ['GET', 'PUT', 'DELETE']) {
      expect(
        resolveHttpModulePolicy(installation, ['installations/:installationId'], method),
      ).toEqual({ routes: [], match: 'all' });
    }
    expect(resolveHttpModulePolicy(installation, ['config'], 'GET')).toEqual({
      routes: [],
      match: 'all',
    });
    expect(resolveHttpModulePolicy(installation, ['config'], 'PUT')).toBeUndefined();
    expect(resolveHttpModulePolicy(installation, ['installations'], 'GET')).toBeUndefined();

    const preferences = ['businesses/:businessId/notification-preferences'];
    for (const method of ['GET', 'PUT']) {
      expect(resolveHttpModulePolicy(preferences, ['provider-visits'], method)).toEqual({
        routes: ['/business'],
        match: 'all',
      });
    }
    expect(resolveHttpModulePolicy(preferences, ['provider-visits'], 'DELETE')).toBeUndefined();
    expect(resolveHttpModulePolicy(preferences, ['other-type'], 'GET')).toBeUndefined();
  });

  it('requires the CV module for exact profile, generation, PDF and version operations', () => {
    const controller = ['nodia-cv'];
    for (const [method, path] of [
      ['GET', 'profiles'],
      ['GET', 'profiles/:id'],
      ['POST', 'profiles'],
      ['PUT', 'profiles/:id'],
      ['DELETE', 'profiles/:id'],
      ['GET', 'ai-selection/catalog'],
      ['GET', 'ai-selection/eligibility'],
      ['POST', 'generations'],
      ['GET', 'generations/:id'],
      ['GET', 'generations/requests/:key'],
      ['PUT', 'drafts/:id'],
      ['POST', 'drafts/:id/ai-edits'],
      ['POST', 'drafts/:id/pdf'],
      ['GET', 'drafts/:id/pdf/:artifactId'],
      ['GET', 'versions'],
      ['POST', 'versions'],
      ['GET', 'versions/:id'],
      ['DELETE', 'versions/:id'],
      ['POST', 'versions/:id/draft-copy'],
      ['GET', 'versions/:id/pdf'],
    ]) {
      expect(resolveHttpModulePolicy(controller, [path], method)).toEqual({
        routes: ['/nodia-cv'],
        match: 'all',
      });
    }
    expect(resolveHttpModulePolicy(controller, ['profiles/:id'], 'POST')).toBeUndefined();
    expect(resolveHttpModulePolicy(controller, ['generations/:id'], 'POST')).toBeUndefined();
    expect(resolveHttpModulePolicy(controller, ['versions/:id/pdf'], 'DELETE')).toBeUndefined();
    expect(resolveHttpModulePolicy(controller, ['profiles', 'generations'], 'GET')).toBeUndefined();
    expect(resolveHttpModulePolicy(['nodia-cv/profiles'], [''], 'GET')).toBeUndefined();
  });

  it('admits only the exact Personal News operations for an authenticated owner', () => {
    const controller = ['news/personal'];
    for (const [method, handler] of [
      ['GET', 'connections'], ['GET', 'articles'], ['POST', 'connections/:provider'],
      ['POST', 'connections/:provider/test'], ['POST', 'connections/:provider/refresh'],
      ['DELETE', 'connections/:provider'],
    ]) {
      expect(resolveHttpModulePolicy(controller, [handler], method)).toEqual({ routes: [], match: 'all' });
    }
    expect(resolveHttpModulePolicy(controller, ['articles'], 'POST')).toBeUndefined();
    expect(resolveHttpModulePolicy(controller, ['connections/:provider/export'], 'GET')).toBeUndefined();
    expect(resolveHttpModulePolicy(controller, ['connections', 'articles'], 'GET')).toBeUndefined();
  });
  it.each([
    [['user', 'users'], '/users'],
    [['role', 'roles'], '/roles'],
    [['action', 'actions'], '/actions'],
    [['module-group', 'module-groups'], '/modules'],
    [['ai-provider', 'ai-providers'], '/ai-providers'],
    [['ai-api-key', 'ai-api-keys'], '/ai-providers'],
    [['ai-provider-event', 'ai-provider-events'], '/ai-providers'],
    [['invoice', 'invoices'], '/business'],
    [['businesses/:businessId/lists'], '/business'],
    [['business-cash-categories'], '/business'],
    [['business-cash-movements'], '/business'],
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
    expect(
      resolveHttpModulePolicy(['invoice', 'invoices'], ['selectable-models'], 'GET'),
    ).toEqual({ routes: ['/business'], match: 'all' });
  });

  it('requires the canonical Business module for cash receipt reads only', () => {
    const controller = ['businesses/:businessId/cash-mutation-requests'];
    expect(resolveHttpModulePolicy(controller, [':key'], 'GET')).toEqual({
      routes: ['/business'],
      match: 'all',
    });
    expect(resolveHttpModulePolicy(controller, [':key'], 'PUT')).toBeUndefined();
    expect(resolveHttpModulePolicy(controller, [''], 'GET')).toBeUndefined();
  });

  it('uses the Business module for the monthly cash summary', () => {
    expect(
      resolveHttpModulePolicy(
        ['business-cash-movements'],
        ['monthly-summary'],
        'GET',
      ),
    ).toEqual({ routes: ['/business'], match: 'all' });
  });

  it('shares the exact Topbar status GET without opening AI administration', () => {
    const aliases = ['ai-provider', 'ai-providers'];
    expect(resolveHttpModulePolicy(aliases, ['topbar-status'], 'GET')).toEqual({
      routes: ['/ai-providers', '/business'],
      match: 'any',
    });
    for (const [handlers, method] of [
      [['topbar-status'], 'POST'],
      [['topbar-status/:id'], 'GET'],
      [['topbar-status', 'health'], 'GET'],
      [['health', 'health-check', 'verify-all'], 'GET'],
      [['models', 'selectable-models'], 'GET'],
      [[':id/session'], 'GET'],
      [[':id/session/login'], 'POST'],
      [['gemini-agentic-login/start'], 'POST'],
      [['gemini-agentic-login/logout'], 'POST'],
      [[':id'], 'PUT'],
    ] as const) {
      expect(resolveHttpModulePolicy(aliases, handlers, method)).toEqual({
        routes: ['/ai-providers'],
        match: 'all',
      });
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

  it('opens no News family: only exact refresh crosses to its current-super-admin use case', () => {
    expect(resolveHttpModulePolicy(['news'], ['refresh'], 'POST')).toEqual({
      routes: [],
      match: 'all',
    });
    for (const [handler, method] of [
      ['refresh', 'GET'],
      ['other', 'POST'],
      ['', 'POST'],
      ['refresh/:id', 'POST'],
    ]) {
      expect(
        resolveHttpModulePolicy(['news'], [handler], method),
      ).toBeUndefined();
    }
    expect(
      resolveHttpModulePolicy(['news'], ['refresh', 'other'], 'POST'),
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
