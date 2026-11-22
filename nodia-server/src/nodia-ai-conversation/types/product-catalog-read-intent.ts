const requests = [
  /^(?:(?:dame|muestrame|lista|listar|enumera|quiero ver|me (?:das|muestras|puedes (?:dar|mostrar|listar))|(?:puedes|podrias) (?:darme|mostrarme|listar)) )?(?:(?:(?:el|la|un|una) )?(?:lista|listado|catalogo) de )?(?:(?:los|mis) )?productos (?:con|y) (?:(?:el|los|su|sus) )?precios?(?: de venta)?/i,
  /^(?:cuanto cuestan|a que precio estan) (?:(?:los|mis) )?productos/i,
  /^(?:(?:cuales son|dame|muestrame|quiero ver) )?(?:el |los )?precios?(?: de venta)? de (?:(?:los|mis) )?productos/i,
  /^(?:(?:(?:can|could|would) you )?(?:list|show(?: me)?|give me) )?(?:(?:a |the )?(?:list|catalog) of )?(?:(?:the|my) )?(?:products|product list) (?:with|and) (?:(?:their|the) )?prices?/i,
  /^how much do (?:(?:the|my) )?products cost/i,
  /^(?:what are )?(?:the )?prices? (?:of|for) (?:(?:the|my) )?products/i,
];

const displayInstructions = [
  /^(?:muestrame|muestra|indica) el precio (?:de venta )?vigente(?: en [a-z]{3})?(?: con una fila por producto)?(?: e indica el precio regular si esta en oferta)?[.]?$/i,
  /^(?:show|include) the current (?:selling )?price(?: in [a-z]{3})?(?: with one row per product)?(?: and (?:include|show) the regular price if on sale)?[.]?$/i,
];

function isBusinessScope(suffix: string): boolean {
  if (!suffix) return true;

  const scope = /^ (?:de|del|for) (.+)$/i.exec(suffix)?.[1];
  if (!scope) return false;
  if (/^(?:mi negocio|mi tienda|my business|my shop|my store)$/i.test(scope))
    return true;

  // Only bounded names written as proper nouns can occupy this optional slot.
  return (
    /^[A-Z][a-z0-9'-]*(?: [A-Z][a-z0-9'-]*){0,7}$/.test(scope) &&
    !/\b(?:y|e|o|u|and|or|then|tambien|ademas|luego|despues|pero|but|si|if|sin|without|actualiz\w*|modific\w*|cambi\w*|baja\w*|sube\w*|ajust\w*|reduc\w*|increment\w*|aument\w*|edit\w*|crea\w*|agreg\w*|anad\w*|borr\w*|elimin\w*|vend\w*|registra\w*|confirm\w*|anul\w*|export\w*|import\w*|delete\w*|updat\w*|chang\w*|add\w*|creat\w*|remove\w*|sell\w*|stock|inventario|inventory|ventas|sales|reservas|bookings|servicios|services|facturas|invoices|proveedores|suppliers|precio|precios|price|prices|productos|products)\b/i.test(
      scope,
    )
  );
}

/**
 * Recognizes a narrow read request for routing. The result confers no module
 * grant, tool permission, business identity or access to any record.
 */
export function isProductCatalogReadIntent(text: string): boolean {
  if (text.length > 512 || /[\r\n]/.test(text)) return false;

  const input = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .replace(/[ \t]+/g, ' ');
  const clauses = /^¿?([^¿?!.]+?)(?:[?.](?: (.+))?)?$/.exec(input);
  if (!clauses) return false;

  const [, question, display] = clauses;
  if (display && !displayInstructions.some((pattern) => pattern.test(display)))
    return false;

  const request = question
    .replace(/^(?:por favor|please),? /i, '')
    .replace(/,? (?:por favor|please)$/i, '');
  return requests.some((pattern) => {
    const match = pattern.exec(request);
    return !!match && isBusinessScope(request.slice(match[0].length));
  });
}
