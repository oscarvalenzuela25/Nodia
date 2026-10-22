"""Bounded private MCP sessions. Callbacks travel through Server polling, never URLs."""
from __future__ import annotations
import asyncio
import json
import logging
import os
import re
import shlex
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from contextlib import ExitStack
from pathlib import Path
from typing import Any
from uuid import uuid4

from pydantic import Field, field_validator
from agentic_cli import CliRunner, prepare_cli_home, permission_path
from native_attachments import materialize, attachment_digest, require_completed_attachment_reads
from agentic_progress import NativeFileCliProgress
from native_cli_diagnostics import capture_cli_log_diagnostic, cli_error_indicators, result_error_diagnostic
from native_attempts import ReconcileAttempt
from native_execution_agents import (execution_agent_definition, prepare_execution_agent,
                                     verify_execution_agent, mcp_execution_policy_hash)
from native_mcp_stdio import bounded_json, atomic, MAX_CATALOG_TOOLS, MAX_CATALOG_BYTES, MAX_MANIFEST_BYTES, MAX_CONTROLLED_CONTEXT_BYTES, check_context_budget
from nodia_ai_chat import ChatRequest, Closed, Answer, unique_pairs, CONTRACT_VERSION
from service_errors import ServiceError
from native_context_budget import (McpTool, validate_catalog, build_mcp_prompt, require_context_budget,
                                   ContextMeasureRequest, measure_context, require_measurement_budget,
                                   controlled_native_context_bytes)

logger = logging.getLogger(__name__)

GATE_DIAGNOSTIC_CATEGORIES = frozenset({
    "allowed_finish", "finish_arguments", "dispatcher_envelope", "dispatcher_extra_fields",
    "foreign_server", "unregistered_tool", "arguments_type", "arguments_json",
    "arguments_shape", "allowed_registered", "unregistered_native", "payload_shape", "invalid_json",
    "allowed_attachment",
})
GATE_DIAGNOSTIC_CALL_KINDS = frozenset({"finish", "dispatcher", "registered", "other", "attachment"})
def capture_cli_log_for_job(job: McpJob, path: Path) -> None:
    try: job.cli_log_diagnostic = capture_cli_log_diagnostic(path)
    except Exception: job.cli_log_diagnostic = None  # Supplemental diagnostics never change execution or cleanup.


def _gate_diagnostic_lines(path: Path) -> tuple[str, list[object]]:
    """Best-effort bounded input; never retain arbitrary receipt values in diagnostics."""
    try:
        if not path.is_file(): return "missing", []
        with path.open("rb") as stream: raw = stream.read(65537)
        if len(raw) > 65536: return "oversize", []
        lines = raw.splitlines()
        if len(lines) > 128: return "oversize", []
        values = [bounded_json(line) for line in lines]
        return "valid", values
    except OSError:
        return "missing", []
    except (ValueError, UnicodeError):
        return "invalid_json", []


def capture_gate_diagnostic(directory: Path, allowed: set[str]) -> dict[str, object]:
    """Supplemental structural evidence only; authorization still validates its original receipt."""
    state, decisions = _gate_diagnostic_lines(directory / "gate.jsonl")
    decision_count = rejected_count = None
    receipt_class = state
    if state == "valid":
        if not decisions or any(not isinstance(item, dict) or set(item) != {"tool", "allowed"}
                                or not isinstance(item["tool"], str) or type(item["allowed"]) is not bool
                                for item in decisions):
            receipt_class = "invalid_shape"
        else:
            decision_count = len(decisions)
            rejected_count = sum(item["allowed"] is not True for item in decisions)
            receipt_class = ("denied_tool" if rejected_count else "unregistered"
                             if any(item["tool"] not in allowed for item in decisions) else "verified")
    category_state, events = _gate_diagnostic_lines(directory / "gate-diagnostic.jsonl")
    categories: dict[str, int] = {}
    if category_state == "valid":
        if any(not isinstance(item, dict) or set(item) != {"category", "call_kind"}
               or not isinstance(item["category"], str) or item["category"] not in GATE_DIAGNOSTIC_CATEGORIES
               or not isinstance(item["call_kind"], str) or item["call_kind"] not in GATE_DIAGNOSTIC_CALL_KINDS
               for item in events):
            category_state = "invalid_shape"
        else:
            for item in events:
                category = item["category"]
                categories[category] = categories.get(category, 0) + 1
    return {"receipt_class": receipt_class, "decision_count": decision_count,
            "rejected_count": rejected_count, "categories_state": category_state,
            "categories": categories}


