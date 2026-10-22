"""Independent offline EOF control: synthetic Python processes, no provider CLI or network."""
import asyncio
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import time

root=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(root/'nodia-gemini-microservice'))
sys.path.insert(0,str(root/'nodia-gemini-microservice/tests'))
import test_support
from agentic_cli import CliRunner,CliConfig
from service_errors import ServiceError

class ObservedRunner(CliRunner):
    def __init__(self,config):
        super().__init__(config)
        self.cleanup=None
        self.process=None
    async def _terminate(self,process):
        self.process=process
        before=process.returncode
        started=time.monotonic()
        await super()._terminate(process)
        self.cleanup={'parent_returncode_before_cleanup':before,'parent_returncode_after_cleanup':process.returncode,
            'elapsed_ms':round((time.monotonic()-started)*1000)}


def process_closed(pid):
    if os.name=='nt':
        import ctypes
        from ctypes import wintypes
        kernel=ctypes.WinDLL('kernel32',use_last_error=True)
        kernel.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD]
        kernel.OpenProcess.restype=wintypes.HANDLE
        kernel.WaitForSingleObject.argtypes=[wintypes.HANDLE,wintypes.DWORD]
        kernel.WaitForSingleObject.restype=wintypes.DWORD
        kernel.CloseHandle.argtypes=[wintypes.HANDLE]
        handle=kernel.OpenProcess(0x100000,False,pid)
        if not handle:return True
        try:return kernel.WaitForSingleObject(handle,0)==0
        finally:kernel.CloseHandle(handle)
    try:
        os.kill(pid,0)
    except ProcessLookupError:return True
    stat=Path('/proc')/str(pid)/'stat'
    return stat.exists() and stat.read_text().split()[2]=='Z'


async def control(which):
    with tempfile.TemporaryDirectory(prefix='nodia-offline-eof-control-') as directory:
        base=Path(directory)
        ready,trigger,escaped=(base/name for name in ('ready','trigger','escaped'))
        child=("import os,time;from pathlib import Path;Path("+repr(str(ready))+").write_text(str(os.getpid()));"
            "trigger=Path("+repr(str(trigger))+");\nwhile not trigger.exists():time.sleep(0.01)\n"
            "Path("+repr(str(escaped))+").write_text('synthetic-descendant-escaped')")
        parent=("import subprocess,sys;subprocess.Popen([sys.executable,'-c',"+repr(child)+"],"
            "stdout="+('None' if which in ('stdout','both') else 'subprocess.DEVNULL')+",stderr="+
            ('None' if which in ('stderr','both') else 'subprocess.DEVNULL')+");print('synthetic-metadata-parent-completed',flush=True)")
        runner=ObservedRunner(CliConfig(Path(sys.executable),'',base))
        started=time.monotonic();reason=None
        try:
            await runner.run(['-u','-c',parent],timeout=1)
        except ServiceError as error:reason=error.code
        elapsed=round((time.monotonic()-started)*1000)
        assert ready.is_file(),'Synthetic descendant did not start'
        child_pid=int(ready.read_text())
        trigger.touch()
        await asyncio.sleep(0.15)
        result={'held_pipe':which,'timeout_seconds':1,'elapsed_ms':elapsed,'result_code':reason,
            'cleanup':runner.cleanup,'synthetic_child_closed':process_closed(child_pid),
            'descendant_side_effect_after_cleanup':escaped.exists(),
            'runner_owned_processes_after_cleanup':len(runner._processes),
            'runner_windows_jobs_after_cleanup':len(runner._jobs),
            'stdout_eof_after_cleanup':runner.process.stdout.at_eof(),
            'stderr_eof_after_cleanup':runner.process.stderr.at_eof()}
        await runner.close()
        assert reason=='agentic_timeout'
        assert result['cleanup']['parent_returncode_before_cleanup']==0
        assert result['synthetic_child_closed'] and not result['descendant_side_effect_after_cleanup']
        assert not result['runner_owned_processes_after_cleanup'] and not result['runner_windows_jobs_after_cleanup']
        assert result['stdout_eof_after_cleanup'] and result['stderr_eof_after_cleanup']
        return result

async def main():
    records=[await control(which) for which in ('stdout','stderr','both')]
    print(json.dumps({'stage':'AI-36-C05','scope':'independent_offline_metadata_parent_exit_zero_but_descendant_holds_pipe',
        'status':'passed','platform':sys.platform,'controls':records,
        'runner_source_sha256':hashlib.sha256((root/'nodia-gemini-microservice/agentic_cli.py').read_bytes()).hexdigest(),
        'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'provider_CLI_executions':0,'provider_requests':0,'network_requests':0,'production_source_changes':0,
        'interpretation':'Demonstrates a possible local EOF wait; does not establish that it occurred in the real metadata observation.'},indent=2))

if __name__=='__main__':asyncio.run(main())
