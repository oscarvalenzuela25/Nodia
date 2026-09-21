import { PartialType } from '@nestjs/mapped-types';
import { CreateProductLogDto } from './create-product-log.dto.js';

export class UpdateProductLogDto extends PartialType(CreateProductLogDto) {}
