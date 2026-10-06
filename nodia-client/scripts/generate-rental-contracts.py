"""Generate explicit Client response validators from verified Rental OpenAPI fixtures."""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[2]
source = json.loads((root / 'nodia-server/test/fixtures/rental/swagger.json').read_text())
destination = root / 'nodia-client/src/modules/rentals'
(destination / 'infrastructure').mkdir(parents=True, exist_ok=True)
base = '/api/v1/rental/properties'
house = base + '/{propertyId}'


def response(path):
    return source['paths'][path]['get']['responses']['200']['content']['application/json']['schema']


def expression(schema, name=''):
    if '$ref' in schema:
        return expression(source['components']['schemas'][schema['$ref'].split('/')[-1]], name)
    kind = schema.get('type')
    if 'oneOf' in schema:
        result = 'z.union([' + ','.join(expression(item, name) for item in schema['oneOf']) + '])'
    elif 'enum' in schema:
        values = schema['enum']
        if all(isinstance(value, str) for value in values):
            result = 'z.enum(' + json.dumps(values) + ')'
        elif len(values) == 1:
            result = 'z.literal(' + json.dumps(values[0]) + ')'
        else:
            result = 'z.union([' + ','.join('z.literal(' + json.dumps(value) + ')' for value in values) + '])'
    elif kind == 'object':
        if not schema.get('properties'):
            result = 'z.record(z.string(), z.unknown())'
        else:
            required = schema.get('required', [])
            parts = [json.dumps(key) + ': ' + expression(value, key) + ('' if key in required else '.optional()')
                     for key, value in schema['properties'].items()]
            result = 'z.strictObject({\n' + ',\n'.join(parts) + '\n})'
    elif kind == 'array':
        result = 'z.array(' + expression(schema['items'], name) + ')'
    elif kind in ['integer', 'number']:
        result = 'z.number().finite()' + ('.int().max(Number.MAX_SAFE_INTEGER)' if kind == 'integer' else '')
        for key, function in [('minimum', 'min'), ('maximum', 'max')]:
            if key in schema:
                result += '.' + function + '(' + str(schema[key]) + ')'
    elif kind == 'boolean':
        result = 'z.boolean()'
    elif kind == 'string':
        result = 'z.string()'
        if schema.get('format') == 'date-time':
            result = 'z.iso.datetime({offset: true})'
        elif schema.get('format') == 'date':
            result = 'civilDateSchema'
        elif name == 'timezone':
            result = 'timezoneSchema'
        elif schema.get('pattern') == '^[1-9][0-9]*$':
            result = 'idSchema'
        elif schema.get('pattern'):
            result += '.regex(new RegExp(' + json.dumps(schema['pattern']) + '))'
    else:
        raise ValueError(schema)
    return result + ('.nullable()' if schema.get('nullable') else '')


resources = {
    'properties': ('property', base),
    'collaborators': ('collaborator', house + '/collaborators'),
    'cancellation-policies': ('policy', house + '/cancellation-policies'),
    'reservations': ('reservation', house + '/reservations'),
    'payments': ('payment', house + '/payments'),
    'expenses': ('expense', house + '/expenses'),
    'blocks': ('block', house + '/blocks'),
    'turnovers': ('turnover', house + '/turnovers'),
    'audit-events': ('audit', house + '/audit-events'),
    'collaborator-candidates': ('candidate', house + '/collaborator-candidates'),
}
code = '''// Generated from verified rental OpenAPI by scripts/generate-rental-contracts.py.
// DTOs/use cases, not incomplete Swagger request metadata, govern request inputs.
import { z } from "zod";
import { isCivilDate, isTimezone } from "../utils/dates";
export const idSchema = z.string().regex(/^[1-9]\\d*$/).refine(v => /^[1-9]\\d*$/.test(v) && BigInt(v) <= 9223372036854775807n);
export const civilDateSchema = z.string().refine(isCivilDate);
export const timezoneSchema = z.string().max(64).refine(isTimezone);
'''
for resource, (name, path) in resources.items():
    code += f'export const {name}Schema = ' + expression(response(path)['properties']['data']['items']) + ';\n'
code += 'export const pageMetaSchema = ' + expression(response(base)['properties']['meta']) + ';\n'
code += 'export const rentalPageSchema = <T extends z.ZodType>(item:T) => z.strictObject({data:z.array(item),meta:pageMetaSchema});\n'
code += 'export const turnoverDetailSchema = ' + expression(response(house + '/turnovers/{id}')) + ';\n'
for name, path in [('calendar', 'calendar'), ('availability', 'availability'), ('overview', 'overview'), ('recovery', 'operations/{requestKey}')]:
    code += f'export const {name}Schema = ' + expression(response(house + '/' + path)) + ';\n'
code += 'export const cancellationPreviewSchema = ' + expression(source['paths'][house + '/reservations/{id}/cancellation-preview']['post']['responses']['200']['content']['application/json']['schema']) + ';\n'
code += 'export const ackSchema = ' + expression(source['components']['schemas']['RentalMutationResultDto']) + ';\n'
code += 'export const rentalRecordSchemas = {' + ', '.join(json.dumps(resource) + ': ' + name + 'Schema' for resource, (name, _) in resources.items()) + '} as const;\n'
(destination / 'infrastructure/schemas.ts').write_text(code, encoding='utf-8')
types = 'import type { z } from "zod";\nimport type * as schemas from "./infrastructure/schemas";\n'
for name in [item[0] for item in resources.values()] + ['turnoverDetail', 'calendar', 'availability', 'overview', 'recovery', 'cancellationPreview', 'ack']:
    types += f'export type Rental{name[0].upper() + name[1:]} = z.infer<typeof schemas.{name}Schema>;\n'
types += '''export type RentalOperation = RentalAck["operation"];
export type RentalListResource = keyof typeof schemas.rentalRecordSchemas;
export type RentalRecordMap = { [R in RentalListResource]: z.infer<(typeof schemas.rentalRecordSchemas)[R]> };
export type RentalDetailMap = Omit<RentalRecordMap,"turnovers"> & {turnovers:RentalTurnoverDetail};
export type RentalPageMeta = z.infer<typeof schemas.pageMetaSchema>;
export type RentalPage<T> = {data:T[]; meta:RentalPageMeta};
export type {RentalCommand, RentalPayloadMap, RentalQuery, RentalPreviewInput} from "./contracts";
'''
(destination / 'types.ts').write_text(types, encoding='utf-8')
print('Generated Rental response validators and inferred types.')