class McpTrace(NativeFileCliProgress):
    """Only bounded structural metadata escapes the native stream observer."""
    def __init__(self):
        super().__init__()
        self.tool_steps = 0
        self.last_tool = "none"
        self.terminal_status = "absent"
        self.denied_count = 0
        self.stderr_bytes = 0
        self.stderr_error_categories: set[str] = set()
        self.result_error_categories: list[str] = []
        self.result_error_json_utf8_bytes: int | None = None
        self._stderr_tail = b""

    def feed_error(self, chunk):
        self.stderr_bytes += len(chunk)
        try:
            text=(self._stderr_tail+chunk).decode("utf-8",errors="replace")
            self.stderr_error_categories.update(cli_error_indicators(text))
            self._stderr_tail=(self._stderr_tail+chunk)[-512:]
        except Exception:
            pass  # Diagnostic classification never changes cancellation or completion.

    def _consume(self, line):
        super()._consume(line)
        try:
            value = json.loads(line)
            if not isinstance(value, dict): return
            if value.get("event") == "step_update":
                step = value.get("step_update")
                if not isinstance(step, dict) or step.get("step_type") != "tool": return
                self.tool_steps += 1
                name = step.get("tool_name")
                self.last_tool = name if name in ("finish", "call_mcp_tool") else "other"
            if value.get("event") == "result":
                result = value.get("result")
                if not isinstance(result, dict): return
                status = result.get("status")
                self.terminal_status = status if status in ("SUCCESS", "ERROR", "CANCELED", "INTERRUPTED", "INVALID", "WAITING", "RUNNING") else "unrecognized"
                if status == "ERROR":
                    try:
                        diagnostic=result_error_diagnostic(result.get("error"))
                        self.result_error_categories=diagnostic["result_error_categories"]
                        self.result_error_json_utf8_bytes=diagnostic["result_error_json_utf8_bytes"]
                    except Exception:
                        pass
                denied = result.get("denied_actions")
                self.denied_count = len(denied) if isinstance(denied, list) else int(bool(denied))
        except (ValueError, TypeError, AttributeError):
            return

    def diagnostic(self):
        return {**self.summary(), "tool_steps": self.tool_steps, "last_tool": self.last_tool,
                "terminal_status": self.terminal_status, "denied_count": self.denied_count,
                "stderr_bytes": self.stderr_bytes,
                "error_indicator_interpretation":"text_indicator_not_verified_cause",
                "stderr_error_categories":sorted(self.stderr_error_categories),
                "result_error_categories":self.result_error_categories,
                "result_error_json_utf8_bytes":self.result_error_json_utf8_bytes}


class McpChatRequest(ChatRequest):
    configuration_generation: str = Field(pattern=r"^[0-9a-f]{64}$")
    tools: list[McpTool] = Field(min_length=1,max_length=MAX_CATALOG_TOOLS)
    diagnostic: bool = False

    @field_validator("tools")
    @classmethod
    def catalog(cls,tools):
        return validate_catalog(tools)


class McpPoll(ReconcileAttempt):
    after: int = Field(ge=0,le=256)


class McpResult(ReconcileAttempt):
    call_id: str = Field(pattern=r"^[0-9a-f-]{36}$")
    result: dict[str,object]

    @field_validator("result")
    @classmethod
    def bounded(cls,value):
        bounded_json(json.dumps({"result":value}).encode())
        return value


