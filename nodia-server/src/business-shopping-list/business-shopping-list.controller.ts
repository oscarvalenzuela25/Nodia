import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { actorReference } from '../authorization/authority-transaction.js';
import type { AuthRequest } from '../auth/types/auth.types.js';
import {
  ChangeShoppingListActivityDto,
  CreateShoppingListDto,
  EditShoppingListDto,
  SetShoppingListCheckDto,
  ShoppingListBusinessParamsDto,
  ShoppingListCheckParamsDto,
  ShoppingListParamsDto,
  ShoppingListQueryDto,
  ShoppingListReceiptParamsDto,
} from './dto/shopping-list.dto.js';
import { MutateShoppingListUseCase } from './use-case/mutate-shopping-list.use-case.js';
import { ReadShoppingListsUseCase } from './use-case/read-shopping-lists.use-case.js';

@ApiTags('Business shopping lists')
@ApiBearerAuth()
@Controller('businesses/:businessId/lists')
export class BusinessShoppingListController {
  constructor(
    private readonly read: ReadShoppingListsUseCase,
    private readonly mutate: MutateShoppingListUseCase,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'List active and inactive shopping lists for one business',
  })
  list(
    @Param() params: ShoppingListBusinessParamsDto,
    @Query() query: ShoppingListQueryDto,
    @Req() request: AuthRequest,
  ) {
    return this.read.list(
      params.businessId,
      query,
      actorReference(request.auth),
    );
  }

  @Get('requests/:requestKey')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Recover the confirmed result of a shopping list creation',
  })
  receipt(
    @Param() params: ShoppingListReceiptParamsDto,
    @Req() request: AuthRequest,
  ) {
    return this.read.receipt(
      params.businessId,
      params.requestKey,
      actorReference(request.auth),
    );
  }

  @Get(':listId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Read ordered shopping list items and their shared checks',
  })
  detail(@Param() params: ShoppingListParamsDto, @Req() request: AuthRequest) {
    return this.read.detail(
      params.businessId,
      params.listId,
      actorReference(request.auth),
    );
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Create a shopping list atomically with a recoverable request key',
  })
  create(
    @Param() params: ShoppingListBusinessParamsDto,
    @Body() body: CreateShoppingListDto,
    @Req() request: AuthRequest,
  ) {
    return this.mutate.create(
      params.businessId,
      body,
      actorReference(request.auth),
    );
  }

  @Put(':listId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Replace shopping list content at the expected revision',
  })
  edit(
    @Param() params: ShoppingListParamsDto,
    @Body() body: EditShoppingListDto,
    @Req() request: AuthRequest,
  ) {
    return this.mutate.edit(
      params.businessId,
      params.listId,
      body,
      actorReference(request.auth),
    );
  }

  @Put(':listId/activity')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Set shopping list activity at the expected content revision',
  })
  activity(
    @Param() params: ShoppingListParamsDto,
    @Body() body: ChangeShoppingListActivityDto,
    @Req() request: AuthRequest,
  ) {
    return this.mutate.changeActivity(
      params.businessId,
      params.listId,
      body,
      actorReference(request.auth),
    );
  }

  @Put(':listId/items/:itemId/check')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Set the shared check at the expected item revision',
  })
  check(
    @Param() params: ShoppingListCheckParamsDto,
    @Body() body: SetShoppingListCheckDto,
    @Req() request: AuthRequest,
  ) {
    return this.mutate.setCheck(
      params.businessId,
      params.listId,
      params.itemId,
      body,
      actorReference(request.auth),
    );
  }
}
