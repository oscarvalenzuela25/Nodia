"""Readonly container /proc metadata projection; no app imports or CLI execution."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import select
import sys
import time

def classify(arguments, model, effort):
    if arguments == ['models']:
        return 'models'
    if arguments == ['-p', '/usage', '--output-format', 'json', '--print-timeout', '12s']:
        return 'usage'
    expected = ['-p', '/model', '--output-format', 'json', '--print-timeout', '10s', '--model', model]
    if effort is not None:
        expected += ['--effort', effort]
    return 'model' if arguments == expected else None

def process(pid):
    try:
        base = Path('/proc') / str(pid)
        uid_line = next(line for line in (base / 'status').read_text().splitlines() if line.startswith('Uid:'))
        if int(uid_line.split()[1]) != 10001:
            return None
        data = (base / 'stat').read_text()
        fields = data[data.rfind(')') + 2:].split()
        return {'pid': pid, 'state': fields[0], 'ppid': int(fields[1]), 'group': int(fields[2]), 'start_ticks': int(fields[19])}
    except (OSError, StopIteration, ValueError, IndexError):
        return None

def sample(binary, model, effort):
    all_processes = {}
    candidates = []
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit():
            continue
        item = process(int(entry.name))
        if item is None:
            continue
        all_processes[item['pid']] = item
        try:
            # Bound reading; never return or persist any argv bytes.
            with (entry / 'cmdline').open('rb') as stream:
                raw = stream.read(4097)
            if len(raw) > 4096:
                continue
            args = raw.decode('utf-8', errors='strict').strip('\0').split('\0')
            if not args or args[0] != binary:
                continue
            kind = classify(args[1:], model, effort)
            candidates.append({**item, 'kind': kind or 'non_metadata_cli'})
        except (OSError, UnicodeError):
            continue
    return candidates, all_processes

def cgroup_metrics():
    root = Path('/sys/fs/cgroup')
    result = {}
    for name, allowed in {
        'cpu.stat': {'usage_usec', 'user_usec', 'system_usec', 'nr_periods', 'nr_throttled', 'throttled_usec'},
        'memory.events': {'low', 'high', 'max', 'oom', 'oom_kill', 'oom_group_kill'},
    }.items():
        try:
            result[name] = {key: int(value) for key, value in (line.split() for line in (root / name).read_text().splitlines()) if key in allowed}
        except OSError:
            result[name] = None
    for name in ('cpu.max', 'memory.current', 'memory.max', 'pids.current', 'pids.max'):
        try:
            text = (root / name).read_text().strip()
            assert all(part == 'max' or part.isdigit() for part in text.split())
            result[name] = text if name == 'cpu.max' or text == 'max' else int(text)
        except OSError:
            result[name] = None
    result['scope'] = 'same_container_cgroup_includes_app_CLI_and_readonly_observer_overhead'
    return result

def main():
    config = json.loads(sys.stdin.readline())
    assert set(config) == {'model_id', 'effort_id', 'maximum_seconds'}
    assert config['maximum_seconds'] == 40
    assert isinstance(config['model_id'], str) and 0 < len(config['model_id']) <= 1024
    assert config['effort_id'] is None or isinstance(config['effort_id'], str)
    assert os.getuid() == 10001
    assert Path('/proc/self/cgroup').read_bytes() == Path('/proc/1/cgroup').read_bytes()
    binary = os.environ['ANTIGRAVITY_CLI_PATH']
    assert binary.startswith('/opt/nodia/antigravity-cli/') and Path(binary).name == 'agy'
    assert hashlib.sha512(Path(binary).read_bytes()).hexdigest() == 'f57ad0a04c93e1d13b86bd13c4f35b6577bc0557e6bfd718e9f3a2bdb4504240113f6bbcfefad9f039eb1d5e7e23e0a2623b4b7687882eca86954e485ad9f9c2'
    baseline, _ = sample(binary, config['model_id'], config['effort_id'])
    assert not baseline, 'metadata_observer_baseline_CLI_not_empty'
    started = time.monotonic()
    def stamp():
        return {'at_utc': datetime.now(timezone.utc).isoformat(), 'monotonic_ms': time.monotonic() * 1000}
    print(json.dumps({'kind': 'ready', 'baseline_CLI_processes': 0, 'same_container_cgroup': True, 'sample_interval_ms': 20,
        'cgroup_metrics_before': cgroup_metrics(), **stamp()}), flush=True)
    observed = {}
    members = {}
    state = 'maximum_window_elapsed'
    while time.monotonic() - started < config['maximum_seconds']:
        if select.select([sys.stdin], [], [], 0)[0]:
            line = sys.stdin.readline()
            if line:
                assert json.loads(line) == {'kind': 'stop'}
                state = 'caller_stopped_after_HTTP_closed'
                break
        primaries, all_processes = sample(binary, config['model_id'], config['effort_id'])
        now = stamp()
        for item in primaries:
            key = (item['pid'], item['start_ticks'])
            if key not in observed:
                observed[key] = {k: item[k] for k in ('pid', 'group', 'start_ticks', 'kind')}
                observed[key].update({'first_seen': now, 'last_seen': now, 'first_zombie_seen': None, 'exit_observed': None})
            observed[key]['last_seen'] = now
            if item['state'] == 'Z' and observed[key]['first_zombie_seen'] is None:
                observed[key]['first_zombie_seen'] = now
        for key, row in observed.items():
            current = all_processes.get(row['pid'])
            if (current is None or current['start_ticks'] != row['start_ticks']) and row['exit_observed'] is None:
                row['exit_observed'] = now
            for item in all_processes.values():
                if item['group'] != row['group'] or item['pid'] == row['pid']:
                    continue
                mk = (item['pid'], item['start_ticks'])
                if mk not in members:
                    members[mk] = {k: item[k] for k in ('pid', 'group', 'start_ticks')}
                    members[mk].update({'first_seen': now, 'last_seen': now, 'exit_observed': None})
                members[mk]['last_seen'] = now
        for key, row in members.items():
            current = all_processes.get(row['pid'])
            if (current is None or current['start_ticks'] != row['start_ticks']) and row['exit_observed'] is None:
                row['exit_observed'] = now
        assert len(observed) <= 8 and len(members) <= 24, 'bounded_observer_cardinality_exceeded'
        time.sleep(0.02)
    print(json.dumps({'kind': 'result', 'state': state, 'commands': list(observed.values()), 'related_process_group_members': list(members.values()),
        'cgroup_metrics_after': cgroup_metrics(), 'command_output_shape': None, 'command_exit_codes': None, 'raw_arguments_or_paths_emitted': False,
        'profile_or_credentials_read': False, 'CLI_executions_by_observer': 0, 'timestamps_scope': 'VM_monotonic_clock_with_20ms_sampling_uncertainty', **stamp()}), flush=True)

if __name__ == '__main__':
    main()
