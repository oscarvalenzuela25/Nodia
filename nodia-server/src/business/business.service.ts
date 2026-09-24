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
import { Product } from '../product/entities/product.entity.js';
import { Provider } from '../provider/entities/provider.entity.js';
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
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
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

      // Ejecutar consultas de agregación en paralelo
      const [
        myCollaborations,
        collabCountsRaw,
        productsCountsRaw,
        providersWithCountsRaw,
        translated,
      ] = await Promise.all([
        // 1. Datos de colaboración del usuario actual
        this.collaboratorRepository.find({
          where: {
            business_id: In(businessIds),
            user_id: String(userId),
            is_active: true,
          },
        }),
        // 2. Conteo de colaboradores por negocio
        this.collaboratorRepository
          .createQueryBuilder('bc')
          .select('bc.business_id', 'business_id')
          .addSelect('COUNT(bc.id)', 'count')
          .where('bc.business_id IN (:...businessIds)', { businessIds })
          .andWhere('bc.is_active = true')
          .groupBy('bc.business_id')
          .getRawMany(),
        // 3. Conteo de productos activos por negocio
        this.productRepository
          .createQueryBuilder('p')
          .select('p.business_id', 'business_id')
          .addSelect('COUNT(p.id)', 'count')
          .where('p.business_id IN (:...businessIds)', { businessIds })
          .andWhere('p.is_active = true')
          .groupBy('p.business_id')
          .getRawMany(),
        // 4. Proveedores ordenados por cantidad de productos activos
        this.providerRepository
          .createQueryBuilder('pr')
          .leftJoin(Product, 'p', 'p.provider_id = pr.id AND p.is_active = true')
          .select('pr.business_id', 'business_id')
          .addSelect('pr.id', 'provider_id')
          .addSelect('pr.name', 'provider_name')
          .addSelect('COUNT(p.id)', 'products_count')
          .where('pr.business_id IN (:...businessIds)', { businessIds })
          .andWhere('pr.is_active = true')
          .groupBy('pr.business_id')
          .addGroupBy('pr.id')
          .addGroupBy('pr.name')
          .orderBy('pr.business_id', 'ASC')
          .addOrderBy('COUNT(p.id)', 'DESC')
          .addOrderBy('pr.name', 'ASC')
          .getRawMany(),
        // 5. Traducciones
        this.translationService.attachTranslations('businesses', businesses),
      ]);

      const collabMap = new Map(myCollaborations.map((c) => [c.business_id, c]));
      const collabCountsMap = new Map(
        collabCountsRaw.map((r) => [r.business_id, parseInt(r.count, 10) || 0]),
      );
      const productsCountMap = new Map(
        productsCountsRaw.map((r) => [r.business_id, parseInt(r.count, 10) || 0]),
      );

      const providersByBusinessMap = new Map<
        string,
        Array<{ id: string; name: string; products_count: number }>
      >();

      for (const row of providersWithCountsRaw) {
        const bId = row.business_id;
        if (!providersByBusinessMap.has(bId)) {
          providersByBusinessMap.set(bId, []);
        }
        providersByBusinessMap.get(bId)!.push({
          id: String(row.provider_id),
          name: String(row.provider_name),
          products_count: parseInt(row.products_count, 10) || 0,
        });
      }

      return (translated as Business[]).map((b) => {
        const isOwner = String(b.owner_id) === String(userId);
        const myCollab = collabMap.get(b.id);
        const collabsCount = collabCountsMap.get(b.id) ?? 0;
        const allProviders = providersByBusinessMap.get(b.id) ?? [];

        b.user_role = isOwner ? 'owner' : 'collaborator';
        b.user_position = isOwner ? 'Owner' : (myCollab?.position ?? null);
        b.user_action_ids = isOwner ? [] : (myCollab?.action_ids ?? []);
        b.collaborators_count = collabsCount;
        b.has_collaborators = collabsCount > 0;
        b.products_count = productsCountMap.get(b.id) ?? 0;
        b.top_providers = allProviders.slice(0, 3);
        b.has_more_providers = allProviders.length > 3;
        b.total_providers_count = allProviders.length;

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

    const [productsCount, collaborators, allProviders] = await Promise.all([
      this.productRepository.count({
        where: { business_id: id, is_active: true },
      }),
      this.collaboratorRepository.find({
        where: { business_id: id, is_active: true },
        relations: { user: true },
        order: { created_at: 'DESC' },
      }),
      this.providerRepository
        .createQueryBuilder('pr')
        .leftJoin(Product, 'p', 'p.provider_id = pr.id AND p.is_active = true')
        .select('pr.id', 'provider_id')
        .addSelect('pr.name', 'provider_name')
        .addSelect('COUNT(p.id)', 'products_count')
        .where('pr.business_id = :id', { id })
        .andWhere('pr.is_active = true')
        .groupBy('pr.id')
        .addGroupBy('pr.name')
        .orderBy('COUNT(p.id)', 'DESC')
        .addOrderBy('pr.name', 'ASC')
        .getRawMany(),
    ]);

    business.products_count = productsCount;
    business.collaborators = collaborators;
    business.collaborators_count = collaborators.length;
    business.has_collaborators = collaborators.length > 0;
    business.top_providers = allProviders.slice(0, 3).map((pr) => ({
      id: String(pr.provider_id),
      name: String(pr.provider_name),
      products_count: parseInt(pr.products_count, 10) || 0,
    }));
    business.has_more_providers = allProviders.length > 3;
    business.total_providers_count = allProviders.length;

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
