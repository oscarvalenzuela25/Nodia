"""Read-only, one-attempt CLI-log observer; stdout contains structural data only.

stdin: one closed config object, then optional {kind: stop, attempt_id}.
No application imports, provider calls, profile credentials or raw-log persistence.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import threading
import time

PARSER_SHA256 = 'fc19ab0655d9c06f2985c9fcebfc2f2d236f863fbb7fd3eecc7fb83991bd2ffe'
UUID = re.compile(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}')
CONFIG_KEYS = {'schema_version', 'attempt_id', 'resource_key', 'session_generation',
               'operation_ref', 'marker_path', 'profile_home', 'parser_path',
               'parser_sha256', 'expected_policy', 'maximum_seconds'}


class GuardError(Exception):
    pass


def require(value, reason):
    if not value:
        raise GuardError(reason)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def identity(info):
    return info.st_dev, info.st_ino, info.st_uid


def regular(info):
    return (stat.S_ISREG(info.st_mode) and info.st_nlink == 1
            and not getattr(info, 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0))


def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


class Observer:
    def __init__(self, config):
        require(isinstance(config, dict) and set(config) == CONFIG_KEYS, 'invalid_config')
        require(type(config['schema_version']) is int and config['schema_version'] == 1, 'invalid_config')
        require(isinstance(config['attempt_id'], str) and UUID.fullmatch(config['attempt_id']), 'invalid_config')
        require(config['operation_ref'] == config['attempt_id'], 'invalid_config')
        require(isinstance(config['resource_key'], str) and re.fullmatch(r'gemini-profile:[a-f0-9]{64}', config['resource_key']), 'invalid_config')
        require(isinstance(config['session_generation'], str) and re.fullmatch(r'[a-f0-9]{32}', config['session_generation']), 'invalid_config')
        require(config['parser_sha256'] == PARSER_SHA256, 'parser_hash_mismatch')
        require(type(config['maximum_seconds']) is int and 1 <= config['maximum_seconds'] <= 150, 'invalid_config')
        for key in ('marker_path', 'profile_home', 'parser_path'):
            require(isinstance(config[key], str) and Path(config[key]).is_absolute()
                    and '..' not in Path(config[key]).parts, 'invalid_config')
        self.config = config
        self.home = Path(config['profile_home'])
        self.marker = Path(config['marker_path'])
        require(self.marker.name == config['resource_key'].split(':')[1] + '.unknown', 'invalid_config')
        self.expected_marker = {key: config[key] for key in ('attempt_id', 'resource_key', 'session_generation', 'operation_ref')}
        self.policy_bytes = canonical(config['expected_policy'])
        self.policy_hash = hashlib.sha256(self.policy_bytes).hexdigest()
        self._validate_policy(config['expected_policy'])
        self.started_ns = time.time_ns()
        self.started = time.monotonic()
        self.bound = {}
        self.directory = None
        self.samples = []
        self.last_sample_signature = None
        self.last_log_signature = None
        self.classify = None
        self.reads = 0

    @staticmethod
    def _validate_policy(policy):
        require(isinstance(policy, dict) and set(policy) == {
            'tools', 'rpc_budget', 'tool_budget', 'timeout_seconds', 'cli_json_string_arguments', 'documents', 'context_budget'}, 'invalid_policy')
        require(type(policy['rpc_budget']) is int and policy['rpc_budget'] == 128
                and type(policy['tool_budget']) is int and policy['tool_budget'] == 12
                and type(policy['timeout_seconds']) is int and 1 <= policy['timeout_seconds'] <= 120
                and policy['cli_json_string_arguments'] is True and policy['documents'] == [], 'invalid_policy')
        require(isinstance(policy['tools'], list) and 1 <= len(policy['tools']) <= 74, 'invalid_policy')
        names = []
        for tool in policy['tools']:
            require(isinstance(tool, dict) and set(tool) == {'name', 'description', 'input_schema'}
                    and isinstance(tool['name'], str) and re.fullmatch(r'[a-z][a-z0-9_]{0,63}', tool['name'])
                    and isinstance(tool['description'], str) and 0 < len(tool['description'].encode()) <= 2048
                    and isinstance(tool['input_schema'], dict), 'invalid_policy')
            names.append(tool['name'])
        require(len(names) == len(set(names)), 'invalid_policy')
        budget = policy['context_budget']
        require(isinstance(budget, dict) and set(budget) == {'schema_version', 'initial_utf8_bytes', 'maximum_utf8_bytes'}
                and type(budget['schema_version']) is int and budget['schema_version'] == 1
                and type(budget['initial_utf8_bytes']) is int and 1 <= budget['initial_utf8_bytes'] <= 262144
                and type(budget['maximum_utf8_bytes']) is int and budget['maximum_utf8_bytes'] == 262144, 'invalid_policy')

    def _dir(self, path, owner=None, key=None):
        info = path.lstat()
        require(stat.S_ISDIR(info.st_mode) and not path.is_symlink()
                and not getattr(info, 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0), 'unsafe_directory')
        require(owner is None or info.st_uid == owner, 'foreign_owner')
        if key is not None:
            require(key not in self.bound or self.bound[key] == identity(info), 'identity_changed')
            self.bound[key] = identity(info)
        return info

    def _file(self, path, limit, owner=None, key=None):
        before = path.lstat()
        require(regular(before), 'unsafe_file')
        require(owner is None or before.st_uid == owner, 'foreign_owner')
        require(before.st_size <= limit, 'oversize_file')
        require(key not in self.bound or self.bound[key] == identity(before), 'identity_changed')
        fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_NONBLOCK', 0) | getattr(os, 'O_BINARY', 0))
        try:
            opened = os.fstat(fd)
            require(regular(opened) and identity(opened) == identity(before), 'identity_changed')
            data = os.read(fd, limit + 1)
            after = os.fstat(fd)
            require(len(data) <= limit and identity(after) == identity(before)
                    and (after.st_mtime_ns, after.st_ctime_ns, after.st_size) ==
                    (opened.st_mtime_ns, opened.st_ctime_ns, opened.st_size)
                    and identity(path.lstat()) == identity(before), 'identity_changed')
        finally:
            os.close(fd)
        if key is not None:
            self.bound[key] = identity(before)
        return data, before

    def bootstrap(self):
        info = self._dir(self.home, key='home')
        self.owner = info.st_uid
        require(not hasattr(os, 'geteuid') or os.geteuid() == self.owner, 'foreign_owner')
        self._dir(self.marker.parent, owner=self.owner, key='marker_parent')
        require(not list(self.home.glob('nodia-mcp-*')), 'baseline_not_empty')
        require(not list(self.marker.parent.glob('*.unknown')), 'baseline_active_owner')
        data, _ = self._file(Path(self.config['parser_path']), 65536)
        require(hashlib.sha256(data).hexdigest() == PARSER_SHA256, 'parser_hash_mismatch')
        namespace = {'__name__': 'nodia_owned_log_observer_classifier_tool'}
        exec(compile(data, '<verified-diagnostic-classifier-tool>', 'exec'), namespace)
        self.classify = namespace['_classify_admitted_log_windows']

    def _ownership(self):
        self._dir(self.home, owner=self.owner, key='home')
        self._dir(self.marker.parent, key='marker_parent')
        owners = list(self.marker.parent.glob('*.unknown'))
        if not owners:
            if 'marker' in self.bound:
                raise GuardError('ownership_ended')
            return False
        require(len(owners) == 1 and owners[0] == self.marker, 'foreign_active_owner')
        data, info = self._file(self.marker, 4096, owner=self.owner, key='marker')
        require(info.st_ctime_ns >= self.started_ns, 'stale_marker')
        try:
            marker = json.loads(data)
        except (ValueError, UnicodeError):
            raise GuardError('invalid_marker') from None
        require(canonical(marker) == canonical(self.expected_marker), 'foreign_marker')
        return True

    def _bind_directory(self):
        directories = list(self.home.glob('nodia-mcp-*'))
        require(len(directories) <= 1, 'ambiguous_directory')
        if not directories:
            require(self.directory is None, 'directory_disappeared')
            return False
        candidate = directories[0]
        require(self.directory is None or self.directory == candidate, 'identity_changed')
        info = self._dir(candidate, owner=self.owner, key='directory')
        require(info.st_ctime_ns >= self.started_ns, 'stale_directory')
        self.directory = candidate
        try:
            self._dir(candidate / 'bridge', owner=self.owner, key='bridge')
            data, _ = self._file(candidate / 'bridge/manifest.json', 135168, owner=self.owner, key='manifest')
        except FileNotFoundError:
            require('manifest' not in self.bound, 'manifest_disappeared')
            return False
        try:
            policy = json.loads(data)
        except (ValueError, UnicodeError):
            raise GuardError('invalid_manifest') from None
        require(canonical(policy) == self.policy_bytes, 'policy_mismatch')
        return True

    def sample(self):
        if not self._ownership() or not self._bind_directory():
            return
        path = self.directory / 'cli.log'
        try:
            before = path.lstat()
        except FileNotFoundError:
            require('log' not in self.bound, 'log_disappeared')
            return
        require(regular(before) and before.st_uid == self.owner, 'unsafe_log')
        require('log' not in self.bound or self.bound['log'] == identity(before), 'identity_changed')
        self.bound['log'] = identity(before)
        signature = (before.st_size, before.st_mtime_ns)
        if signature == self.last_log_signature:
            return
        fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_NONBLOCK', 0) | getattr(os, 'O_BINARY', 0))
        try:
            opened = os.fstat(fd)
            require(regular(opened) and identity(opened) == self.bound['log'], 'identity_changed')
            if opened.st_size > 131072:
                head = os.read(fd, 65536)
                os.lseek(fd, max(0, opened.st_size - 65536), os.SEEK_SET)
                windows = (head, os.read(fd, 65535))
            else:
                windows = (os.read(fd, 131072),)
            result = self.classify(windows)
            require(identity(os.fstat(fd)) == self.bound['log']
                    and identity(path.lstat()) == self.bound['log'], 'identity_changed')
        finally:
            os.close(fd)
        # Never publish a sample unless ownership and exact public policy still hold.
        require(self._ownership() and self._bind_directory(), 'ownership_ended')
        sample = {'observed_at_utc': utc(), 'elapsed_ms': round((time.monotonic() - self.started) * 1000),
                  'file_size_at_sample': opened.st_size,
                  'bytes_read': sum(len(window) for window in windows),
                  'byte_window_truncated': opened.st_size > 131072,
                  'interpretation': 'text_indicator_not_verified_cause', **result}
        self.reads += 1
        self.last_log_signature = signature
        if len(self.samples) < 128:
            self.samples.append(sample)
        else:
            self.samples[-1] = sample

    def result(self, reason):
        return {'kind': 'result', 'schema_version': 1, 'attempt_id': self.config['attempt_id'],
                'state': 'stopped' if reason in {'requested_stop', 'ownership_ended', 'directory_disappeared', 'log_disappeared', 'maximum_duration'} else 'rejected',
                'reason': reason, 'observed_at_utc': utc(), 'samples': self.samples,
                'parser_sha256': PARSER_SHA256, 'expected_policy_sha256': self.policy_hash,
                'bounded_log_reads': self.reads, 'maximum_read_bytes_per_window': 131072,
                'raw_content_persisted': False, 'private_paths_emitted': False,
                'provider_requests': 0, 'runtime_mutations': 0}


def main():
    observer = None
    try:
        line = sys.stdin.buffer.readline(200001)
        require(len(line) <= 200000, 'invalid_config')
        config = json.loads(line)
        observer = Observer(config)
        observer.bootstrap()
        print(json.dumps({'kind': 'ready', 'schema_version': 1, 'attempt_id': config['attempt_id'],
                          'baseline_directories': 0, 'baseline_marker_absent': True,
                          'parser_sha256': PARSER_SHA256, 'expected_policy_sha256': observer.policy_hash,
                          'observed_at_utc': utc()}), flush=True)
        stopped = threading.Event()
        control_error = []

        def control():
            raw = sys.stdin.buffer.readline(4097)
            if not raw:
                return
            try:
                require(len(raw) <= 4096 and json.loads(raw) == {'kind': 'stop', 'attempt_id': config['attempt_id']}, 'invalid_stop')
            except Exception:
                control_error.append('invalid_stop')
            stopped.set()

        threading.Thread(target=control, daemon=True).start()
        while time.monotonic() - observer.started < config['maximum_seconds']:
            if stopped.is_set():
                raise GuardError(control_error[0] if control_error else 'requested_stop')
            observer.sample()
            stopped.wait(0.1)
        raise GuardError('maximum_duration')
    except GuardError as error:
        reason = str(error)
    except FileNotFoundError:
        reason = 'file_disappeared'
    except Exception:
        reason = 'observer_error'
    if observer is None:
        print(json.dumps({'kind': 'result', 'schema_version': 1, 'state': 'rejected',
                          'reason': reason, 'samples': [], 'provider_requests': 0}), flush=True)
    else:
        print(json.dumps(observer.result(reason)), flush=True)


if __name__ == '__main__':
    main()
