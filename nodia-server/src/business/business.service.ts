import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Business } from './entities/business.entity.js';
import { BusinessCollaborator } from './entities/business-collaborator.entity.js';
import { BusinessAction } from '../business-action/entities/business-action.entity.js';
import { CreateBusinessDto } from './dto/create-business.dto.js';
import { UpdateBusinessDto } from './dto/update-business.dto.js';
import { GetBusinessesDto } from './dto/get-businesses.dto.js';
import { AssignCollaboratorsDto } from './dto/assign-collaborators.dto.js';
import { applyRansack } from '../common/utils/ransack-query.builder.js';
import { GetBusinessesResponse } from './types/business.types.js';
import { TranslationService } from '../translation/translation.service.js';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(BusinessCollaborator)
    private readonly collaboratorRepository: Repository<BusinessCollaborator>,
    @InjectRepository(BusinessAction)
    private readonly businessActionRepository: Repository<BusinessAction>,
    private readonly translationService: TranslationService,
  ) {}

  async findMyBusinesses(
    userId: string,
    { page = 1, limit = 10, all = false, includes = true, q }: GetBusinessesDto,
  ): Promise<GetBusinessesResponse> {
    const qb = this.businessRepository.createQueryBuilder('business');

    // Negocios donde el usuario es owner o colaborador activo
    qb.where(
      '(business.owner_id = :userId OR business.id IN (SELECT bc.business_id FROM business_collaborators bc WHERE bc.user_id = :userId AND bc.is_active = true))',
      { userId: String(userId) },
    );

    if (includes) {
      qb.leftJoinAndSelect('business.owner', 'owner');
    }

    applyRansack(qb, q, 'business');

    const formatBusinesses = async (businesses: Business[]): Promise<Business[]> => {
      if (businesses.length === 0) return [];

      const businessIds = businesses.map((b) => b.id);

      // Obtener los datos de colaboración del usuario actual en estos negocios
      const myCollaborations = await this.collaboratorRepository.find({
        where: {
          business_id: In(businessIds),
          user_id: String(userId),
          is_active: true,
        },
      });
      const collabMap = new Map(myCollaborations.map((c) => [c.business_id, c]));

      // Obtener conteo de colaboradores por negocio
      const countsRaw = await this.collaboratorRepository
        .createQueryBuilder('bc')
        .select('bc.business_id', 'business_id')
        .addSelect('COUNT(bc.id)', 'count')
        .where('bc.business_id IN (:...businessIds)', { businessIds })
        .andWhere('bc.is_active = true')
        .groupBy('bc.business_id')
        .getRawMany();

      const countsMap = new Map(
        countsRaw.map((r) => [r.business_id, parseInt(r.count, 10)]),
      );

      const translated = await this.translationService.attachTranslations(
        'businesses',
        businesses,
      );

      return (translated as Business[]).map((b) => {
        const isOwner = String(b.owner_id) === String(userId);
        const myCollab = collabMap.get(b.id);

        b.user_role = isOwner ? 'owner' : 'collaborator';
        b.user_position = isOwner ? 'Owner' : (myCollab?.position ?? null);
        b.user_action_ids = isOwner ? [] : (myCollab?.action_ids ?? []);
        b.collaborators_count = countsMap.get(b.id) ?? 0;

        return b;
      });
    };

    if (all) {
      const rawData = await qb.getMany();
      const data = await formatBusinesses(rawData);
      return {
        data,
        meta: {
          page: 1,
          limit: data.length,
          total_items: data.length,
          total_pages: 1,
        },
      };
    }

    const [rawData, total_items] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = await formatBusinesses(rawData);
    const total_pages = Math.ceil(total_items / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total_items,
        total_pages,
      },
    };
  }

  async findOne(id: string, userId?: string): Promise<Business> {
    const rawBusiness = await this.businessRepository.findOne({
      where: { id },
      relations: { owner: true },
    });
    if (!rawBusiness) {
      throw new NotFoundException(`Business with ID "${id}" not found`);
    }

    const business = (await this.translationService.attachTranslationsToOne(
      'businesses',
      rawBusiness,
    )) as Business;

    if (userId) {
      const isOwner = String(business.owner_id) === String(userId);
      const collaborator = await this.collaboratorRepository.findOne({
        where: {
          business_id: id,
          user_id: String(userId),
          is_active: true,
        },
      });

      if (!isOwner && !collaborator) {
        throw new ForbiddenException('You do not have access to this business');
      }

      business.user_role = isOwner ? 'owner' : 'collaborator';
      business.user_position = isOwner ? 'Owner' : (collaborator?.position ?? null);
      business.user_action_ids = isOwner ? [] : (collaborator?.action_ids ?? []);
    }

    return business;
  }

  async create(userId: string, createBusinessDto: CreateBusinessDto): Promise<Business> {
    const { translates, ...businessData } = createBusinessDto;
    const business = this.businessRepository.create({
      ...businessData,
      has_description: Boolean(translates && translates.length > 0),
      owner_id: String(userId),
    });

    const saved = await this.businessRepository.save(business);

    if (translates && translates.length > 0) {
      await this.translationService.saveTranslations('businesses', saved.id, translates);
    }

    return this.findOne(saved.id, userId);
  }

  async update(
    id: string,
    userId: string,
    updateBusinessDto: UpdateBusinessDto,
  ): Promise<Business> {
    const business = await this.findOne(id);

    if (String(business.owner_id) !== String(userId)) {
      throw new ForbiddenException('Only the business owner can update business details');
    }

    const { translates, ...rest } = updateBusinessDto;
    Object.assign(business, rest);

    if (translates !== undefined) {
      business.has_description = translates.length > 0;
      await this.translationService.updateTranslations('businesses', id, translates);
    }

    await this.businessRepository.save(business);
    return this.findOne(id, userId);
  }

  async assignCollaborators(
    businessId: string,
    userId: string,
    dto: AssignCollaboratorsDto,
  ): Promise<BusinessCollaborator[]> {
    const business = await this.findOne(businessId);

    if (String(business.owner_id) !== String(userId)) {
      throw new ForbiddenException('Only the business owner can manage collaborators');
    }

    // Validar que todas las action_ids pertenezcan a business_actions existentes
    const allActionIds = Array.from(
      new Set(dto.users.flatMap((u) => u.action_ids ?? [])),
    );

    if (allActionIds.length > 0) {
      const existingActions = await this.businessActionRepository.find({
        where: { id: In(allActionIds), is_active: true },
      });
      const existingIds = new Set(existingActions.map((a) => String(a.id)));
      const invalidIds = allActionIds.filter((id) => !existingIds.has(String(id)));

      if (invalidIds.length > 0) {
        throw new BadRequestException(
          `Invalid or inactive business action IDs: ${invalidIds.join(', ')}`,
        );
      }
    }

    for (const item of dto.users) {
      const existingCollab = await this.collaboratorRepository.findOne({
        where: {
          business_id: businessId,
          user_id: String(item.user_id),
        },
      });

      if (!item.action_ids || item.action_ids.length === 0) {
        // Desasignar / inactivar colaborador
        if (existingCollab) {
          existingCollab.is_active = false;
          existingCollab.action_ids = [];
          await this.collaboratorRepository.save(existingCollab);
        }
      } else {
        // Asignar o actualizar colaborador
        if (existingCollab) {
          existingCollab.position = item.position !== undefined ? item.position : existingCollab.position;
          existingCollab.action_ids = item.action_ids;
          existingCollab.is_active = true;
          await this.collaboratorRepository.save(existingCollab);
        } else {
          const newCollab = this.collaboratorRepository.create({
            business_id: businessId,
            user_id: String(item.user_id),
            position: item.position ?? null,
            action_ids: item.action_ids,
            is_active: true,
          });
          await this.collaboratorRepository.save(newCollab);
        }
      }
    }

    return this.collaboratorRepository.find({
      where: { business_id: businessId, is_active: true },
      relations: { user: true },
    });
  }
}
