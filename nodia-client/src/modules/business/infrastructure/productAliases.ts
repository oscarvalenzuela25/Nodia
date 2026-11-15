/** Alias is an optional copy chosen by the person, never a replacement for name. */
export const normalizeProductAlias = (value: string | null | undefined): string | null => value?.trim() || null;
export const productAliasFits = (value: string | null | undefined): boolean => value == null || [...value.trim()].length <= 255;
export const productAliasUsesName = (name: string, alias: string | null | undefined): boolean =>
  normalizeProductAlias(alias) === null || normalizeProductAlias(alias) === name.trim();
export const resolveProductAlias = (name: string, alias: string | null | undefined, useName: boolean): string | null =>
  normalizeProductAlias(useName ? name : alias);
