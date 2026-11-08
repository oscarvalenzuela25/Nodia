import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import {
  ProductImageVersionDto,
  ReserveProductImageDto,
} from './dto/product-image.dto.js';
import { ManageProductImageUseCase } from './use-case/manage-product-image.use-case.js';
import { PRODUCT_IMAGE_LIMITS } from './product-image-content.js';

@Controller('businesses/:businessId')
export class ProductImageController {
  constructor(private readonly images: ManageProductImageUseCase) {}
  @Post('product-image-uploads')
  reserve(
    @Req() request: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: ReserveProductImageDto,
  ) {
    return this.images.reserve(actorReference(request.auth), businessId, dto);
  }
  @Put('product-image-uploads/:id/content')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: PRODUCT_IMAGE_LIMITS.sourceBytes,
        files: 1,
        fields: 0,
        // Busboy emits partsLimit as the threshold is reached. files/fields
        // still enforce exactly one file and no text fields.
        parts: 2,
      },
    }),
  )
  upload(
    @Req() request: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.images.upload(
      actorReference(request.auth),
      businessId,
      id,
      file,
    );
  }
  @Get('product-image-uploads/:id')
  status(
    @Req() request: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.images.status(actorReference(request.auth), businessId, id);
  }
  @Post('product-image-uploads/:id/complete')
  complete(
    @Req() request: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProductImageVersionDto,
  ) {
    return this.images.complete(
      actorReference(request.auth),
      businessId,
      id,
      dto.expected_product_version,
    );
  }
  @Get('products/:productId/image')
  current(
    @Req() request: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('productId') productId: string,
  ) {
    return this.images.current(
      actorReference(request.auth),
      businessId,
      productId,
    );
  }
  @Delete('products/:productId/image')
  remove(
    @Req() request: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('productId') productId: string,
    @Body() dto: ProductImageVersionDto,
  ) {
    return this.images.remove(
      actorReference(request.auth),
      businessId,
      productId,
      dto.expected_product_version,
    );
  }
}
