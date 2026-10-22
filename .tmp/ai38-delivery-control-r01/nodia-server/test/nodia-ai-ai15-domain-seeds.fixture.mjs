// Synthetic records for disposable PostgreSQL only. This file never publishes tools.
export async function seedAi15DomainReads(db, identities, fixtures) {
  const ownerId = identities.get('1').userId;
  const categoryId = fixtures.categories[0].id;
  const propertyId = fixtures.property.id;
  const reservationId = fixtures.reservation.id;
  const [group] = await db.query(
    "INSERT INTO finance_category_groups(user_id,name,key) VALUES($1,'Synthetic group','ai15_read_group') RETURNING id",
    [ownerId],
  );
  await db.query(
    'INSERT INTO finance_category_group_memberships(user_id,category_group_id,category_id) VALUES($1,$2,$3)',
    [ownerId, group.id, categoryId],
  );
  const [movement] = await db.query(
    'SELECT id FROM finance_movements WHERE user_id=$1 AND obligation_id IS NULL ORDER BY id LIMIT 1',
    [ownerId],
  );
  const [obligation] = await db.query(
    "INSERT INTO finance_obligations(user_id,name,key,type,amount,description) VALUES($1,'Synthetic loan','ai15_read_loan','loan',10000,'Read fixture') RETURNING id",
    [ownerId],
  );
  await db.query(
    "INSERT INTO finance_movements(user_id,category_id,obligation_id,name,amount,type,status) VALUES($1,$2,$3,'Synthetic initial loan',10000,'expense','paid'),($1,$2,$3,'Synthetic repayment',2500,'income','received')",
    [ownerId, categoryId, obligation.id],
  );

  const [policy] = await db.query(
    "INSERT INTO rental_cancellation_policies(property_id,name,created_by,updated_by) VALUES($1,'Synthetic read policy',$2,$2) RETURNING id",
    [propertyId, ownerId],
  );
  await db.query(
    'INSERT INTO rental_cancellation_rules(policy_id,min_days_before,refund_percent,created_by,updated_by) VALUES($1,0,50.00,$2,$2)',
    [policy.id, ownerId],
  );
  const [block] = await db.query(
    "INSERT INTO rental_blocks(property_id,starts_at,ends_at,reason,notes,created_by,updated_by) VALUES($1,'2027-01-20T15:00:00Z','2027-01-21T15:00:00Z','Synthetic maintenance',NULL,$2,$2) RETURNING id",
    [propertyId, ownerId],
  );
  const [expense] = await db.query(
    "INSERT INTO rental_expenses(property_id,reservation_id,name,category,amount,incurred_on,paid_on,status,created_by,updated_by) VALUES($1,$2,'Synthetic cleaning','cleaning',1000,'2027-01-12','2027-01-12','paid',$3,$3) RETURNING id",
    [propertyId, reservationId, ownerId],
  );
  const [payment] = await db.query(
    "INSERT INTO rental_payments(property_id,reservation_id,type,amount,occurred_on,method,status,created_by,updated_by) VALUES($1,$2,'payment',5000,'2027-01-09','Synthetic bank','confirmed',$3,$3) RETURNING id",
    [propertyId, reservationId, ownerId],
  );
  const [turnover] = await db.query(
    "INSERT INTO rental_turnovers(property_id,incoming_reservation_id,previous_reservation_id,linen_ready,cleaning_status,planned_ready_at,ready_at,created_by,updated_by) VALUES($1,$2,NULL,FALSE,'pending','2027-01-10T17:00:00Z',NULL,$3,$3) RETURNING id",
    [propertyId, reservationId, ownerId],
  );
  await db.query(
    "INSERT INTO rental_audit_events(property_id,actor_id,action,resource_type,resource_id,changes) VALUES($1,$2,'reservation.create','reservation',$3,'{\"private_payload\":\"must-not-be-projected\"}')",
    [propertyId, ownerId, reservationId],
  );
  // A separate unpaid draft exercises cancellation preview without changing or
  // confirming a reservation, and without fabricating an absent policy snapshot.
  const checkIn = new Date(Date.now() + 180 * 86400000)
    .toISOString()
    .slice(0, 10);
  const checkOut = new Date(Date.now() + 182 * 86400000)
    .toISOString()
    .slice(0, 10);
  const [draft] = await db.query(
    "INSERT INTO rental_reservations(property_id,guest_name,guest_contact,guests_count,channel,check_in_on,check_out_on,check_in_time,check_out_time,nightly_rate,total_amount,deposit_amount,status,created_by,updated_by) VALUES($1,'Synthetic unpaid draft','draft@example.invalid',1,'other',$2,$3,'15:00','11:00',10000,20000,0,'draft',$4,$4) RETURNING id",
    [propertyId, checkIn, checkOut, ownerId],
  );

  const scope = { property_id: propertyId };
  return {
    inputs: {
      nodia_finance_categories_get: { id: categoryId },
      nodia_finance_categories_list: {},
      nodia_finance_category_groups_get: { id: group.id },
      nodia_finance_category_groups_list: {},
      nodia_finance_movements_get: { id: movement.id },
      nodia_finance_movements_list: {},
      nodia_finance_obligations_get: { id: obligation.id },
      nodia_finance_obligations_list: {},
      nodia_finance_summaries_by_category: {},
      nodia_finance_summaries_by_category_group: {},
      nodia_finance_summaries_overview: {},
      nodia_rental_audit_list: scope,
      nodia_rental_blocks_get: { ...scope, id: block.id },
      nodia_rental_blocks_list: scope,
      nodia_rental_calendar_availability: {
        ...scope,
        query: {
          check_in_on: '2027-02-01',
          check_out_on: '2027-02-03',
          check_in_time: '15:00',
          check_out_time: '11:00',
        },
      },
      nodia_rental_calendar_calendar: {
        ...scope,
        query: { from_on: '2027-01-01', to_on: '2027-02-01' },
      },
      nodia_rental_cancellation_policies_get: { ...scope, id: policy.id },
      nodia_rental_cancellation_policies_list: scope,
      nodia_rental_collaborators_candidates: {
        ...scope,
        query: { search: 'example' },
      },
      nodia_rental_collaborators_list: scope,
      nodia_rental_expenses_get: { ...scope, id: expense.id },
      nodia_rental_expenses_list: scope,
      nodia_rental_payments_get: { ...scope, id: payment.id },
      nodia_rental_payments_list: scope,
      nodia_rental_properties_get: scope,
      nodia_rental_properties_list: {},
      nodia_rental_reservations_cancellation_preview: {
        ...scope,
        id: draft.id,
        command: { cancelled_at: new Date(Date.now() - 1000).toISOString() },
      },
      nodia_rental_reservations_get: { ...scope, id: reservationId },
      nodia_rental_reservations_list: scope,
      nodia_rental_summaries_overview: {
        ...scope,
        query: { from_on: '2027-01-01', to_on: '2027-02-01' },
      },
      nodia_rental_turnovers_get: { ...scope, id: turnover.id },
      nodia_rental_turnovers_list: scope,
    },
  };
}
