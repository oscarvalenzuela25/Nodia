"""Read one designated completed turn, ACK route metadata, and artifact counts.

No chat/provider payload, model document, native proof/token file, acknowledgement,
reconciliation, inference, restart, or mutation is requested by this observer.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess

RUNS = {"A": "2e9cd4ef-160b-4de8-9456-7ea2930550d3", "B": "b4c1221c-549b-48ce-80d1-f5dd790c4cd7"}
CONVERSATION = "a160f615-ea41-4a05-831d-acdbb413ec4d"
UUID = re.compile(r"^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$")
SQL = r"""
import{createRequire}from'node:module';import fs from'node:fs';
const root='/opt/nodia/releases/nodia-server-ai15-20261016';const require=createRequire(root+'/package.json');
const c=require('dotenv').parse(fs.readFileSync(root+'/.env'));const{DataSource}=require('typeorm');
const d=new DataSource({type:'postgres',host:c.POSTGRES_HOST,port:Number(c.POSTGRES_PORT),database:c.POSTGRES_DB,
username:c.POSTGRES_USER,password:c.POSTGRES_PASSWORD,synchronize:false,migrationsRun:false,logging:false,
ssl:c.POSTGRES_SSL==='true'?{rejectUnauthorized:false}:undefined,
extra:{connectionTimeoutMillis:5000,statement_timeout:5000,idle_in_transaction_session_timeout:15000}});
let r;try{await d.initialize();r=d.createQueryRunner();await r.connect();await r.startTransaction('REPEATABLE READ');
await r.query('SET TRANSACTION READ ONLY');
const[tx]=await r.query("SELECT current_setting('transaction_read_only') read_only,current_setting('transaction_isolation') isolation,now() observed_at");
const runs=await r.query(`SELECT id,conversation_id,state,phase,created_at,completed_at,provider_dispatches_used,tool_calls_used,mcp_rpc_messages_used
FROM nodia_ai_runs WHERE id=$1 AND conversation_id=$2 LIMIT 1`,[__RUN_ID__,__CONVERSATION_ID__]);
const attempts=await r.query(`SELECT a.id,a.external_operation_ref,a.phase,a.stage_key,a.started_at,a.ended_at
FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id
WHERE j.run_id=$1 AND j.conversation_id=$2 ORDER BY a.started_at,a.id LIMIT 17`,[__RUN_ID__,__CONVERSATION_ID__]);
await r.commitTransaction();console.log(JSON.stringify({transaction:tx,runs,attempts}));
}finally{if(r?.isTransactionActive)await r.rollbackTransaction();if(r)await r.release();if(d.isInitialized)await d.destroy();}
"""
ARTIFACTS = r"""
import json,os
from pathlib import Path
admission=Path('/app/session_state/runtime_admission')
home=os.environ.get('ANTIGRAVITY_CLI_HOME','').strip()
homes=[Path(home)] if home else []
print(json.dumps({
'unknown_markers':sum(1 for _ in admission.glob('*.unknown')),
'native_proof_files':sum(1 for _ in (admission/'attempts').glob('*.json')),
'temporary_attachment_directories':sum(1 for _ in Path('/app/temp_uploads').glob('native-attachment-*')),
'temporary_cli_directories':sum(sum(1 for _ in root.glob(pattern)) for root in homes for pattern in ['nodia-chat-*','nodia-mcp-*']),
'agentic_home_configured':bool(home),
'proof_token_payload_or_profile_files_opened':False}))
"""


def command(argv, timeout=30, payload=None):
    result = subprocess.run(argv, input=payload, capture_output=True, timeout=timeout, check=False)
    if result.returncode:
        raise RuntimeError("read_only_command_failed")
    return result.stdout


def main(turn):
    run_id = RUNS[turn]
    source = SQL.replace("__RUN_ID__", json.dumps(run_id)).replace("__CONVERSATION_ID__", json.dumps(CONVERSATION))
    sql = json.loads(command(["/usr/local/bin/node", "--input-type=module"], payload=source.encode()))
    assert sql["transaction"]["read_only"] == "on" and sql["transaction"]["isolation"] == "repeatable read"
    assert len(sql["runs"]) == 1 and len(sql["attempts"]) <= 16
    run = sql["runs"][0]
    assert run["id"] == run_id and run["conversation_id"] == CONVERSATION
    assert run["state"] == "completed" and run["completed_at"] is not None
    attempts = [row for row in sql["attempts"] if row["external_operation_ref"] is not None]
    assert attempts and all(UUID.fullmatch(row["id"]) and UUID.fullmatch(row["external_operation_ref"]) for row in attempts)
    assert all(row["external_operation_ref"] == row["id"] for row in attempts)
    identities = {row["external_operation_ref"] for row in attempts}
    started = datetime.fromisoformat(run["created_at"].replace("Z", "+00:00"))
    until = datetime.now(timezone.utc)
    assert 0 <= (until - started).total_seconds() <= 3600
    info = json.loads(command(["docker", "inspect", "nodia-gemini-microservice"]))[0]
    epoch = {key: info[key] for key in ("Id", "Image")}
    epoch["started_at"] = info["State"]["StartedAt"]
    assert info["State"]["Running"]
    captured = subprocess.run(["docker", "logs", "--timestamps", "--since", started.isoformat(),
                               "--until", until.isoformat(), "nodia-gemini-microservice"],
                              capture_output=True, timeout=30, check=False)
    assert captured.returncode == 0
    data = captured.stdout + b"\n" + captured.stderr
    assert len(data) <= 16 * 1024 * 1024
    route = re.compile(rb'"(GET|POST) /nodia-ai/agentic/attempts/([a-f0-9-]{36})/(?:mcp/)?(events|results|attest|reconcile|acknowledge|cancel) HTTP/[0-9.]+" (\d{3})\b')
    routes = Counter()
    # Match only the closed access-line route shape. Do not decode or parse any
    # terminal JSON or provider payload that might occur in other log lines.
    for line in data.splitlines():
        matched = route.search(line)
        if matched and matched[2].decode("ascii") in identities:
            routes[(matched[2].decode("ascii"), matched[1].decode("ascii"), matched[3].decode("ascii"), int(matched[4]))] += 1
    native = json.loads(command(["docker", "exec", "--user", "10001:10001", "nodia-gemini-microservice",
                                 "python", "-c", ARTIFACTS]))
    keys = ("unknown_markers", "native_proof_files", "temporary_attachment_directories", "temporary_cli_directories")
    per_attempt = []
    for identity in sorted(identities):
        count = routes[(identity, "POST", "acknowledge", 200)]
        per_attempt.append({"attempt_id": identity, "HTTP_200_ACK_count": count, "ACK_HTTP_metadata_observed": count > 0,
                            "exact_terminal_diagnostics": None, "terminal_diagnostic_status": "not_read_unknown",
                            "route_counts": [{"method": key[1], "endpoint": key[2], "status": key[3], "count": value}
                                             for key, value in sorted(routes.items()) if key[0] == identity]})
    after = json.loads(command(["docker", "inspect", "nodia-gemini-microservice"]))[0]
    same_epoch = after["Id"] == epoch["Id"] and after["Image"] == epoch["Image"] and after["State"]["StartedAt"] == epoch["started_at"]
    assert same_epoch
    report = {"schema": "ai38-turn-native-r01", "status": "metadata_observed_read_only", "turn": turn,
              "observed_at_VM_utc": until.isoformat(), "source_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "SQL": sql, "container_epoch": epoch, "same_container_epoch_after": same_epoch,
              "log_window": {"since": started.isoformat(), "until": until.isoformat(), "bytes_read": len(data), "raw_emitted": False, "raw_saved": False},
              "per_attempt": per_attempt, "all_attempt_ACK_HTTP_200_observed": all(row["ACK_HTTP_metadata_observed"] for row in per_attempt),
              "native_artifact_counts": {key: native[key] for key in keys},
              "global_native_artifacts_absent": all(native[key] == 0 for key in keys),
              "provider_requests": 0, "configured_SQL_writes": 0, "ACK_or_reconcile_requested": False,
              "services_restarted": False, "profile_bytes_read": False, "proof_token_files_opened": False,
              "terminal_payloads_or_model_documents_parsed": False,
              "limits": ["HTTP ACK observations do not expose or reconstruct terminal proof tokens.",
                         "Exact native terminal diagnostic counters and classifications remain unknown; only SQL run counters and closed access-route metadata are reported.",
                         "Artifact absence alone does not establish why a proof disappeared; file names are counted without opening proof, token, payload or profile bytes.",
                         "No HTTP callback, acknowledgement, reconciliation, provider inference or service mutation is invoked by this observer."]}
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--turn", choices=RUNS, required=True)
    args = parser.parse_args()
    try:
        main(args.turn)
    except Exception:
        print(json.dumps({"schema": "ai38-turn-native-r01", "turn": args.turn, "status": "failed", "diagnostic_details_withheld": True}))
        raise SystemExit(1)
