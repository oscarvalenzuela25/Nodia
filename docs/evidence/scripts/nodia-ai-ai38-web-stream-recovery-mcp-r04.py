"""One fresh MCP canary after the exact Web diagnostic adoption, never a retry."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

DRIVER_SHA = '118554a41d3403695c41a9c86007eb36a610f98855f5cc7c8c22d542fdaab7ba'
HARNESS_SHA = '95cdfdc53e86cf44c892273185c11ee2d319c636fbb0db6cd39980b12d42c87d'
PLAN_SHA = 'f0ed5fa6c2d9de4eebb1223042e08c0360f77bae904a064e5a210b1adc1b510a'
IMAGE = 'sha256:6b9e2f7e3273f89c4c2285c852135213bb82a3391bfe06895f523554033acb49'
WORK = Path('/opt/nodia/verification/ai38-web-stream-recovery-mcp-r04')


def require(ok, code):
    if not ok:
        raise ValueError(code)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def exact(path, pin):
    require(path.is_file() and not path.is_symlink() and sha(path) == pin, 'input_pin_mismatch')


def adopted_epoch(value):
    require(value['status'] == 'adopt_completed' and value['phase'] == 'fix'
            and value['plan_sha256'] == PLAN_SHA and value['new_epoch_requires_explicit_inference_MCP_acceptance'] is True,
            'fresh_exact_adoption_required')
    require(len(value['public_sources_after']) == 49 and value['quiet_after']['SQL']['pending_jobs'] == 0
            and value['quiet_after']['SQL']['open_attempts'] == 0 and value['quiet_after']['SQL']['retained_slots'] == 0,
            'adoption_inventory_or_SQL_not_quiet')
    native = value['quiet_after']['native']
    require(all(native[k] == 0 for k in ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs',
                'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories')),
            'adoption_native_not_quiet')
    epoch = value['epoch_after']
    require(epoch['image_id'] == IMAGE, 'unexpected_adopted_image')
    return dict(id=epoch['container_id'], image=epoch['image_id'], started_at=epoch['started_at_utc'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-driver', type=Path, required=True)
    parser.add_argument('--harness', type=Path, required=True)
    parser.add_argument('--adoption-report', type=Path, required=True)
    parser.add_argument('--adoption-sha256', required=True)
    parser.add_argument('--execute-one-live', action='store_true')
    args = parser.parse_args()
    require(args.execute_one_live is True, 'explicit_one_new_generation_required')
    exact(args.base_driver, DRIVER_SHA)
    exact(args.harness, HARNESS_SHA)
    exact(args.adoption_report, args.adoption_sha256)
    expected = adopted_epoch(json.loads(args.adoption_report.read_bytes()))
    require(not WORK.exists(), 'new_work_already_exists_no_replay')
    spec = importlib.util.spec_from_file_location('ai38_frozen_MCP_new_epoch', args.base_driver)
    base = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(base)
    require(base.epoch(IMAGE) == expected, 'adopted_epoch_changed')
    base.WORK = WORK
    result = base.run(SimpleNamespace(expected_image=IMAGE, harness=str(args.harness), execute_one_live=True))
    report = WORK / 'public-report.json'
    control = dict(schema='ai38-web-stream-fresh-MCP-control-v1', maximum_new_generations=1,
        automatic_retries=0, inference_replay=False, adoption_sha256=args.adoption_sha256,
        base_driver_sha256=DRIVER_SHA, harness_sha256=HARNESS_SHA, plan_sha256=PLAN_SHA,
        expected_epoch=expected, same_epoch_after=base.epoch(IMAGE) == expected,
        new_report_sha256=sha(report), provider_generation_run_by_root_only=True,
        observed_at_utc=datetime.now(timezone.utc).isoformat())
    with (WORK / 'fresh-epoch-control.json').open('x') as stream:
        stream.write(json.dumps(control, indent=2) + '\n')
    return result


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError, TypeError):
        print(json.dumps({'status': 'fresh_MCP_control_failed_no_replay', 'raw_details_emitted': False}))
        raise SystemExit(1)
