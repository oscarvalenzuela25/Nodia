import { describe, expect, it } from 'vitest';
import { buildImportPayload, escapeCsvValue, parseCSV } from '../../../../../../../../../modules/business/pages/BusinessDetail/components/ProvidersTab/components/ProviderBulkImport/helpers';
const businessId = '11111111-1111-4111-8111-111111111111';
describe('Provider CSV round trip', () => {
  it('preserves IDs, zero, false, multiline text, multiple contacts and historical mapping', () => {
    const contacts = [{ id: '9007199254740993', version: 4, name: 'María, "Sur"', phone: [{ number: '+56987654321' }], email: null, schedule: { monday: [{ from: '09:00', to: '11:00', description: 'Entrega, semanal' }] }, description: 'Primera línea\nSegunda línea', is_active: false }, { name: 'Pedro' }];
    const fields = { code: 'SKU', custom: { value: 'Extra' }, cost_price: { value: '', instructions: 'Solo instrucciones' } };
    const csv = 'name,tax,is_active,id,contacts,fields_json,field_code,field_cost_price,instructions_cost_price,csv_version\r\n' + ['Sur, "Chile"\nSucursal', 0, false, '9007199254740994', JSON.stringify(contacts), JSON.stringify(fields), 'SKU', '', 'Solo instrucciones', '2'].map(escapeCsvValue).join(',');
    const rows = parseCSV('\uFEFF' + csv);
    expect(rows[0].isValid).toBe(true);
    const [payload] = buildImportPayload(rows, businessId);
    expect(payload).toMatchObject({ name: 'Sur, "Chile"\nSucursal', tax: 0, is_active: false, id: '9007199254740994', fields });
    expect(payload.contacts?.[0]).toEqual(contacts[0]);
    expect(payload.contacts?.[1]).toMatchObject({ name: 'Pedro', phone: [], schedule: {}, email: null, description: null, is_active: true });
  });
  it('rejects broken quotes, duplicate headers, unknown boolean, invalid JSON and tax', () => {
    expect(() => parseCSV('name\n"unfinished')).toThrow();
    expect(() => parseCSV('name,name\na,b')).toThrow();
    expect(() => parseCSV('name,is_active\nSur,maybe')).toThrow();
    expect(parseCSV('name,tax\nSur,invalid')[0].isValid).toBe(false);
    expect(parseCSV('name,tax\nSur,19.5')[0].isValid).toBe(false);
    expect(parseCSV('name,contacts\nSur,not-json')[0].isValid).toBe(false);
    expect(parseCSV('name,id\nSur,9223372036854775808')[0].isValid).toBe(false);
  });
  it('restores formula escaping only for versioned exports and preserves omitted contacts', () => {
    expect(buildImportPayload(parseCSV("name,csv_version\n'=name,2"), businessId)[0].name).toBe('=name');
    expect(buildImportPayload(parseCSV("name\n'=name"), businessId)[0].name).toBe("'=name");
    expect(buildImportPayload(parseCSV('name\nSur'), businessId)[0]).not.toHaveProperty('contacts');
  });
});
