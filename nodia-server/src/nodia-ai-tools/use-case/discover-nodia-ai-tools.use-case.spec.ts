import { describe, expect, it } from 'vitest';
import { toolFixture } from '../../../test/fixtures/nodia-ai-tools.fixture.js';

describe('DiscoverNodiaAiToolsUseCase', () => {
  it('advertises a published authorized secure preparer without invoking the human flow', async () => {
    const f = toolFixture({ kind: 'prepare_secure_flow' });
    const result = await f.discovery.execute(
      f.manager,
      f.actor,
      ['/tools/fixture'],
      'search',
      {},
    );
    expect(result.items).toContainEqual(
      expect.objectContaining({
        tool_name: f.call.name,
        kind: 'prepare_secure_flow',
        availability: 'available',
        block_reason: null,
      }),
    );
    expect(f.handler).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('secure-flow/');
  });

  it('discovers only registered, published, authorized capabilities with exact public fields', async () => {
    const f = toolFixture();
    const result = await f.discovery.execute(
      f.manager,
      f.actor,
      ['/tools/fixture'],
      'search',
      {},
    );
    expect(result).toEqual({
      catalog_version: 'fixture-catalog',
      items: [
        {
          tool_name: 'nodia_fixture_get',
          kind: 'read',
          module_key: 'fixture',
          description_key: 'fixture_read',
          availability: 'available',
          block_reason: null,
        },
        {
          tool_name: 'nodia_fixture_resolve',
          kind: 'read',
          module_key: 'fixture',
          description_key: 'fixture_read',
          availability: 'available',
          block_reason: null,
        },
      ],
      next_cursor: null,
    });
    expect(f.authorize.filterAuthorized).toHaveBeenCalledOnce();
    expect(f.handler).not.toHaveBeenCalled();
  });
  it('returns an honest empty catalog without published bindings or the required module', async () => {
    const f = toolFixture();
    f.manifest.capability_contracts.length = 0;
    expect(
      await f.discovery.execute(
        f.manager,
        f.actor,
        ['/tools/fixture'],
        'search',
        {},
      ),
    ).toMatchObject({ items: [], next_cursor: null });
    expect(
      await f.discovery.execute(f.manager, f.actor, [], 'search', {}),
    ).toMatchObject({ items: [] });
  });
  it('advertises assigned modules without role actions and hides revoked destinations', async () => {
    const f = toolFixture();
    f.actions.clear();
    expect(
      await f.discovery.execute(
        f.manager,
        f.actor,
        ['/tools/fixture'],
        'search',
        {},
      ),
    ).toMatchObject({ items: expect.arrayContaining([
      expect.objectContaining({ tool_name: f.call.name }),
    ]) });
    const assigned = f.actor.modules;
    f.actor.modules = f.actor.modules.filter((module) => module.route !== '/tools/fixture');
    expect(await f.discovery.execute(f.manager, f.actor, ['/tools/fixture'], 'search', {}))
      .toMatchObject({ items: [] });
    f.actor.modules = assigned;
    f.actor.isSuperAdmin = true;
    expect(
      (
        await f.discovery.execute(
          f.manager,
          f.actor,
          ['/tools/fixture'],
          'search',
          {},
        )
      ).items,
    ).toHaveLength(2);
  });
  it('filters by module and a bounded natural-language term', async () => {
    const f = toolFixture();
    expect(
      (
        await f.discovery.execute(
          f.manager,
          f.actor,
          ['/tools/fixture'],
          'search',
          { query: 'total', module_key: 'fixture' },
        )
      ).items,
    ).toHaveLength(2);
    expect(
      (
        await f.discovery.execute(
          f.manager,
          f.actor,
          ['/tools/fixture'],
          'search',
          { module_key: 'other' },
        )
      ).items,
    ).toEqual([]);
    await expect(
      f.discovery.execute(f.manager, f.actor, ['/tools/fixture'], 'search', {
        query: 'x'.repeat(257),
      }),
    ).rejects.toThrow('invalid_tool_input');
    await expect(
      f.discovery.execute(f.manager, f.actor, ['/tools/fixture'], 'search', {
        sql: 'SELECT secret',
      }),
    ).rejects.toThrow('invalid_tool_input');
    expect(
      (
        await f.discovery.execute(
          f.manager,
          f.actor,
          ['/tools/fixture'],
          'search',
          { query: '😀'.repeat(256) },
        )
      ).items,
    ).toEqual([]);
  });
  it('binds pagination to current actor, session, filters, routes and contract set', async () => {
    const f = toolFixture({ listDefaultRows: 1 });
    const first = await f.discovery.execute(
      f.manager,
      f.actor,
      ['/tools/fixture'],
      'search',
      {},
    );
    const second = await f.discovery.execute(
      f.manager,
      f.actor,
      ['/tools/fixture'],
      'search',
      { cursor: first.next_cursor },
    );
    expect(second).toMatchObject({
      next_cursor: null,
      items: [{ tool_name: 'nodia_fixture_resolve' }],
    });
    f.actor.sessionId = 'c1041075-ed7e-4a68-890f-5272f045a433';
    await expect(
      f.discovery.execute(f.manager, f.actor, ['/tools/fixture'], 'search', {
        cursor: first.next_cursor,
      }),
    ).rejects.toThrow('invalid_tool_input');
  });
  it('describes exact contracts and serves resolved strict schema documents without calling domain handlers', async () => {
    const f = toolFixture();
    const input = {
      tool_name: 'nodia_fixture_get',
      catalog_version: f.registry.catalogVersion,
    };
    expect(
      await f.discovery.execute(
        f.manager,
        f.actor,
        ['/tools/fixture'],
        'describe',
        input,
      ),
    ).toMatchObject({
      required_fields: ['id'],
      optional_fields: [],
      contract_hash: f.registry.get('nodia_fixture_get')!.contractHash,
    });
    const result = await f.discovery.execute(
      f.manager,
      f.actor,
      ['/tools/fixture'],
      'schema',
      input,
    );
    expect(result.input_schema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      $defs: { Input: expect.any(Object) },
    });
    expect(f.handler).not.toHaveBeenCalled();
    await expect(
      f.discovery.execute(f.manager, f.actor, ['/tools/fixture'], 'describe', {
        ...input,
        catalog_version: 'old',
      }),
    ).rejects.toThrow('catalog_changed');
    await expect(
      f.discovery.execute(f.manager, f.actor, [], 'describe', input),
    ).rejects.toThrow('capability_denied');
  });
  it('uses an explicit typed resolver and validates candidate provenance and ambiguity', async () => {
    const f = toolFixture();
    const input = {
      catalog_version: f.registry.catalogVersion,
      resource_key: 'fixture.records',
      term: 'record',
      scope: {},
    };
    expect(
      await f.discovery.execute(
        f.manager,
        f.actor,
        ['/tools/fixture'],
        'entities',
        input,
      ),
    ).toMatchObject({
      status: 'unique',
      candidates: [{ id: '1', resource_key: 'fixture.records' }],
    });
    expect(f.resolverAuthority).toHaveBeenCalledOnce();
    f.resolver.mockResolvedValueOnce({
      status: 'unique',
      candidates: [{ id: '1', resource_key: 'fixture.records' }],
      next_cursor: 'more',
    });
    await expect(
      f.discovery.execute(
        f.manager,
        f.actor,
        ['/tools/fixture'],
        'entities',
        input,
      ),
    ).rejects.toThrow('invalid_tool_output');
    f.resolver.mockResolvedValueOnce({
      status: 'unique',
      candidates: [{ id: '1', resource_key: 'other.records' }],
      next_cursor: null,
    });
    await expect(
      f.discovery.execute(
        f.manager,
        f.actor,
        ['/tools/fixture'],
        'entities',
        input,
      ),
    ).rejects.toThrow('invalid_tool_output');
    f.resolver.mockResolvedValueOnce({
      status: 'unique',
      candidates: [
        { id: '9223372036854775808', resource_key: 'fixture.records' },
      ],
      next_cursor: null,
    });
    await expect(
      f.discovery.execute(
        f.manager,
        f.actor,
        ['/tools/fixture'],
        'entities',
        input,
      ),
    ).rejects.toThrow('invalid_tool_output');
  });
  it('never lets entity scopes or unknown resources create a resolver or grant', async () => {
    const f = toolFixture();
    const input = {
      catalog_version: f.registry.catalogVersion,
      resource_key: 'not.registered',
      term: 'record',
      scope: {},
    };
    await expect(
      f.discovery.execute(
        f.manager,
        f.actor,
        ['/tools/fixture'],
        'entities',
        input,
      ),
    ).rejects.toThrow('capability_denied');
    await expect(
      f.discovery.execute(f.manager, f.actor, ['/tools/fixture'], 'entities', {
        ...input,
        scope: { sql: 'select all' },
      }),
    ).rejects.toThrow('invalid_tool_input');
    expect(f.resolver).not.toHaveBeenCalled();
  });
  it('exposes only three existing common names and their reachable schema closure', () => {
    const f = toolFixture();
    const descriptors = f.discovery.descriptors();
    expect(descriptors.map((tool) => tool.name)).toEqual([
      'nodia_capabilities_search',
      'nodia_capabilities_describe',
      'nodia_entities_search',
    ]);
    expect(JSON.stringify(descriptors)).not.toContain('WorkflowPrepareInput');
    expect(Buffer.byteLength(JSON.stringify(descriptors))).toBeLessThan(12000);
  });
});
