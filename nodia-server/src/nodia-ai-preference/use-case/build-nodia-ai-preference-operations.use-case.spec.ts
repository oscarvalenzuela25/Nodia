import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { preferenceFixture } from './preference.fixture.js';
import { DisabledNodiaAiDeletionJournal, NODIA_AI_DELETION_PROOF } from '../../nodia-ai-recovery/types/deletion-journal.js';
describe('explicitly accepted preferences', () => {
  it('enforces the explicit owner memory cap before creating another scoped value', async () => {
    const f = preferenceFixture();
    for (let i = 0; i < 50; i++)
      f.seed({
        scope_key: 'business',
        scope: { business_id: randomUUID() },
        key: 'supplier_id',
      });
    await expect(
      f.build.operations[0].prepare(f.create, f.context),
    ).rejects.toThrow('nodia_ai:preference_limit');
    expect(f.repository.save).not.toHaveBeenCalled();
  });
  it('prepares a complete review without remembering or writing anything', async () => {
    const f = preferenceFixture(),
      result = await f.build.operations[0].prepare(f.create, f.context);
    expect(result.status).toBe('ready');
    expect(f.rows).toHaveLength(0);
    expect(f.repository.save).not.toHaveBeenCalled();
    if (result.status !== 'ready') throw new Error('ready');
    expect(result.publicStep.kind).toBe('preference_change');
    expect(result.publicStep.changes).toContainEqual(
      expect.objectContaining({
        field_key: 'value_label',
        after: 'Food',
        origin: 'database',
      }),
    );
    expect(result.scope).toEqual({ subject_user_id: '1' });
  });
  it.each([
    'owner_id',
    'scope_hash',
    'accepted_step_id',
    'secret',
    'instruction',
    'permission',
    'revision',
  ])(
    'rejects the unregistered field %s before any reference read',
    async (key) => {
      const f = preferenceFixture();
      await expect(
        f.build.operations[0].prepare(
          { ...f.create, [key]: 'forbidden' },
          f.context,
        ),
      ).rejects.toThrow('nodia_ai:invalid_input');
      expect(f.store.references).not.toHaveBeenCalled();
    },
  );
  it.each([
    false,
    0,
    null,
    {},
    [],
    '0',
    '01',
    '9223372036854775808',
    'remember my password',
  ])('rejects non-ID or ambiguous memory values (%j)', async (value) => {
    const f = preferenceFixture();
    await expect(
      f.build.operations[0].prepare({ ...f.create, value }, f.context),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });
  it('asks for the missing minimum and never infers a value from a pattern', async () => {
    const f = preferenceFixture();
    const result = await f.build.operations[0].prepare(
      { scope_key: 'finance', scope: {}, key: 'income_category_id' },
      f.context,
    );
    expect(result).toMatchObject({
      status: 'needs_clarification',
      missingFields: ['value'],
    });
    expect(f.repository.save).not.toHaveBeenCalled();
  });
  it('normalizes UUID value and supplier scope before uniqueness and review', async () => {
    const f = preferenceFixture(),
      business = randomUUID();
    f.labels.set('9', 'Provider');
    const result = await f.build.operations[0].prepare(
      {
        scope_key: 'business',
        key: 'supplier_id',
        scope: { business_id: business.toUpperCase() },
        value: '9',
      },
      f.context,
    );
    if (result.status !== 'ready') throw new Error('ready');
    expect(result.commandTemplate.scope).toEqual({ business_id: business });
    expect(result.scope.business_id).toBe(business);
    f.labels.set(business, 'Business');
    const favorite = await f.build.operations[0].prepare(
      {
        scope_key: 'business',
        key: 'business_id',
        scope: {},
        value: business.toUpperCase(),
      },
      f.context,
    );
    if (favorite.status !== 'ready') throw new Error('ready');
    expect(favorite.commandTemplate.value).toBe(business);
  });
  it('requires exactly the supplier business scope and rejects unexpected scope fields', async () => {
    const f = preferenceFixture();
    for (const scope of [{}, { business_id: randomUUID(), owner_id: '1' }])
      await expect(
        f.build.operations[0].prepare(
          { scope_key: 'business', key: 'supplier_id', scope, value: '7' },
          f.context,
        ),
      ).rejects.toThrow('nodia_ai:invalid_input');
    await expect(
      f.build.operations[0].prepare(
        { ...f.create, scope: { business_id: randomUUID() } },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });
  it('prevents writes to another owner even when the actor is super_admin', async () => {
    const f = preferenceFixture();
    f.actor.isSuperAdmin = true;
    const target = f.seed({ owner_id: '2' });
    await expect(
      f.build.operations[1].prepare(
        { id: target.id, expected_revision: 1, value: '8' },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:preference_not_found');
    f.setChatOwner('2');
    await expect(
      f.build.operations[0].prepare(f.create, f.context),
    ).rejects.toThrow('nodia_ai:author_required');
  });
  it('requires the destination module again when preparing and executing a memory', async () => {
    const f = preferenceFixture(),
      prepared = await f.build.operations[0].prepare(f.create, f.context),
      step = f.step(0, prepared);
    f.actor.modules = f.actor.modules.filter(
      (module) => module.route !== '/finances-personal',
    );
    await expect(
      f.build.operations[0].executeConfirmed(step, f.context),
    ).rejects.toThrow('nodia_ai:capability_denied');
    expect(f.rows).toHaveLength(0);
  });
  it('rejects changed labels/references instead of replacing the exact proposal', async () => {
    const f = preferenceFixture(),
      prepared = await f.build.operations[0].prepare(f.create, f.context),
      step = f.step(0, prepared);
    f.labels.set('7', 'Renamed');
    await expect(
      f.build.operations[0].executeConfirmed(step, f.context),
    ).rejects.toThrow('nodia_ai:preconditions_changed');
    expect(f.rows).toHaveLength(0);
  });
  it('refuses an inactive, missing or unauthorized domain reference', async () => {
    const f = preferenceFixture();
    f.labels.clear();
    await expect(
      f.build.operations[0].prepare(f.create, f.context),
    ).rejects.toThrow('nodia_ai:preference_reference_unavailable');
  });
  it('requires a backend-owned confirmed execution identity before saving', async () => {
    const f = preferenceFixture(),
      prepared = await f.build.operations[0].prepare(f.create, f.context),
      step = f.step(0, prepared);
    await expect(
      f.build.operations[0].executeConfirmed(step, {
        ...f.context,
        executionStepId: undefined,
      }),
    ).rejects.toThrow('nodia_ai:confirmation_required');
    f.setConfirmed(false);
    await expect(
      f.build.operations[0].executeConfirmed(step, f.context),
    ).rejects.toThrow('nodia_ai:confirmation_required');
    expect(f.repository.save).not.toHaveBeenCalled();
  });
  it('creates the remembered value and provenance only inside the confirmed effect', async () => {
    const f = preferenceFixture(),
      prepared = await f.build.operations[0].prepare(f.create, f.context),
      step = f.step(0, prepared);
    const result = await f.build.operations[0].executeConfirmed(
      step,
      f.context,
    );
    expect(result).toEqual({
      id: step.commandTemplate.id,
      ownerId: '1',
      revision: 1,
    });
    expect(f.rows[0]).toMatchObject({
      owner_id: '1',
      value: '7',
      source_conversation_id: f.context.conversationId,
      accepted_step_id: f.context.executionStepId,
    });
    await expect(
      f.build.operations[0].executeConfirmed(step, f.context),
    ).rejects.toThrow('nodia_ai:preference_exists');
    expect(f.repository.save).toHaveBeenCalledTimes(1);
  });
  it('uses revision preconditions so a second approved edit cannot overwrite the first', async () => {
    const f = preferenceFixture(),
      target = f.seed(),
      a = f.step(
        1,
        await f.build.operations[1].prepare(
          { id: target.id, expected_revision: 1, value: '8' },
          f.context,
        ),
      ),
      b = f.step(
        1,
        await f.build.operations[1].prepare(
          { id: target.id, expected_revision: 1, value: '7' },
          f.context,
        ),
      );
    await f.build.operations[1].executeConfirmed(a, f.context);
    await expect(
      f.build.operations[1].executeConfirmed(b, f.context),
    ).rejects.toThrow('nodia_ai:preconditions_changed');
    expect(f.rows[0].revision).toBe(2);
    expect(f.rows[0].value).toBe('8');
  });
  it('lets an owner forget an unavailable preference without its former module', async () => {
    const f = preferenceFixture(),
      target = f.seed();
    f.actor.modules = f.actor.modules.filter(
      (module) => module.route !== '/finances-personal',
    );
    f.labels.clear();
    const prepared = await f.build.operations[2].prepare(
        { id: target.id, expected_revision: 1 },
        f.context,
      ),
      step = f.step(2, prepared);
    await f.build.operations[2].executeConfirmed(step, f.context);
    expect(f.rows).toHaveLength(0);
    expect(f.store.references).not.toHaveBeenCalled();
  });
  it.each(['missing', 'different_step', 'different_preference'])('requires the exact external backend proof for preference delete (%s)', async scenario => {
    const journal = Object.assign(new DisabledNodiaAiDeletionJournal(), { enabled: true });
    const f = preferenceFixture(journal), target = f.seed();
    const step = f.step(2, await f.build.operations[2].prepare({ id: target.id, expected_revision: 1 }, f.context));
    const context = scenario === 'missing' ? f.context : {
      ...f.context,
      [NODIA_AI_DELETION_PROOF]: {
        executionStepId: scenario === 'different_step' ? randomUUID() : f.context.executionStepId!,
        preferenceId: scenario === 'different_preference' ? randomUUID() : target.id,
      },
    };
    await expect(f.build.operations[2].executeConfirmed(step, context)).rejects.toThrow('deletion_journal_required');
    expect(f.repository.delete).not.toHaveBeenCalled();
    expect(f.rows).toHaveLength(1);
  });
  it('deletes only after an exact ephemeral backend proof and revalidated revision', async () => {
    const journal = Object.assign(new DisabledNodiaAiDeletionJournal(), { enabled: true });
    const f = preferenceFixture(journal), target = f.seed();
    const step = f.step(2, await f.build.operations[2].prepare({ id: target.id, expected_revision: 1 }, f.context));
    await f.build.operations[2].executeConfirmed(step, {
      ...f.context, [NODIA_AI_DELETION_PROOF]: { executionStepId: f.context.executionStepId!, preferenceId: target.id },
    });
    expect(f.rows).toHaveLength(0);
    expect(f.repository.delete).toHaveBeenCalledWith({ id: target.id, owner_id: '1', revision: 1 });
  });
  it('edits only the registered value and requires a new review', async () => {
    const f = preferenceFixture(),
      prepared = await f.build.operations[0].prepare(f.create, f.context);
    if (prepared.status !== 'ready') throw new Error('ready');
    await expect(
      f.build.operations[0].applyEdits(
        prepared.commandTemplate,
        [{ step_id: randomUUID(), field_key: 'scope_key', value: 'rental' }],
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
    const edited = await f.build.operations[0].applyEdits(
      prepared.commandTemplate,
      [{ step_id: randomUUID(), field_key: 'value', value: '8' }],
      f.context,
    );
    const review = await f.build.operations[0].reprepareStored!(
      edited,
      f.context,
    );
    expect(review.status).toBe('ready');
    expect(f.rows).toHaveLength(0);
  });
  it('keeps unknown keys and payment-state assumptions outside the allowlist', async () => {
    const f = preferenceFixture();
    for (const key of ['api_key', 'is_paid', 'permission', 'system_prompt'])
      await expect(
        f.build.operations[0].prepare({ ...f.create, key }, f.context),
      ).rejects.toThrow('nodia_ai:invalid_input');
  });
});
