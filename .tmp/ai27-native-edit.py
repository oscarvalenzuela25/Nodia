from pathlib import Path
root=Path('nodia-server/src')
for name,entity in [('user','User'),('role','Role'),('action','Action'),('module','Module'),('module-group','ModuleGroup')]:
 p=root/name/'use-case'/f'save-{name}.use-case.ts'
 s=p.read_text(encoding='utf-8-sig').replace('  currentActor,\n','').replace('  lockAuthority,\n','')
 s=s.replace("import { RedisService }", "import { runCoreAuthorityTransaction } from '../../authorization/core-authority-transaction.js';\nimport { RedisService }")
 s=s.replace('this.source.transaction(async (manager) => {\n      await lockAuthority(manager, true);\n      await currentActor(manager, actor);', 'runCoreAuthorityTransaction(this.source, actor, async (manager) => {')
 if name=='user':
  s=s.replace('    for (const email of new Set([result.oldEmail, result.email]))', "    if (actor.transaction) return actor.transaction.getRepository(User).findOneByOrFail({ id: result.id });\n    for (const email of new Set([result.oldEmail, result.email]))")
 else:
  s=s.replace("    await this.redisService.delByPattern('auth:context:*');",f'    if (actor.transaction) return actor.transaction.getRepository({entity}).findOneByOrFail({{ id: savedId }});\n    await this.redisService.delByPattern(\'auth:context:*\');')
 p.write_text(s,encoding='utf-8')
for name in ['role','action','module','module-group']:
 p=root/name/'use-case'/f'delete-{name}.use-case.ts';s=p.read_text(encoding='utf-8-sig')
 s=s.replace('  currentActor,\n','').replace('  lockAuthority,\n','')
 s="import { runCoreAuthorityTransaction } from '../../authorization/core-authority-transaction.js';\n"+s
 s=s.replace('this.dataSource.transaction(async (manager) => {\n      await lockAuthority(manager, true);\n      await currentActor(manager, actor);','runCoreAuthorityTransaction(this.dataSource, actor, async (manager) => {')
 s=s.replace("    await this.redis.delByPattern('auth:context:*');", "    if (!actor.transaction) await this.redis.delByPattern('auth:context:*');")
 p.write_text(s,encoding='utf-8')
