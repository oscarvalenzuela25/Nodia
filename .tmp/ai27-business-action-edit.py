from pathlib import Path
p=Path('nodia-server/src/business-action/business-action.controller.ts');s=p.read_text();s="import { Req } from '@nestjs/common';\nimport type { AuthRequest } from '../auth/types/auth.types.js';\nimport { actorReference } from '../authorization/authority-transaction.js';\n"+s
s=s.replace('create(@Body() createBusinessActionDto: CreateBusinessActionDto)', 'create(@Body() createBusinessActionDto: CreateBusinessActionDto, @Req() request: AuthRequest)')
s=s.replace('execute(createBusinessActionDto)', 'execute(createBusinessActionDto, actorReference(request.auth))')
s=s.replace('@Body() updateBusinessActionDto: UpdateBusinessActionDto,', '@Body() updateBusinessActionDto: UpdateBusinessActionDto,\n    @Req() request: AuthRequest,')
s=s.replace('execute(id, updateBusinessActionDto)', 'execute(id, updateBusinessActionDto, actorReference(request.auth))')
s=s.replace("remove(@Param('id') id: string)", "remove(@Param('id') id: string, @Req() request: AuthRequest)")
s=s.replace('execute(id);', 'execute(id, actorReference(request.auth));')
p.write_text(s)
p=Path('nodia-server/src/business-action/business-action.service.ts');s=p.read_text();s=s[:s.index('\n  async create(')]+'\n}\n';s=s.replace("import { CreateBusinessActionDto } from './dto/create-business-action.dto.js';\n",'').replace("import { UpdateBusinessActionDto } from './dto/update-business-action.dto.js';\n",'').replace('private readonly redisService: RedisService','_redisService: RedisService');p.write_text(s)
p=Path('nodia-server/src/business-action/dto/create-business-action.dto.ts');s=p.read_text().replace('has_description?: boolean = false;', 'has_description?: boolean;').replace('is_active?: boolean = true;', 'is_active?: boolean;');p.write_text(s)
