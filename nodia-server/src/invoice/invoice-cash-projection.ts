export interface InvoiceCashExpenseProjection {
  movement_id: string;
  category: { id: string; name: string; is_active: boolean };
}

/** TypeORM supplies the quoted invoice alias. The subquery follows the unique invoice link. */
export function invoiceCashExpenseProjection(invoice: string): string {
  return `SELECT jsonb_build_object(
    'movement_id', movement.id,
    'category', jsonb_build_object(
      'id', category.id::text, 'name', category.name, 'is_active', category.is_active
    )
  )
  FROM business_cash_movements movement
  JOIN business_cash_categories category
    ON category.id = movement.category_id AND category.business_id = movement.business_id
  WHERE movement.invoice_id = ${invoice}.id AND movement.business_id = ${invoice}.business_id
    AND NOT movement.withdrawn_from_invoice`;
}
