import { NODIA_CV_CONTROLLER, NODIA_CV_ROUTE } from '../nodia-cv/types/nodia-cv-profile.types.js';

export type HttpModulePolicy = {
  routes: readonly string[];
  match: 'all' | 'any';
};

const USERS = '/users';
const ROLES = '/roles';
const ACTIONS = '/actions';
const MODULES = '/modules';
const AI = '/ai-providers';
const BUSINESS = '/business';

const personalNewsOperations = new Set([
  'GET connections',
  'GET articles',
  'POST connections/:provider',
  'POST connections/:provider/test',
  'POST connections/:provider/refresh',
  'DELETE connections/:provider',
]);

const nodiaCvOperations = new Set([
  'GET profiles',
  'GET profiles/:id',
  'POST profiles',
  'PUT profiles/:id',
  'DELETE profiles/:id',
  'GET ai-selection/catalog',
  'GET ai-selection/eligibility',
  'POST generations',
  'GET generations/:id',
  'GET generations/requests/:key',
  'PUT drafts/:id',
  'POST drafts/:id/ai-edits',
  'POST drafts/:id/pdf',
  'POST drafts/:id/application-documents/pdf',
  'GET drafts/:id/pdf/:artifactId',
  'GET versions',
  'POST versions',
  'GET versions/:id',
  'POST versions/:id/draft-copy',
  'DELETE versions/:id',
  'GET versions/:id/pdf',
]);

const ownWebPushOperations = new Set([
  'GET config',
  'GET installations/:installationId',
  'PUT installations/:installationId',
  'DELETE installations/:installationId',
]);

const moduleByControllerPath: Readonly<Record<string, string>> = {
  user: USERS,
  users: USERS,
  role: ROLES,
  roles: ROLES,
  action: ACTIONS,
  actions: ACTIONS,
  module: MODULES,
  modules: MODULES,
  'module-group': MODULES,
  'module-groups': MODULES,
  'ai-provider': AI,
  'ai-providers': AI,
  'ai-api-key': AI,
  'ai-api-keys': AI,
  'ai-provider-event': AI,
  'ai-provider-events': AI,
  business: BUSINESS,
  businesses: BUSINESS,
  'businesses/:businessId': BUSINESS,
  'businesses/:businessId/lists': BUSINESS,
  'business-cash-categories': BUSINESS,
  'business-cash-movements': BUSINESS,
  'business-action': BUSINESS,
  'business-actions': BUSINESS,
  provider: BUSINESS,
  providers: BUSINESS,
  'providers/:providerId/contacts': BUSINESS,
  invoice: BUSINESS,
  invoices: BUSINESS,
  product: BUSINESS,
  products: BUSINESS,
  'product-log': BUSINESS,
  'product-logs': BUSINESS,
};

const auxiliaryCatalogReaders: Readonly<Record<string, readonly string[]>> = {
  role: [ROLES, USERS],
  roles: [ROLES, USERS],
  action: [ACTIONS, ROLES],
  actions: [ACTIONS, ROLES],
  module: [MODULES, USERS],
  modules: [MODULES, USERS],
};

const normalize = (path: string) => path.replace(/^\/+|\/+$/g, '');

function policyForPath(
  controllerPath: string,
  handlerPaths: readonly string[],
  method: string,
): HttpModulePolicy | undefined {
  const path = normalize(controllerPath);
  if (path === 'auth') return { routes: [], match: 'all' };
  if (path === 'news/personal' && handlerPaths.length === 1 &&
      personalNewsOperations.has(`${method} ${normalize(handlerPaths[0])}`)) {
    return { routes: [], match: 'all' };
  }
  if (path === 'notifications/web-push') {
    return handlerPaths.length === 1 &&
      ownWebPushOperations.has(`${method} ${normalize(handlerPaths[0])}`)
      ? { routes: [], match: 'all' }
      : undefined;
  }
  if (path === 'businesses/:businessId/notification-preferences') {
    return handlerPaths.length === 1 &&
      normalize(handlerPaths[0]) === 'provider-visits' &&
      (method === 'GET' || method === 'PUT')
      ? { routes: [BUSINESS], match: 'all' }
      : undefined;
  }
  // Only this exact operation is session-only here; its use case checks current super_admin.
  if (
    path === 'news' &&
    method === 'POST' &&
    handlerPaths.length === 1 &&
    normalize(handlerPaths[0]) === 'refresh'
  ) {
    return { routes: [], match: 'all' };
  }
  if (path === NODIA_CV_CONTROLLER) {
    return handlerPaths.length === 1 &&
      nodiaCvOperations.has(`${method} ${normalize(handlerPaths[0])}`)
      ? { routes: [NODIA_CV_ROUTE], match: 'all' }
      : undefined;
  }
  if (path === 'teacher' || path.startsWith('teacher/')) {
    return { routes: ['/nodia-teacher'], match: 'all' };
  }
  if (
    path === 'authorization' &&
    method === 'GET' &&
    handlerPaths.length > 0 &&
    handlerPaths.every((value) => normalize(value) === 'context')
  ) {
    return { routes: [], match: 'all' };
  }
  if (path === 'nodia-ai' || path.startsWith('nodia-ai/')) {
    return { routes: ['/nodia-ai'], match: 'all' };
  }
  if (path.startsWith('finance/')) {
    return { routes: ['/finances-personal'], match: 'all' };
  }
  if (path.startsWith('rental/')) {
    return { routes: ['/reservations'], match: 'all' };
  }
  if (path === 'businesses/:businessId/cash-mutation-requests') {
    return method === 'GET' && handlerPaths.length === 1 && normalize(handlerPaths[0]) === ':key'
      ? { routes: [BUSINESS], match: 'all' }
      : undefined;
  }
  if (
    (path === 'ai-provider' || path === 'ai-providers') &&
    method === 'GET' &&
    handlerPaths.length === 1 &&
    normalize(handlerPaths[0]) === 'topbar-status'
  ) {
    return { routes: [AI, BUSINESS], match: 'any' };
  }
  // These exact list handlers supply selectors in the corresponding editor.
  // A shared list never grants access to detail handlers or to catalog writes.
  if (
    method === 'GET' &&
    handlerPaths.length > 0 &&
    handlerPaths.every((value) => normalize(value) === '')
  ) {
    const readers = Object.hasOwn(auxiliaryCatalogReaders, path)
      ? auxiliaryCatalogReaders[path]
      : undefined;
    if (readers) return { routes: readers, match: 'any' };
  }
  const route = Object.hasOwn(moduleByControllerPath, path)
    ? moduleByControllerPath[path]
    : undefined;
  return route ? { routes: [route], match: 'all' } : undefined;
}

/** Resolve Nest route metadata, never an untrusted request URL or path prefix. */
export function resolveHttpModulePolicy(
  controllerPaths: readonly string[],
  handlerPaths: readonly string[],
  method: string,
): HttpModulePolicy | undefined {
  if (controllerPaths.length === 0) return undefined;
  const policies = controllerPaths.map((path) =>
    policyForPath(path, handlerPaths, method),
  );
  const first = policies[0];
  if (
    !first ||
    policies.some(
      (policy) =>
        !policy ||
        policy.match !== first.match ||
        policy.routes.join('\0') !== first.routes.join('\0'),
    )
  )
    return undefined;
  return first;
}
