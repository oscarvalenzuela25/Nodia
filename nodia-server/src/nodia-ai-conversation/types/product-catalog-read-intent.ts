const priceRequests = [
  /^(?:(?:dame|muestrame|lista|listar|enumera|quiero ver|me (?:das|muestras|puedes (?:dar|mostrar|listar))|(?:puedes|podrias) (?:darme|mostrarme|listar)) )?(?:(?:(?:el|la|un|una) )?(?:lista|listado|catalogo) de )?(?:(?:los|mis) )?productos (?:con|y) (?:(?:el|los|su|sus) )?precios?(?: de venta)?/i,
  /^(?:cuanto cuestan|a que precio estan) (?:(?:los|mis) )?productos/i,
  /^(?:(?:cuales son|dame|muestrame|quiero ver) )?(?:el |los )?precios?(?: de venta)? de (?:(?:los|mis) )?productos/i,
  /^(?:(?:(?:can|could|would) you )?(?:list|show(?: me)?|give me) )?(?:(?:a |the )?(?:list|catalog) of )?(?:(?:the|my) )?(?:products|product list) (?:with|and) (?:(?:their|the) )?prices?/i,
  /^how much do (?:(?:the|my) )?products cost/i,
  /^(?:what are )?(?:the )?prices? (?:of|for) (?:(?:the|my) )?products/i,
];

const countRequests = [
  /^(?:(?:puedes|podrias) decirme |me (?:puedes|podrias) decir |dime )?cuantos productos (?:tiene|hay en) (.+)$/i,
  /^(?:(?:can|could|would) you tell me )?how many products does (.+) have$/i,
  /^(?:(?:can|could|would) you tell me )?how many products are (?:there )?in (.+)$/i,
];

const displayInstructions = [
  /^(?:muestrame|muestra|indica) el precio (?:de venta )?vigente(?: en [a-z]{3})?(?: con una fila por producto)?(?: e indica el precio regular si esta en oferta)?[.]?$/i,
  /^(?:show|include) the current (?:selling )?price(?: in [a-z]{3})?(?: with one row per product)?(?: and (?:include|show) the regular price if on sale)?[.]?$/i,
];

const catalogListRequests =
  /^(?:(?:ve y )?buscame|busca|dame|lista|listame|muestrame) (?:(?:la|el) )?(?:lista|listado|catalogo) de (?:los )?productos(?: activos)? (?:de|del) (.+)$/i;

const catalogPreview =
  /^(?:muestrame|muestra) (?:los )?primeros (?:[1-9][0-9]?|100)(?: productos)?(?: ordenados por nombre)? con (?:su|el|sus|los) precios?(?: de venta)? vigentes?(?: en [a-z]{3})?(?: y (?:dime|muestra|indica) cuantos productos(?: activos)? hay(?: en total)?)?[.]?$/i;

const mixedScope =
  /\b(?:y|e|o|u|and|or|then|tambien|ademas|luego|despues|pero|but|si|if|sin|without|actualiz\w*|modific\w*|cambi\w*|baja\w*|sube\w*|ajust\w*|reduc\w*|increment\w*|aument\w*|edit\w*|crea\w*|agreg\w*|anad\w*|borr\w*|elimin\w*|vend\w*|registra\w*|confirm\w*|anul\w*|export\w*|import\w*|delete\w*|updat\w*|chang\w*|add\w*|creat\w*|remove\w*|sell\w*|stock|inventario|inventory|ventas|sales|reservas|bookings|servicios|services|facturas|invoices|proveedores|suppliers|precio|precios|price|prices|productos|products)\b/i;

function isBusinessName(scope: string, allowLowercase: boolean): boolean {
  if (/^(?:mi negocio|mi tienda|my business|my shop|my store)$/i.test(scope))
    return true;

  const name = allowLowercase
    ? scope.replace(
        /^(?:la tienda|el negocio|the business|the shop|the store)(?: |$)/i,
        '',
      )
    : scope;
  const boundedName = allowLowercase
    ? /^[a-z][a-z0-9'-]*(?: [a-z][a-z0-9'-]*){0,7}$/i
    : /^[A-Z][a-z0-9'-]*(?: [A-Z][a-z0-9'-]*){0,7}$/;
  return boundedName.test(name) && !mixedScope.test(name);
}

function isBusinessScope(suffix: string): boolean {
  if (!suffix) return true;
  const scope = /^ (?:de|del|for) (.+)$/i.exec(suffix)?.[1];
  return scope !== undefined && isBusinessName(scope, false);
}

/**
 * Recognizes a narrow read request for routing. The result confers no module
 * grant, tool permission, business identity or access to any record.
 */
export function isProductCatalogReadIntent(
  text: string,
  mode?: 'agentic' | 'api_key',
): boolean {
  if (text.length > 512 || /[\r\n]/.test(text)) return false;

  const input = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .replace(/[ \t]+/g, ' ');
  const requestText =
    mode === 'api_key'
      ? input.replace(/\b(Sr|Sra)\.(?= [a-z])/gi, '$1')
      : input;
  const clauses = /^¿?([^¿?!.]+?)(?:[?.](?: (.+))?)?$/.exec(requestText);
  if (!clauses) return false;

  const [, question, display] = clauses;
  const request = question
    .replace(/^(?:por favor|please),? /i, '')
    .replace(/,? (?:por favor|please)$/i, '');
  if (mode === 'api_key' && (!display || catalogPreview.test(display))) {
    const scope = catalogListRequests.exec(request)?.[1];
    if (scope !== undefined && isBusinessName(scope, true)) return true;
  }
  if (display && !displayInstructions.some((pattern) => pattern.test(display)))
    return false;
  if (
    !display &&
    countRequests.some((pattern) => {
      const name = pattern.exec(request)?.[1];
      return name !== undefined && isBusinessName(name, true);
    })
  )
    return true;

  return priceRequests.some((pattern) => {
    const match = pattern.exec(request);
    return !!match && isBusinessScope(request.slice(match[0].length));
  });
}
