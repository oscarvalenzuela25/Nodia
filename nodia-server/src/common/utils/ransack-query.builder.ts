import { SelectQueryBuilder } from 'typeorm';

export function applyRansack<T extends object>(
  qb: SelectQueryBuilder<T>,
  q: Record<string, any> | undefined,
  alias: string,
): SelectQueryBuilder<T> {
  if (!q) return qb;

  Object.entries(q).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    // Manejo de ordenamiento: q[s]="created_at desc"
    if (key === 's' && typeof value === 'string') {
      const [field, direction] = value.trim().split(/\s+/);
      const safeDir = direction?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      qb.addOrderBy(`${alias}.${field}`, safeDir);
      return;
    }

    // Extraer predicado (lo que viene después del último guión bajo)
    const lastUnderscore = key.lastIndexOf('_');
    if (lastUnderscore === -1) return;

    const field = key.substring(0, lastUnderscore);
    const predicate = key.substring(lastUnderscore + 1);
    const paramName = `param_${field}_${predicate}`;

    switch (predicate) {
      case 'eq':
        qb.andWhere(`${alias}.${field} = :${paramName}`, {
          [paramName]: value,
        });
        break;
      case 'not_eq':
        qb.andWhere(`${alias}.${field} != :${paramName}`, {
          [paramName]: value,
        });
        break;
      case 'cont':
        qb.andWhere(`${alias}.${field} ILIKE :${paramName}`, {
          [paramName]: `%${value}%`,
        });
        break;
      case 'start':
        qb.andWhere(`${alias}.${field} ILIKE :${paramName}`, {
          [paramName]: `${value}%`,
        });
        break;
      case 'end':
        qb.andWhere(`${alias}.${field} ILIKE :${paramName}`, {
          [paramName]: `%${value}`,
        });
        break;
      case 'gt':
        qb.andWhere(`${alias}.${field} > :${paramName}`, {
          [paramName]: value,
        });
        break;
      case 'gteq':
        qb.andWhere(`${alias}.${field} >= :${paramName}`, {
          [paramName]: value,
        });
        break;
      case 'lt':
        qb.andWhere(`${alias}.${field} < :${paramName}`, {
          [paramName]: value,
        });
        break;
      case 'lteq':
        qb.andWhere(`${alias}.${field} <= :${paramName}`, {
          [paramName]: value,
        });
        break;
      case 'in':
        const arrayVal = Array.isArray(value) ? value : [value];
        qb.andWhere(`${alias}.${field} IN (:...${paramName})`, {
          [paramName]: arrayVal,
        });
        break;
      case 'null':
        qb.andWhere(`${alias}.${field} IS NULL`);
        break;
      case 'not_null':
        qb.andWhere(`${alias}.${field} IS NOT NULL`);
        break;
    }
  });

  return qb;
}
