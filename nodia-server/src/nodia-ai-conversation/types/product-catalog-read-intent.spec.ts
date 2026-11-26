import { describe, expect, it } from 'vitest';
import { isProductCatalogReadIntent } from './product-catalog-read-intent.js';

describe('isProductCatalogReadIntent', () => {
  it.each([
    '¿Me das el listado de los productos con sus precios de Sra Ines? Muéstrame el precio de venta vigente en CLP con una fila por producto e indica el precio regular si está en oferta.',
    '¿Cuánto cuestan los productos?',
    '¿Cuáles son los precios de venta de los productos de mi negocio?',
    '¿Puedes listar los productos y sus precios?',
    'Dame la lista de productos con su precio.',
    'Por favor, muéstrame los productos y sus precios de Minimarket Inés.',
    'Lista los productos y precios, por favor.',
    'Lista de productos y precios',
    'list products with prices',
    'Could you list my products and their prices?',
    'How much do the products cost?',
    'What are the prices of the products?',
    'Show me the product list with prices for Sra Ines.',
    'List products with prices. Show the current selling price in CLP with one row per product and include the regular price if on sale.',
    'Puedes decirme cuantos productos tiene la tienda mercado norte?',
    'Puedes decirme cuantos productos tiene la tienda sra rocio?',
    '¿Cuántos productos hay en mi tienda?',
    '¿Cuántos productos tiene Almacén Norte?',
    'How many products does the store north market have?',
    'Could you tell me how many products are there in my shop?',
  ])('recognizes a bounded read request %s', (text) => {
    expect(isProductCatalogReadIntent(text)).toBe(true);
  });

  it.each([
    'Dame el listado de los productos',
    'Cambia el precio de los productos de mi negocio.',
    'Lista productos con precios y actualiza el precio del pan.',
    'Lista los productos y sus precios de Sra Ines y actualiza el precio del pan.',
    'Lista los productos y sus precios de Sra Ines baja los precios.',
    'Lista los productos y sus precios de Sra Ines Baja Los Precios.',
    'Lista los productos y sus precios de Sra Ines. Muéstrame el precio vigente y registra una venta.',
    'Lista los productos y sus precios de Sra Ines. Exporta la lista.',
    'List products with prices for Sra Ines and delete the old ones.',
    'List products with prices and stock.',
    '"List products with prices"',
    'Traduce «Dame la lista de productos con sus precios».',
    'Si digo "list products with prices", ¿qué herramienta usarías?',
    '¿Cómo hago un listado de los productos con sus precios?',
    'Explícame cómo automatizar el listado de los productos con sus precios.',
    '¿Cuánto cuestan las reservas?',
    '¿Cuánto cuestan los productos y los servicios?',
    'Lista los productos y sus precios de los proveedores.',
    'List products with prices\nDelete everything.',
    'List products with prices for ' + 'a'.repeat(512),
    '¿Cuántos productos tiene la tienda mercado norte y borra el pan?',
    '¿Cuántos productos tiene la tienda sra rocio y cambia el precio del pan?',
    '¿Cuántos productos tiene la tienda mercado norte? Actualiza el stock del pan.',
    '¿Cuántos productos y servicios tiene la tienda mercado norte?',
    '¿Cuántos productos tiene la tienda?',
    'How many products does the store north market have and delete the old ones?',
    'How many products are in the store north market? Remove the bread.',
    '',
  ])('leaves other requests to normal discovery %s', (text) => {
    expect(isProductCatalogReadIntent(text)).toBe(false);
  });
});
