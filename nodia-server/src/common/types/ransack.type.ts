/** Predicados soportados por Ransack */
export type RansackPredicate =
  | 'eq' // Coincidencia exacta (=)
  | 'not_eq' // Diferente (!=)
  | 'cont' // Contiene (ILIKE %val%)
  | 'not_cont' // No contiene (NOT ILIKE %val%)
  | 'start' // Empieza con (ILIKE val%)
  | 'end' // Termina con (ILIKE %val)
  | 'gt' // Mayor que (>)
  | 'gteq' // Mayor o igual (>=)
  | 'lt' // Menor que (<)
  | 'lteq' // Menor o igual (<=)
  | 'in' // En lista (IN (...))
  | 'not_in' // No en lista (NOT IN (...))
  | 'null' // Es nulo (IS NULL)
  | 'not_null'; // No es nulo (IS NOT NULL)

/** Construye dinámicamente las claves campo_predicado para cualquier entidad T */
export type RansackFilter<T> = {
  [K in keyof T as `${string & K}_${RansackPredicate}`]?: any;
} & {
  /** Ordenamiento: ej. "created_at desc" o ["name asc", "created_at desc"] */
  s?: string | string[];
};
