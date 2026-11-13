#!/usr/bin/env python3
"""Headless Secret Service lifecycle. Never enumerates or exports account secrets.

Derived from the successful private-keyring r03 procedure recorded on 2026-10-27.
The root installer supplies a new, independent systemd credential on first setup.
"""
import json
import os
from pathlib import Path
import pwd
import re
import stat
import subprocess
import sys
import time

BUS = 'unix:path=/run/nodia-codex/bus'
RUNTIME = Path('/run/nodia-codex-keyring')
STORE = Path('/var/lib/nodia/codex-keyring')
DAEMON = '/usr/bin/gnome-keyring-daemon'


def require(condition, code):
    if not condition:
        raise RuntimeError(code)


def identity():
    user = pwd.getpwnam('nodia')
    require(os.getuid() == user.pw_uid and os.getgid() == user.pw_gid,
            'service_identity_invalid')
    require(os.environ.get('DBUS_SESSION_BUS_ADDRESS') == BUS,
            'bus_environment_invalid')
    require(os.environ.get('XDG_RUNTIME_DIR') == str(RUNTIME),
            'runtime_environment_invalid')
    require(os.environ.get('XDG_DATA_HOME') == str(STORE),
            'store_environment_invalid')
    for path in (RUNTIME, STORE):
        info = path.lstat()
        require(stat.S_ISDIR(info.st_mode) and not path.is_symlink()
                and info.st_uid == user.pw_uid and info.st_gid == user.pw_gid
                and not info.st_mode & 0o077 and path.resolve() == path,
                'private_directory_invalid')
    return user


def existing_owner(expected):
    """Address the already-owned unique name; never auto-activate a second daemon."""
    import dbus
    require(type(expected) is int and expected > 1, 'expected_owner_invalid')
    bus = dbus.bus.BusConnection(BUS)
    daemon = dbus.Interface(bus.get_object('org.freedesktop.DBus',
        '/org/freedesktop/DBus', introspect=False), 'org.freedesktop.DBus')
    dest = str(daemon.GetNameOwner('org.freedesktop.secrets', timeout=3))
    require(int(daemon.GetConnectionUnixProcessID(dest, timeout=3)) == expected,
            'keyring_owner_mismatch')
    require(int(daemon.GetConnectionUnixUser(dest, timeout=3)) == os.getuid(),
            'keyring_owner_mismatch')
    return bus, dest


def bus_ready():
    user = pwd.getpwnam('nodia')
    require(os.getuid() == user.pw_uid and os.getgid() == user.pw_gid,
            'service_identity_invalid')
    for _ in range(200):
        try:
            info = Path('/run/nodia-codex/bus').lstat()
            if stat.S_ISSOCK(info.st_mode) and info.st_uid == user.pw_uid:
                break
        except FileNotFoundError:
            pass
        time.sleep(0.025)
    else:
        raise RuntimeError('private_bus_missing')
    import dbus
    bus = dbus.bus.BusConnection(BUS)
    daemon = dbus.Interface(bus.get_object('org.freedesktop.DBus',
        '/org/freedesktop/DBus', introspect=False), 'org.freedesktop.DBus')
    daemon.GetId(timeout=3)


def initialize(expected):
    identity()
    control = RUNTIME / 'keyring' / 'control'
    for _ in range(200):
        if control.exists():
            break
        time.sleep(0.025)
    require(control.exists(), 'keyring_control_missing')
    result = subprocess.run([DAEMON, '--start', '--components=secrets',
        '--control-directory=' + str(RUNTIME / 'keyring')],
        capture_output=True, timeout=10, check=False)
    require(result.returncode == 0, 'keyring_activation_failed')
    existing_owner(expected)


def run():
    identity()
    directory = Path(os.environ.get('CREDENTIALS_DIRECTORY', ''))
    require(directory.is_absolute() and '..' not in directory.parts
            and not directory.is_symlink(), 'credential_directory_invalid')
    descriptor = os.open(directory / 'password', os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0
                and info.st_nlink == 1 and not info.st_mode & 0o007
                and 0 < info.st_size <= 4096, 'credential_file_invalid')
        password = stream.read(4097)
    # Installer generates exactly 64 hex characters, without line terminators.
    # Never trim/rewrite a different credential to manufacture unlock success.
    require(re.fullmatch(rb'[0-9a-f]{64}', password) is not None,
            'credential_format_invalid')
    os.umask(0o077)
    read, write = os.pipe()
    try:
        require(os.write(write, password) == len(password), 'credential_pipe_failed')
    finally:
        os.close(write)
    password = None
    os.dup2(read, 0)
    os.close(read)
    os.execv(DAEMON, [DAEMON, '--foreground', '--login',
                     '--control-directory=' + str(RUNTIME / 'keyring')])


