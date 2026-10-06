import { Injectable } from '@nestjs/common';
import { type EntityManager } from 'typeorm';
import { RentalProperty } from './entities/rental-property.entity.js';
import { RentalCancellationPolicy } from '../rental-cancellation-policy/entities/rental-cancellation-policy.entity.js';
import type { RentalConfigurationQueryDto } from './dto/rental-configuration-query.dto.js';

export interface ConfigurationTransition {
  previous_out: Date;
  incoming_at: Date;
  planned_ready_at: Date | null;
  linen_ready: boolean | null;
}

@Injectable()
export class RentalPropertyService {
  async findPage(
    manager: EntityManager,
    actorId: string,
    query: RentalConfigurationQueryDto,
  ): Promise<[RentalProperty[], number]> {
    const direction = query.q?.s === 'name desc' ? 'DESC' : 'ASC';
    const filter = query.q?.name_cont as string | undefined;
    const rows = await manager.query<(RentalProperty & { total: string })[]>(
      `WITH scoped AS (SELECT p.* FROM rental_properties p WHERE (p.owner_id=$1 OR EXISTS (SELECT 1 FROM rental_collaborators c WHERE c.property_id=p.id AND c.user_id=$1 AND c.is_active=TRUE)) AND ($2::boolean IS NULL OR p.is_active=$2) AND ($3::text IS NULL OR p.name ILIKE '%' || $3 || '%' ESCAPE '\\')) SELECT counts.total, page.* FROM (SELECT count(*)::text AS total FROM scoped) counts LEFT JOIN LATERAL (SELECT * FROM scoped ORDER BY name ${direction},id ASC LIMIT $4 OFFSET $5) page ON TRUE`,
      [
        actorId,
        query.active === 'all' ? null : query.active === 'active',
        filter?.replace(/[\\%_]/g, '\\$&') ?? null,
        query.limit,
        (query.page - 1) * query.limit,
      ],
    );
    const total = Number(rows[0].total);
    return [
      rows
        .filter((row) => row.id !== null)
        .map(({ total: _total, ...row }) =>
          Object.assign(new RentalProperty(), row),
        ),
      total,
    ];
  }

  insert(
    manager: EntityManager,
    data: Partial<RentalProperty>,
  ): Promise<RentalProperty> {
    const repository = manager.getRepository(RentalProperty);
    return repository.save(repository.create(data));
  }
  save(
    manager: EntityManager,
    property: RentalProperty,
  ): Promise<RentalProperty> {
    return manager.getRepository(RentalProperty).save(property);
  }
  findPolicy(
    manager: EntityManager,
    propertyId: string,
    id: string,
  ): Promise<RentalCancellationPolicy | null> {
    return manager
      .getRepository(RentalCancellationPolicy)
      .findOne({ where: { id, property_id: propertyId } });
  }
  async hasHistory(
    manager: EntityManager,
    propertyId: string,
  ): Promise<boolean> {
    const rows = await manager.query<{ found: boolean }[]>(
      `SELECT EXISTS(SELECT 1 FROM rental_reservations WHERE property_id=$1) OR EXISTS(SELECT 1 FROM rental_blocks WHERE property_id=$1) AS found`,
      [propertyId],
    );
    return rows[0].found;
  }
  async maximumCurrentGuests(
    manager: EntityManager,
    property: RentalProperty,
    now: Date,
  ): Promise<number> {
    const rows = await manager.query<{ max_guests: number | null }[]>(
      `SELECT max(guests_count) AS max_guests FROM rental_reservations WHERE property_id=$1 AND status IN ('confirmed','in_progress') AND (check_out_on+check_out_time) AT TIME ZONE $2 > $3`,
      [property.id, property.timezone, now],
    );
    return rows[0].max_guests ?? 0;
  }
  pendingApprovedTransitions(
    manager: EntityManager,
    property: RentalProperty,
    now: Date,
  ): Promise<ConfigurationTransition[]> {
    return manager.query<ConfigurationTransition[]>(
      `SELECT (p.check_out_on+p.check_out_time) AT TIME ZONE $2 AS previous_out, (r.check_in_on+r.check_in_time) AT TIME ZONE $2 AS incoming_at, t.planned_ready_at,t.linen_ready FROM rental_turnovers t JOIN rental_reservations r ON r.property_id=t.property_id AND r.id=t.incoming_reservation_id JOIN rental_reservations p ON p.property_id=t.property_id AND p.id=t.previous_reservation_id WHERE t.property_id=$1 AND t.same_day_approved_at IS NOT NULL AND r.status IN ('confirmed','in_progress') AND (r.check_out_on+r.check_out_time) AT TIME ZONE $2 > $3 AND p.check_out_on=r.check_in_on`,
      [property.id, property.timezone, now],
    );
  }
}
