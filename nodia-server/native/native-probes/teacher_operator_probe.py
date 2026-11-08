"""Importable two-turn fixture for the existing admitted Teacher SQL/Native flow.

No standalone live entrypoint, account loader, SQL writer or inference call.
Root's private integration must supply the real TeacherReference and an async
assert_sql_admitted(reference), then pass this wrapper through the existing
NativeTeacherText service. Profiles admission is rechecked at the pipe boundary.
"""
import hashlib
import json
from pathlib import Path
import shlex
import sys

from teacher_text_execution import AGENT_DOCUMENT, AGENT_NAME, parse_terminal, process_closed

CLI_SHA512 = "f57ad0a04c93e1d13b86bd13c4f35b6577bc0557e6bfd718e9f3a2bdb4504240113f6bbcfefad9f039eb1d5e7e23e0a2623b4b7687882eca86954e485ad9f9c2"
GATE_SHA256 = "994cfd59965dc066fc8c05567b4d074c88b376eb7dc435975d17bbd15df04f39"


class TwoTurnBudget:
    def __init__(self):
        self.used = set()

    def consume(self, mode):
        if mode not in ("positive", "hook_fail") or mode in self.used or len(self.used) >= 2:
            raise ValueError("Probe budget exhausted")
        self.used.add(mode)  # Never refund after an attempted dispatch.


class TeacherProbeRunner:
    def __init__(self, runner, profiles, reference, *, mode, budget, assert_sql_admitted):
        if mode not in ("positive", "hook_fail") or not callable(assert_sql_admitted):
            raise ValueError("Admitted probe integration required")
        pins = json.loads(Path(__file__).with_name("source-pins.json").read_text(encoding="utf-8"))
        for name in ("teacher_operator_probe.py", "teacher_probe_hook.py"):
            path = Path(__file__).with_name(name)
            if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != pins["files"][name]:
                raise ValueError("Operator probe source pin mismatch")
        self._runner, self._profiles, self._reference = runner, profiles, reference
        self._mode, self._budget, self._assert_sql = mode, budget, assert_sql_admitted
        self.evidence = None
        self._dispatched = False

    def __getattr__(self, name):
        return getattr(self._runner, name)

    async def run(self, args, **options):
        if args == ["--version"]:
            return await self._runner.run(args, **options)
        ref, profiles = self._reference, self._profiles
        marker = {"attempt_id": ref.attempt_id, "resource_key": ref.resource_key,
                  "session_generation": ref.session_generation, "operation_ref": ref.operation_id}
        identity = profiles.identity("agentic")
        owner = profiles._owners.get(identity)
        if (self._dispatched or identity != ref.resource_key or identity not in profiles._held
                or identity in profiles._quarantined or owner is None or owner.purpose != "execution"
                or profiles._operations.get("agentic") != marker):
            raise ValueError("Existing exact armed profile admission required")
        # Root implementation must query exact real job/attempt/fences and return
        # True explicitly. A missing/default callback cannot admit a live turn.
        if await self._assert_sql(ref) is not True:
            raise ValueError("Exact SQL admission not established")
        if (profiles._owners.get(identity) is not owner or identity not in profiles._held
                or identity in profiles._quarantined or profiles._operations.get("agentic") != marker):
            raise ValueError("Profile admission changed during SQL verification")
        if (self.config.version != "1.3.1" or self.config.sha512 != CLI_SHA512
                or "--agent" not in args or args[args.index("--agent") + 1] != AGENT_NAME
                or "--model" not in args or args[args.index("--model") + 1] != ref.model_id
                or (ref.effort_id is None and "--effort" in args)
                or (ref.effort_id is not None and ("--effort" not in args
                    or args[args.index("--effort") + 1] != ref.effort_id))):
            raise ValueError("Pinned exact Teacher CLI invocation required")
        root = Path(options["cwd"]).resolve()
        home = Path(options["home"]).resolve()
        if (root.name != "workspace" or home.name != "profile" or root.parent != home.parent
                or root.parent.parent != self.config.home.resolve()
                or not root.parent.name.startswith("nodia-teacher-") or Path(options["cwd"]).is_symlink()):
            raise ValueError("Owned ephemeral Teacher workspace required")
        role = root / ".agents/agents" / AGENT_NAME / "agent.md"
        gate = root / "deny_tools.py"
        if (role.is_symlink() or role.read_text(encoding="utf-8") != AGENT_DOCUMENT
                or gate.is_symlink() or hashlib.sha256(gate.read_bytes()).hexdigest() != GATE_SHA256):
            raise ValueError("Pinned owned role and gate required")
        hooks_path = home / ".gemini/config/hooks.json"
        hooks = json.loads(hooks_path.read_text(encoding="utf-8"))
        handlers = hooks[AGENT_NAME]["PreToolUse"]
        if (len(hooks) != 1 or len(handlers) != 1 or handlers[0]["matcher"] != "*"
                or len(handlers[0]["hooks"]) != 1
                or shlex.split(handlers[0]["hooks"][0]["command"]) != [sys.executable, str(gate), str(root / "gate_receipts.jsonl")]):
            raise ValueError("Exact production hook required")
        audit = root / "probe-audit.json"
        fixture = root / "probe_hook.py"
        fixture.write_bytes(Path(__file__).with_name("teacher_probe_hook.py").read_bytes())
        command = [sys.executable, str(fixture), self._mode, str(gate),
                   str(root / "gate_receipts.jsonl"), str(audit)]
        handlers[0]["hooks"][0] = {"type": "command", "command": shlex.join(command), "timeout": 10}
        hooks_path.write_text(json.dumps(hooks), encoding="utf-8")
        self._budget.consume(self._mode)
        self._dispatched = True
        try:
            raw, code = await self._runner.run(args, **options)
            accepted = False
            try:
                parse_terminal(raw, code, root / "gate_receipts.jsonl", ref.model_id)
                accepted = True
            except ValueError:
                pass
            audit_value = json.loads(audit.read_text(encoding="utf-8")) if audit.is_file() else None
            inits = [event.get("init") for line in raw.splitlines() if line.strip()
                     and isinstance(event := json.loads(line), dict) and event.get("event") == "init"]
            exact_catalog = (len(inits) == 1 and isinstance(inits[0], dict)
                and inits[0].get("tools") == ["finish"] and inits[0].get("model") == ref.model_id
                and inits[0].get("agent") == AGENT_NAME)
            self.evidence = {"mode": self._mode, "hook": audit_value,
                "parser_accepted": accepted, "local_closed": process_closed(self._runner),
                "exact_finish_catalog": exact_catalog,
                "cli_exit_code": code, "production_sources_modified": False,
                "probe_workspace_hook_modified": True, "live_turn_count": len(self._budget.used)}
            # Return the untouched CLI result into the actual production parser.
            # Hook-fail therefore follows its normal failure/no-publication path.
            return raw, code
        except BaseException:
            self.evidence = {"mode": self._mode, "parser_accepted": False,
                             "local_closed": process_closed(self._runner), "bounded_failure": True}
            raise
