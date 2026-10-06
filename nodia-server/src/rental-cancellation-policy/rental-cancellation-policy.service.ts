import { Injectable } from '@nestjs/common';
import { In, type EntityManager } from 'typeorm';
import { RentalCancellationPolicy } from './entities/rental-cancellation-policy.entity.js';
import { RentalCancellationRule } from './entities/rental-cancellation-policy-rule.entity.js';
import type { RentalCancellationRuleDto } from './dto/create-rental-cancellation-policy.dto.js';
import type { RentalConfigurationQueryDto } from '../rental-property/dto/rental-configuration-query.dto.js';
import { applyRentalQuery } from '../rental-common/rental-query.js';

@Injectable()
export class RentalCancellationPolicyService {
  findPage(
    manager: EntityManager,
    propertyId: string,
    query: RentalConfigurationQueryDto,
  ) {
    const qb = manager
      .getRepository(RentalCancellationPolicy)
      .createQueryBuilder('policy')
      .where('policy.property_id=:propertyId', { propertyId });
    applyRentalQuery(qb, 'policy', query, 'policies');
    return qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
  }
  find(manager: EntityManager, propertyId: string, id: string) {
    return manager
      .getRepository(RentalCancellationPolicy)
      .findOne({ where: { id, property_id: propertyId } });
  }
  rulesForPolicies(manager: EntityManager, propertyId: string, ids: string[]) {
    if (!ids.length) return Promise.resolve([] as RentalCancellationRule[]);
    return manager
      .getRepository(RentalCancellationRule)
      .createQueryBuilder('rule')
      .innerJoin(
        RentalCancellationPolicy,
        'policy',
        'policy.id=rule.policy_id AND policy.property_id=:propertyId',
        { propertyId },
      )
      .where('rule.policy_id IN (:...ids)', { ids })
      .orderBy('rule.policy_id', 'ASC')
      .addOrderBy('rule.min_days_before', 'ASC')
      .getMany();
  }
  insert(manager: EntityManager, data: Partial<RentalCancellationPolicy>) {
    const repository = manager.getRepository(RentalCancellationPolicy);
    return repository.save(repository.create(data));
  }
  save(manager: EntityManager, policy: RentalCancellationPolicy) {
    return manager.getRepository(RentalCancellationPolicy).save(policy);
  }
  async replaceRules(
    manager: EntityManager,
    propertyId: string,
    policyId: string,
    rules: RentalCancellationRuleDto[],
    actorId: string,
    now: Date,
  ): Promise<void> {
    const previous = await this.rulesForPolicies(manager, propertyId, [
      policyId,
    ]);
    const repository = manager.getRepository(RentalCancellationRule);
    const removed = previous.filter(
      (row) =>
        !rules.some((rule) => rule.min_days_before === row.min_days_before),
    );
    if (removed.length)
      await repository.delete({
        policy_id: policyId,
        id: In(removed.map((row) => row.id)),
      });
    const next = rules.map((rule) => {
      const existing = previous.find(
        (row) => row.min_days_before === rule.min_days_before,
      );
      return existing
        ? Object.assign(existing, {
            refund_percent: rule.refund_percent,
            updated_by: actorId,
            updated_at: now,
          })
        : repository.create({
            ...rule,
            policy_id: policyId,
            created_by: actorId,
            updated_by: actorId,
            created_at: now,
            updated_at: now,
          });
    });
    await repository.save(next);
  }
}
