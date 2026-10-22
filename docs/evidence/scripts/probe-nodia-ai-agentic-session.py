"""Explicit CLI observation with a longer diagnostic deadline, no generative prompt."""
import asyncio
import json
import time
from datetime import datetime, timezone


async def main() -> None:
    from dotenv import load_dotenv
    load_dotenv('/app/.env')
    from agentic_cli import CliConfig, CliRunner
    from agentic_observation import command_data, discovered_models
    config=CliConfig.from_environment()
    if config is None:
        print(json.dumps({'configured':False}));return
    runner=CliRunner(config)
    await runner.initialize()
    result={'checked_at':datetime.now(timezone.utc).isoformat(),'inference_performed':False,'configured':True}
    started=time.monotonic()
    try:
        output,code=await runner.run(['-p','/usage','--output-format','json','--print-timeout','25s'],timeout=25)
        report=command_data(output,'usage') if code==0 else {}
        result.update(usage_exit_code=code,usage_verified=isinstance(report.get('groups'),list) and bool(report['groups']),
                      usage_groups=len(report.get('groups',[])))
        if result['usage_verified']:
            models,code=await runner.run(['models'],timeout=20)
            result.update(models_exit_code=code,model_ids=[item['id'] for item in discovered_models(models)] if code==0 else [])
    except Exception as error:
        result.update(error_code=getattr(error,'code',type(error).__name__))
    result['duration_seconds']=round(time.monotonic()-started,3)
    print(json.dumps(result,indent=2))


if __name__=='__main__':
    asyncio.run(main())
