import { Injectable } from '@nestjs/common';
import { type EntityManager } from 'typeorm';
import { RentalCollaborator } from './entities/rental-collaborator.entity.js';
import { User } from '../user/entities/user.entity.js';
import { applyRentalQuery } from '../rental-common/rental-query.js';
import type {
  RentalConfigurationQueryDto,
  RentalCollaboratorCandidatesQueryDto,
} from '../rental-property/dto/rental-configuration-query.dto.js';

@Injectable()
export class RentalCollaboratorService {
  findPage(
    manager: EntityManager,
    propertyId: string,
    query: RentalConfigurationQueryDto,
  ) {
    const qb = manager
      .getRepository(RentalCollaborator)
      .createQueryBuilder('collaborator')
      .leftJoin('collaborator.relation_user_id', 'user')
      .addSelect(['user.id', 'user.name', 'user.image_url'])
      .where('collaborator.property_id = :propertyId', { propertyId });
    applyRentalQuery(qb, 'collaborator', query, 'collaborators');
    return qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
  }
  candidates(
    manager: EntityManager,
    propertyId: string,
    ownerId: string,
    query: RentalCollaboratorCandidatesQueryDto,
  ) {
    return manager
      .getRepository(User)
      .createQueryBuilder('user')
      .select(['user.id', 'user.name', 'user.image_url'])
      .where('user.is_active = TRUE AND user.id <> :ownerId', { ownerId })
      .andWhere('user.name ILIKE :search', {
        search: `%${query.search.replace(/[\\%_]/g, '\\$&')}%`,
      })
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM rental_collaborators c WHERE c.property_id = :propertyId AND c.user_id = user.id AND c.is_active=TRUE)',
        { propertyId },
      )
      .orderBy('user.name', 'ASC')
      .addOrderBy('user.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
  }
  find(manager: EntityManager, propertyId: string, id: string) {
    return manager
      .getRepository(RentalCollaborator)
      .findOne({ where: { id, property_id: propertyId } });
  }
  findByUser(manager: EntityManager, propertyId: string, userId: string) {
    return manager
      .getRepository(RentalCollaborator)
      .findOne({ where: { property_id: propertyId, user_id: userId } });
  }
  findUser(manager: EntityManager, userId: string) {
    return manager.getRepository(User).findOne({
      where: { id: userId, is_active: true },
      select: { id: true },
    });
  }
  insert(manager: EntityManager, data: Partial<RentalCollaborator>) {
    const repository = manager.getRepository(RentalCollaborator);
    return repository.save(repository.create(data));
  }
  save(manager: EntityManager, collaborator: RentalCollaborator) {
    return manager.getRepository(RentalCollaborator).save(collaborator);
  }
}