def nonce(action, token, expected):
    """Write own UUID-scoped nonce, or verify/delete it after a keyring restart."""
    identity()
    require(action in ('create', 'read-delete')
            and re.fullmatch('[0-9a-f]{32}', token) is not None, 'nonce_invalid')
    import dbus
    bus, dest = existing_owner(expected)
    service = dbus.Interface(bus.get_object(dest, '/org/freedesktop/secrets',
        introspect=False), 'org.freedesktop.Secret.Service')
    path = service.ReadAlias('default', timeout=3)
    require(str(path) != '/', 'default_collection_missing')
    collection = dbus.Interface(bus.get_object(dest, path, introspect=False),
                                'org.freedesktop.Secret.Collection')
    properties = dbus.Interface(bus.get_object(dest, path, introspect=False),
                                'org.freedesktop.DBus.Properties')
    require(not bool(properties.Get('org.freedesktop.Secret.Collection',
                                    'Locked', timeout=3)), 'collection_locked')
    _, session = service.OpenSession('plain', dbus.String('', variant_level=1), timeout=3)
    attributes = {'application': 'nodia-production-owned-nonce', 'nonce': token}
    secret = ('NODIA-OWNED-' + token).encode()
    try:
        items, locked = service.SearchItems(dbus.Dictionary(attributes, signature='ss'), timeout=3)
        if action == 'create':
            require(not items and not locked, 'nonce_already_present')
            values = dbus.Dictionary({
                'org.freedesktop.Secret.Item.Label': dbus.String('Nodia owned persistence nonce', variant_level=1),
                'org.freedesktop.Secret.Item.Attributes': dbus.Dictionary(attributes, signature='ss', variant_level=1),
            }, signature='sv')
            payload = dbus.Struct((dbus.ObjectPath(session), dbus.Array([], signature='y'),
                dbus.ByteArray(secret), dbus.String('text/plain')), signature='oayays')
            item, prompt = collection.CreateItem(values, payload, False, timeout=3)
            require(str(prompt) == '/' and str(item).startswith(str(path) + '/'),
                    'nonce_prompt_or_path_invalid')
        else:
            require(len(items) == 1 and not locked, 'nonce_not_found')
            item = items[0]
        native = dbus.Interface(bus.get_object(dest, item, introspect=False),
                               'org.freedesktop.Secret.Item')
        require(bytes(native.GetSecret(session, timeout=3)[2]) == secret, 'nonce_mismatch')
        if action == 'read-delete':
            require(str(native.Delete(timeout=3)) == '/', 'nonce_delete_failed')
            items, locked = service.SearchItems(dbus.Dictionary(attributes, signature='ss'), timeout=3)
            require(not items and not locked, 'nonce_delete_failed')
        print(json.dumps({'status': 'verified', 'action': action,
            'synthetic_nonce_roundtrip': True, 'real_entries_read': 0,
            'nonce_deleted': action == 'read-delete'}))
    finally:
        dbus.Interface(bus.get_object(dest, session, introspect=False),
                       'org.freedesktop.Secret.Session').Close(timeout=3)


def main():
    args = sys.argv[1:]
    if args == ['bus-ready']:
        bus_ready()
    elif args == ['run']:
        run()
    elif len(args) == 2 and args[0] == 'initialize' and args[1].isdigit():
        initialize(int(args[1]))
    elif len(args) == 4 and args[0] == 'nonce' and args[3].isdigit():
        nonce(args[1], args[2], int(args[3]))
    else:
        raise RuntimeError('arguments_invalid')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # D-Bus/subprocess failures can include private values; publish fixed categories only.
        code = str(error) if type(error) is RuntimeError else 'keyring_operation_failed'
        print(json.dumps({'status': 'failed', 'error_code': code}), file=sys.stderr)
        raise SystemExit(1)
