import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { BusinessService } from '../business.service.js';
import { Business } from '../entities/business.entity.js';
import { BusinessCollaborator } from '../entities/business-collaborator.entity.js';
import { BusinessAction } from '../../business-action/entities/business-action.entity.js';
import { UserRole } from '../../user/entities/user-role.entity.js';
import { UpdateBusinessUseCase } from './update-business.use-case.js';
import { AssignBusinessCollaboratorsUseCase } from './assign-business-collaborators.use-case.js';
const id = '11111111-1111-4111-8111-111111111111';
function fixture() {
  let isSuper = false;
  const business = Object.assign(new Business(), { id, owner_id: '1', name: 'Business', has_description: true, is_active: true });
  const collaborator = Object.assign(new BusinessCollaborator(), { id: '3', business_id: id, user_id: '2', position: 'Existing', action_ids: ['4'], is_active: true });
  const businesses = { findOne: vi.fn(async () => business), save: vi.fn(async (value: Business) => value) };
  const collaborators = { findOne: vi.fn(async () => collaborator), save: vi.fn(async (value: BusinessCollaborator) => value), find: vi.fn(async () => [collaborator]), create: vi.fn((value: object) => Object.assign(new BusinessCollaborator(), value)) };
  const actions = { find: vi.fn(async () => [Object.assign(new BusinessAction(), { id: '4', is_active: true })]) };
  const rolesQuery = { innerJoin() { return this; }, where() { return this; }, andWhere() { return this; }, getCount: vi.fn(async () => isSuper ? 1 : 0) };
  const roles = { createQueryBuilder: vi.fn(() => rolesQuery) };
  const manager = { query: vi.fn(async () => []), getRepository: vi.fn((entity: unknown) => entity === Business ? businesses : entity === BusinessCollaborator ? collaborators : entity === BusinessAction ? actions : entity === UserRole ? roles : undefined) } as unknown as EntityManager;
  const translations = { updateTranslations: vi.fn(), attachTranslationsToOne: vi.fn(async (_source, row) => row) };
  type Params = ConstructorParameters<typeof BusinessService>;
  const service = new BusinessService({ manager: { transaction: vi.fn(() => { throw new Error('independent transaction forbidden'); }) } } as unknown as Params[0], {} as Params[1], {} as Params[2], {} as Params[3], {} as Params[4], {} as Params[5], translations as unknown as Params[6]);
  return { service, manager, business, collaborator, businesses, collaborators, actions, translations, setSuper: () => { isSuper = true; } };
}
describe('Native business write authority through use cases', () => {
  it('locks business before checking owner and blocks a collaborator from editing it', async () => { const f = fixture(); await expect(new UpdateBusinessUseCase(f.service).execute(id, '2', { name: 'Forbidden' }, f.manager)).rejects.toMatchObject({ status: 403 }); expect(f.businesses.findOne).toHaveBeenCalledWith({ where: { id }, lock: { mode: 'pessimistic_write' } }); expect(f.businesses.save).not.toHaveBeenCalled(); });
  it('super_admin edits another owner without transferring ownership and shares translation manager', async () => { const f = fixture(); f.setSuper(); await new UpdateBusinessUseCase(f.service).execute(id, '2', { name: 'Edited', translates: [{ key: 'description', es: '', en: '' }] }, f.manager); expect(f.business.owner_id).toBe('1'); expect(f.business.has_description).toBe(false); expect(f.translations.updateTranslations).toHaveBeenCalledWith('businesses', id, [{ key: 'description', es: '', en: '' }], f.manager); });
  it('rejects an invalid action collection before applying any collaborator change', async () => { const f = fixture(); f.actions.find.mockResolvedValue([]); await expect(new AssignBusinessCollaboratorsUseCase(f.service).execute(id, '1', { users: [{ user_id: '2', action_ids: ['4'] }] }, f.manager)).rejects.toMatchObject({ status: 400 }); expect(f.collaborators.save).not.toHaveBeenCalled(); });
  it('empty action_ids deactivates only the specified collaborator and preserves existing position', async () => { const f = fixture(); await new AssignBusinessCollaboratorsUseCase(f.service).execute(id, '1', { users: [{ user_id: '2', action_ids: [] }] }, f.manager); expect(f.collaborator).toMatchObject({ position: 'Existing', action_ids: [], is_active: false }); expect(f.collaborators.save).toHaveBeenCalledTimes(1); });
  it('translation failure prevents reporting a completed business mutation', async () => { const f = fixture(); f.translations.updateTranslations.mockRejectedValue(new Error('translation error')); await expect(new UpdateBusinessUseCase(f.service).execute(id, '1', { translates: [{ key: 'description', es: 'Text', en: '' }] }, f.manager)).rejects.toThrow('translation error'); expect(f.businesses.save).not.toHaveBeenCalled(); });
});
