import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportProvidersCsvUseCase } from './export-providers-csv.use-case.js';
import type { ProviderService } from '../provider.service.js';
import type { Provider } from '../entities/provider.entity.js';

describe('ExportProvidersCsvUseCase', () => {
  let useCase: ExportProvidersCsvUseCase;
  let providerServiceMock: Partial<ProviderService>;

  beforeEach(() => {
    providerServiceMock = {
      findAll: vi.fn(),
    };
    useCase = new ExportProvidersCsvUseCase(providerServiceMock as ProviderService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should export providers as Spanish CSV by default', async () => {
    const mockProviders: Partial<Provider>[] = [
      {
        id: '201',
        business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
        name: 'Coca Cola, Embonor',
        tax: 19,
        is_active: true,
        fields: {
          code: { value: 'COD_ARTICULO', instructions: 'Buscar codigo' },
          cost_price: { value: 'PRECIO_NETO', instructions: '' },
          cost_price_tax: { value: 'PRECIO_BRUTO', instructions: '' },
          packages: { value: 'BULTOS', instructions: '' },
          units_per_package: { value: 'UNID_EMPAQUE', instructions: '' },
        },
      },
    ];

    vi.mocked(providerServiceMock.findAll!).mockResolvedValue({
      data: mockProviders as Provider[],
      meta: { page: 1, limit: 1, total_items: 1, total_pages: 1 },
    });

    const csv = await useCase.execute({
      business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
    });

    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'Nombre (name),Impuesto % (tax),Activo (is_active),Columna Código (field_code),Instrucciones Código (instructions_code),Columna Costo Neto (field_cost_price),Instrucciones Costo Neto (instructions_cost_price),Columna Costo IVA (field_cost_price_tax),Instrucciones Costo IVA (instructions_cost_price_tax),Columna Bultos (field_packages),Instrucciones Bultos (instructions_packages),Columna Unidades por Bulto (field_units_per_package),Instrucciones Unidades por Bulto (instructions_units_per_package),ID (id)'
    );
    expect(lines[1]).toBe(
      '"Coca Cola, Embonor",19,true,COD_ARTICULO,Buscar codigo,PRECIO_NETO,,PRECIO_BRUTO,,BULTOS,,UNID_EMPAQUE,,201'
    );
    expect(providerServiceMock.findAll).toHaveBeenCalledWith({
      all: true,
      includes: false,
      q: { business_id_eq: 'b7b80a11-827c-4712-9c17-9150d0325d7b' },
    });
  });

  it('should export providers as English CSV when lang is en', async () => {
    const mockProviders: Partial<Provider>[] = [
      {
        id: '202',
        business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
        name: 'Nestle',
        tax: 19,
        is_active: false,
        fields: {
          code: { value: 'SKU', instructions: 'In column description' },
        },
      },
    ];

    vi.mocked(providerServiceMock.findAll!).mockResolvedValue({
      data: mockProviders as Provider[],
      meta: { page: 1, limit: 1, total_items: 1, total_pages: 1 },
    });

    const csv = await useCase.execute({
      business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
      lang: 'en',
    });

    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'Name (name),Tax % (tax),Active (is_active),Code Column (field_code),Code Instructions (instructions_code),Net Cost Column (field_cost_price),Net Cost Instructions (instructions_cost_price),Tax Cost Column (field_cost_price_tax),Tax Cost Instructions (instructions_cost_price_tax),Packages Column (field_packages),Packages Instructions (instructions_packages),Units Per Package Column (field_units_per_package),Units Per Package Instructions (instructions_units_per_package),ID (id)'
    );
    expect(lines[1]).toBe(
      'Nestle,19,false,SKU,In column description,,,,,,,,,202'
    );
  });
});
