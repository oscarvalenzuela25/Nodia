/** Supplier codes use the database's character limit, including astral Unicode characters. */
export const productCodeFits = (value: string): boolean => [...value.trim()].length <= 255;
