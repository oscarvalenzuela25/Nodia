import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  CreateShoppingListDto,
  EditShoppingListDto,
  SetShoppingListCheckDto,
  ShoppingListQueryDto,
} from './shopping-list.dto.js';

function validate<T extends object>(dto: ClassConstructor<T>, body: object) {
  return validateSync(plainToInstance(dto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });
}

const requestKey = '1978bb3a-4b9d-45ea-b86b-fa8ef1c1ddeb';
const item = { product_id: '9223372036854775807', quantity: '0.125' };
const create = { request_key: requestKey, name: 'Cafetería', items: [item] };

describe('shopping list HTTP DTOs', () => {
  it('accepts empty lists and distinguishes created items from retained items', () => {
    const retained = { ...item, item_id: requestKey };
    expect(validate(CreateShoppingListDto, { ...create, items: [] })).toEqual(
      [],
    );
    expect(validate(CreateShoppingListDto, create)).toEqual([]);
    expect(
      validate(CreateShoppingListDto, { ...create, items: [retained] }),
    ).not.toEqual([]);
    expect(
      validate(EditShoppingListDto, {
        version: 2,
        name: create.name,
        items: [retained],
      }),
    ).toEqual([]);
  });

  it.each([
    null,
    [item],
    { ...item, product_id: 10 },
    { ...item, quantity: 1 },
    { ...item, checked: true },
  ])('rejects malformed or extraneous item input (%j)', (invalid) =>
    expect(
      validate(CreateShoppingListDto, { ...create, items: [invalid] }),
    ).not.toEqual([]),
  );

  it('rejects strings and nulls for required booleans and revisions', () => {
    expect(
      validate(SetShoppingListCheckDto, { check_version: 1, checked: false }),
    ).toEqual([]);
    expect(
      validate(SetShoppingListCheckDto, { check_version: 1, checked: 'false' }),
    ).not.toEqual([]);
    expect(
      validate(SetShoppingListCheckDto, { check_version: '1', checked: true }),
    ).not.toEqual([]);
    expect(
      validate(SetShoppingListCheckDto, { check_version: null, checked: true }),
    ).not.toEqual([]);
  });

  it('accepts pagination only as integer values in range and rejects NUL in text', () => {
    expect(
      validate(ShoppingListQueryDto, {
        page: '2',
        limit: '100',
        search: '  café ',
      }),
    ).toEqual([]);
    expect(
      validate(ShoppingListQueryDto, { page: '1.1', limit: '101' }),
    ).not.toEqual([]);
    expect(validate(ShoppingListQueryDto, { search: 'bad\0text' })).not.toEqual(
      [],
    );
    expect(
      validate(CreateShoppingListDto, { ...create, name: 'bad\0text' }),
    ).not.toEqual([]);
  });
});