@dataclass
class McpJob:
    request: McpChatRequest
    reservation: Any
    proof: Any
    execution_policy_hash: str = field(default_factory=mcp_execution_policy_hash)
    task: asyncio.Task | None = None
    state: str = "running"
    rpc_messages: int = 0
    tool_requests: int = 0
    events: list[dict[str,object]] = field(default_factory=list)
    pending: dict[str,dict[str,object]] = field(default_factory=dict)
    results: dict[str,str] = field(default_factory=dict)
    directory: Path | None = None
    callbacks: int = 0
    gate_verified: bool = False
    context_initial_utf8_bytes: int | None = None
    context_used_utf8_bytes: int | None = None
    phase: str = "admitted"
    started_at: float = field(default_factory=time.monotonic)
    exit_code: int | None = None
    failure_type: str | None = None
    trace: McpTrace = field(default_factory=McpTrace)
    hook_diagnostic: dict[str, object] | None = None
    cli_log_diagnostic: dict[str, object] | None = None

    def emit(self,kind,**values):
        if len(self.events)>=256: raise ValueError("Event budget")
        self.events.append({"seq":len(self.events)+1,"kind":kind,**values})


class NativeMcpSessions:
    def __init__(self,adapter):
        self.adapter=adapter
        self.jobs: dict[str,McpJob]={}
        self.verified:set[tuple[str,...]]=set()

    @staticmethod
    def key(resource,session,model,effort,configuration):
        return (resource,session,model,effort or "",configuration,CONTRACT_VERSION,mcp_execution_policy_hash())

    def supports(self,resource,session,model,effort,configuration):
        return self.key(resource,session,model,effort,configuration) in self.verified

    async def start(self,request:McpChatRequest):
        require_measurement_budget(measure_context("agentic", ContextMeasureRequest(
            model_id=request.model_id, effort_id=request.effort_id, canonical_prompt=request.canonical_prompt,
            tools=request.tools, attachments=[{"kind": item.kind, "media_type": item.media_type} for item in request.attachments]), {}))
        adapter=self.adapter
        if request.attachments:
            adapter.verify_attachment_runtime("agentic")
        if request.attachments and any(not adapter.attachment_proofs.supports("agentic", request, item.kind, item.media_type) for item in request.attachments):
            raise ServiceError("attachment_adapter_unverified","La modalidad Agentic exacta no está verificada.",409)
        if (request.resource_key!=adapter.profiles.identity("agentic") or request.session_generation!=adapter.session_generation("agentic")):
            raise ServiceError("runtime_generation_changed","El perfil o sesión cambió.",409)
        if request.attempt_id in adapter.attempts or request.attempt_id in self.jobs:
            raise ServiceError("attempt_already_dispatched","El intento ya fue admitido.",409)
        if len(adapter.attempts)>=adapter.maximum_attempts:
            raise ServiceError("adapter_admission_capacity","Se requiere drenar el adaptador.",503)
        if not request.diagnostic and not self.supports(request.resource_key,request.session_generation,request.model_id,request.effort_id,request.configuration_generation):
            raise ServiceError("mcp_adapter_unverified","El protocolo MCP exacto todavía no está verificado.",409)
        if not adapter.agentic.is_available() or adapter.agentic.runner is None:
            raise ServiceError("agentic_unavailable","El adaptador Agentic no está disponible.",503)
        reservation=adapter.profiles.reserve("agentic")
        try:
            status=await adapter.agentic.get_status()
            if not status["has_active_session"] or len([m for m in status["models"] if m["id"]==request.model_id])!=1:
                raise ServiceError("model_unavailable","La sesión/modelo exactos no están disponibles.",422)
            reference=ReconcileAttempt(resource_key=request.resource_key,session_generation=request.session_generation,operation_ref=request.attempt_id)
            proof=adapter.ledger.arm(request.attempt_id,"agentic",reference,attachment_digest(request.attachments))
            adapter.profiles.arm_dispatch("agentic",{"attempt_id":request.attempt_id,**reference.model_dump()})
            adapter.attempts.add(request.attempt_id)
            adapter.active_attempts[request.attempt_id]="agentic"
            job=McpJob(request,reservation,proof)
            self.jobs[request.attempt_id]=job
            job.task=asyncio.create_task(self.run(job))
            return {"attempt_id":request.attempt_id,"state":"running"}
        except BaseException:
            reservation.release()
            raise

    def owned(self,attempt_id:str,reference:ReconcileAttempt)->McpJob:
        job=self.jobs.get(attempt_id)
        if job is None: raise ServiceError("mcp_attempt_missing","No existe ese intento MCP.",404)
        if not self.adapter.ledger.matches(job.proof,"agentic",reference):
            raise ServiceError("native_proof_mismatch","El intento no corresponde al recurso.",409)
        return job

    def poll(self,attempt_id:str,request:McpPoll):
        job=self.owned(attempt_id,request)
        if request.after>len(job.events): raise ServiceError("invalid_cursor","Cursor de eventos inválido.",422)
        return {"attempt_id":attempt_id,"state":job.state,"events":job.events[request.after:],
                "rpc_messages":job.rpc_messages,
                "unforwarded_tool_requests":job.tool_requests-job.callbacks}

    def submit(self,attempt_id:str,request:McpResult):
        job=self.owned(attempt_id,request)
        canonical=json.dumps(request.result,sort_keys=True,separators=(",",":"))
        if request.call_id in job.results:
            if job.results[request.call_id]!=canonical: raise ServiceError("mcp_result_conflict","La respuesta MCP cambió de intención.",409)
            return {"accepted":True}
        if job.state!="running" or request.call_id not in job.pending or job.directory is None:
            raise ServiceError("mcp_call_missing","La llamada MCP no está pendiente.",409)
        atomic(job.directory/"responses"/(request.call_id+".json"),{"result":request.result})
        job.results[request.call_id]=canonical
        job.phase="awaiting_cli_terminal"
        return {"accepted":True}

    async def cancel(self,attempt_id:str,request:ReconcileAttempt):
        job=self.owned(attempt_id,request)
        if job.task is not None and not job.task.done():
            job.task.cancel()
            await asyncio.gather(job.task,return_exceptions=True)
            # Cancellation before the first coroutine instruction skips its finally.
            if attempt_id in self.adapter.active_attempts:
                self.fail(job)
                self.adapter.active_attempts.pop(attempt_id,None)
                job.reservation.release()
        return {"attempt_id":attempt_id,"state":job.state}

    def attest(self,attempt_id:str,request:ReconcileAttempt):
        job=self.owned(attempt_id,request)
        runner=self.adapter.agentic.runner
        if (job.state!="completed" or job.callbacks<1 or not job.gate_verified
                or job.execution_policy_hash != mcp_execution_policy_hash()
                or not isinstance(runner,CliRunner) or runner._verified_stat is None
                or job.request.session_generation!=self.adapter.session_generation("agentic")):
            raise ServiceError("mcp_probe_unverified","No existe una prueba real completa de este protocolo.",409)
        self.verified.add(self.key(request.resource_key,request.session_generation,job.request.model_id,job.request.effort_id,job.request.configuration_generation))
        return {"verified":True,"adapter_contract_version":CONTRACT_VERSION}

    def forget(self,attempt_id:str):
        job=self.jobs.get(attempt_id)
        if job is not None:
            if job.state=="running": raise ServiceError("native_operation_active_or_unverified","El intento sigue activo.",409)
            self.jobs.pop(attempt_id,None)

    def fail(self,job):
        self.adapter.profiles.quarantine("agentic")
        if self.adapter.native_operation_closed("agentic"):
            self.adapter.ledger.close(job.proof,"abandoned_unknown")
        job.state="unknown"
        if not job.events or job.events[-1]["kind"]!="unknown": job.emit("unknown",code="mcp_result_unknown")

    async def run(self,job:McpJob):
        try:
            async with asyncio.timeout(job.request.timeout_seconds):
                reply=await self.generate(job)
                job.phase="closing_native_proof"
                proof=self.adapter.ledger.close(job.proof,"completed")
                self.adapter.profiles.resolve_dispatch("agentic")
                job.state="completed"
                job.phase="completed"
                job.emit("answer",text=reply.text,terminal_proof=self.adapter.ledger.project(proof).model_dump())
        except asyncio.CancelledError:
            job.failure_type="CancelledError"
            self.fail(job)
            raise
        except Exception as error:
            kind=type(error).__name__
            job.failure_type=kind if kind in ("TimeoutError","ServiceError","ValueError","OSError","TypeError","KeyError","AttributeError") else "Other"
            self.fail(job)
        finally:
            self.adapter.active_attempts.pop(job.request.attempt_id,None)
            job.reservation.release()
            diagnostic={"attempt_id":job.request.attempt_id,"phase":job.phase,"state":job.state,"exception_type":job.failure_type,
                        "elapsed_ms":round((time.monotonic()-job.started_at)*1000),
                        "rpc_messages":job.rpc_messages,"callbacks":job.callbacks,
                        "exit_code":job.exit_code,"gate_verified":job.gate_verified,
                        "cli":job.trace.diagnostic(),"hook":job.hook_diagnostic,"cli_log":job.cli_log_diagnostic,
                        "controlled_context":{"scope":"initial_prompt_and_mcp_stdout", "initial_utf8_bytes":job.context_initial_utf8_bytes,
                            "used_utf8_bytes":job.context_used_utf8_bytes,"maximum_utf8_bytes":MAX_CONTROLLED_CONTEXT_BYTES,
                            "provider_internal_context_tokens":None}}
            logger.log(logging.WARNING if job.state!="completed" else logging.INFO,
                       "nodia_ai_mcp_terminal %s",json.dumps(diagnostic,separators=(",",":")))

    async def generate(self,job:McpJob)->Answer:
        async with materialize(job.request.attachments,getattr(self.adapter,"attachment_inspector",None)) as paths:
            return await self.generate_with_attachments(job,paths)

    async def generate_with_attachments(self,job:McpJob,attachment_paths:list[Path])->Answer:
        job.phase="workspace_setup"
        request=job.request
        runner=self.adapter.agentic.runner
        options=["--model",request.model_id]
        if request.effort_id is not None: options += ["--effort",request.effort_id]
        with tempfile.TemporaryDirectory(prefix="nodia-mcp-",dir=runner.config.home) as directory, ExitStack() as diagnostics:
            root=Path(directory)
            diagnostics.callback(capture_cli_log_for_job,job,root/"cli.log")
            home,workspace,bridge=root/"profile",root/"workspace",root/"bridge"
            workspace.mkdir();bridge.mkdir();(bridge/"requests").mkdir();(bridge/"responses").mkdir()
            if attachment_paths:
                copies=[]
                for index,source in enumerate(attachment_paths):
                    target=workspace/("attachment-"+str(index)+source.suffix)
                    shutil.copyfile(source,target);target.chmod(0o400);copies.append(target)
                attachment_paths=copies
            job.directory=bridge
            prepare_cli_home(home)
            for name in ("antigravity-oauth-token","installation_id"):
                source=runner.config.home/".gemini/antigravity-cli"/name
                if source.is_file(): (home/".gemini/antigravity-cli"/name).symlink_to(source)
            prompt=build_mcp_prompt(request.canonical_prompt,request.tools,[str(path.resolve()) for path in attachment_paths])
            if job.execution_policy_hash != mcp_execution_policy_hash(): raise ValueError("MCP execution policy changed")
            agent_name,agent_document=execution_agent_definition("mcp",bool(attachment_paths))
            agent_file=prepare_execution_agent(workspace,"mcp",bool(attachment_paths))
            verify_execution_agent(agent_file,workspace,"mcp",bool(attachment_paths))
            require_context_budget(prompt,agent_document)
            job.context_initial_utf8_bytes=controlled_native_context_bytes("agentic",prompt,bool(attachment_paths),True)
            job.context_used_utf8_bytes=job.context_initial_utf8_bytes
            policy={"tools":[tool.model_dump() for tool in request.tools],"rpc_budget":128,"tool_budget":12,"timeout_seconds":request.timeout_seconds,"cli_json_string_arguments":True,"documents":[str(path.resolve()) for path in attachment_paths],
                "context_budget":{"schema_version":1,"initial_utf8_bytes":job.context_initial_utf8_bytes,"maximum_utf8_bytes":MAX_CONTROLLED_CONTEXT_BYTES}}
            manifest=bridge/"manifest.json"
            atomic(manifest,policy,max_bytes=MAX_MANIFEST_BYTES)
            script=Path(__file__).with_name("native_mcp_stdio.py").resolve()
            configuration=home/".gemini/config";configuration.mkdir(parents=True,exist_ok=True)
            mcp={"mcpServers":{"nodia_runtime":{"command":sys.executable,"args":[str(script),str(manifest)],"cwd":str(workspace)}}}
            (configuration/"mcp_config.json").write_text(json.dumps(mcp),encoding="utf-8")
            settings=home/".gemini/antigravity-cli/settings.json"
            settings.write_text(json.dumps({"toolPermission":"request-review","notifications":False,"showTips":False,"useG1Credits":False,"enableTerminalSandbox":True,"permissions":{"allow":["mcp(nodia_runtime/"+tool.name+")" for tool in request.tools]+[f"read_file({permission_path(path)})" for path in attachment_paths],"deny":["command(*)","unsandboxed(*)",f"read_file({permission_path(home)})" if attachment_paths else "read_file(*)","write_file(*)","read_url(*)","execute_url(*)"]}}),encoding="utf-8")
            argv=[sys.executable,str(script),"gate",str(manifest),str(bridge/"gate.jsonl")]
            command=subprocess.list2cmdline(argv) if sys.platform=="win32" else shlex.join(argv)
            if sys.platform=="win32" and any(c in command for c in "&|<>^%!\r\n"): raise ValueError("Unsafe hook path")
            (configuration/"hooks.json").write_text(json.dumps({"nodia-mcp":{"PreToolUse":[{"matcher":"*","hooks":[{"type":"command","command":command,"timeout":3}]}]}}),encoding="utf-8")
            args=["--input-format","stream-json","--output-format","stream-json","--json-schema",json.dumps(Answer.model_json_schema()),"--disable-slash-commands","--sandbox","--print-timeout",str(request.timeout_seconds)+"s","--log-file",str(root/"cli.log"),*options,"--agent",agent_name]
            job.phase="running_cli"
            process=asyncio.create_task(runner.run(args,stdin=(json.dumps({"event":"user","message":{"content":prompt}})+"\n").encode(),cwd=workspace,home=home,timeout=request.timeout_seconds,stdout_observer=job.trace.feed,stderr_observer=job.trace.feed_error))
            watcher=asyncio.create_task(self.watch(job))
            try:
                done,_=await asyncio.wait((process,watcher),return_when=asyncio.FIRST_COMPLETED)
                if watcher in done:
                    await watcher
                    raise ValueError("MCP supervisor ended")
                raw,code=await process
                job.exit_code=code
                self.check_context_delivery(job, final=True)
                await self.read_requests(job)
            finally:
                for task in (process,watcher):
                    if not task.done():task.cancel()
                await asyncio.gather(process,watcher,return_exceptions=True)
            job.phase="validating_cli_events"
            events=[bounded_json(line.encode(),2097152) for line in raw.splitlines() if line.strip()]
            verify_execution_agent(agent_file,workspace,"mcp",bool(attachment_paths))
            initializations=[event.get("init") for event in events if event.get("event")=="init"]
            if len(initializations)!=1 or not isinstance(initializations[0],dict) or initializations[0].get("agent")!=agent_name:
                raise ValueError("MCP native agent mismatch")
            job.phase="validating_model"
            if any(event.get("event")=="init" and event.get("init",{}).get("model")!=request.model_id for event in events):raise ValueError("Model mismatch")
            results=[event["result"] for event in events if event.get("event")=="result"]
            job.phase="validating_terminal"
            if code!=0 or len(results)!=1 or results[0].get("status")!="SUCCESS" or results[0].get("denied_actions"):raise ValueError("Invalid terminal result")
            receipt=bridge/"gate.jsonl"
            job.phase="validating_hook"
            required_documents={"attachment_"+str(index) for index in range(len(attachment_paths))}
            allowed={tool.name for tool in request.tools}|{"finish"}|required_documents
            try:
                if not receipt.is_file() or receipt.stat().st_size>65536:raise ValueError("Missing tool gate proof")
                decisions=[bounded_json(line.encode()) for line in receipt.read_text(encoding="utf-8").splitlines()]
                if not decisions or any(set(item)!={"tool","allowed"} or item["allowed"] is not True or item["tool"] not in allowed for item in decisions):raise ValueError("Tool gate failed")
                if not required_documents.issubset({item["tool"] for item in decisions}):raise ValueError("Attachment unread")
                require_completed_attachment_reads(events,attachment_paths)
            finally:
                try: job.hook_diagnostic=capture_gate_diagnostic(bridge,allowed)
                except Exception: job.hook_diagnostic=None  # Supplemental diagnostics must not alter the proof outcome.
            job.gate_verified=True
            self.check_context_delivery(job, final=True)
            return Answer.model_validate(results[0].get("structured_output"))

    async def read_requests(self,job):
        directory=job.directory
        if directory is None:return
        files=sorted((directory/"requests").glob("*.json"))
        if len(files)>128:raise ValueError("RPC budget")
        for path in files:
            sequence=int(path.stem)
            if sequence<=job.rpc_messages:continue
            event=bounded_json(path.read_bytes())
            if sequence!=job.rpc_messages+1 or event.get("rpc_messages")!=sequence:raise ValueError("RPC order")
            requests=event.get("tool_requests")
            if (type(requests) is not int or requests < job.tool_requests
                    or requests > job.tool_requests+1 or requests > sequence):
                raise ValueError("Tool request order")
            previous_requests=job.tool_requests
            job.rpc_messages=sequence
            job.tool_requests=requests
            if requests>12:raise ValueError("Tool budget")
            if event.get("kind")=="tool_request":
                if requests != previous_requests+1:raise ValueError("Missing tool request")
                if len(job.pending)>=12 or event.get("name") not in {tool.name for tool in job.request.tools} or not isinstance(event.get("arguments"),dict):raise ValueError("Tool policy")
                call_id=event["call_id"]
                if call_id in job.pending:raise ValueError("Duplicate tool identity")
                job.pending[call_id]=event
                job.callbacks+=1
                job.phase="awaiting_server_callback"
                job.emit("tool_request",call_id=call_id,name=event["name"],arguments=event["arguments"])
            elif event.get("kind")!="rpc":raise ValueError("RPC event kind")

    async def watch(self,job):
        while True:
            self.check_context_delivery(job)
            await self.read_requests(job)
            await asyncio.sleep(0.05)

    def check_context_delivery(self, job, final=False):
        if job.directory is not None:
            try:
                state=check_context_budget(job.directory, final=final)
                if state is not None:
                    job.context_used_utf8_bytes=state["used_utf8_bytes"]
            except (ValueError, OSError):
                job.phase="context_budget_failed"
                raise ServiceError("context_limit", "El puente MCP agotó el presupuesto de contexto de Nodia.", 413) from None

    async def close(self):
        tasks=[job.task for job in self.jobs.values() if job.task is not None and not job.task.done()]
        for task in tasks:task.cancel()
        await asyncio.gather(*tasks,return_exceptions=True)
