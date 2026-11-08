"""Read-only UI image inspector restricted to the exact R07 package.

Delegates to the immutable R06 SQL/R2 reader with the same closed descriptor.
No SDK process, profile observation, upload, object mutation or service change.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

BASE = Path('/opt/nodia/verification/ai40-r06-image-ui-inspection-r01/nodia-ai-ai40-r06-image-ui-inspect-operator-r01.py')
BASE_SHA = '48324dbd99493d5e6ed202df21e7d686fe9fe9d0e5399d880e70e04e3840af20'
STAGE = Path('/opt/nodia/verification/ai40-r07-image-ui-inspection-r01')
INSPECTOR = STAGE / 'nodia-ai-ai40-image-ui-inspect-r01.mjs'
INSPECTOR_SHA = 'df50bbace968b778c2e11c37ab4e8ec48c31cb6a6b4d1a0ad4e2eada6a2ae539'
PACKAGES = {'/opt/nodia/releases/nodia-server-ai40-r07': '1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476'}


def run(args):
    if not BASE.is_file() or BASE.is_symlink() or hashlib.sha256(BASE.read_bytes()).hexdigest() != BASE_SHA:
        raise ValueError('immutable_ui_inspector_pin_mismatch')
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location('immutable_r06_image_ui_inspector', BASE)
    original = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(original)
    original.STAGE, original.INSPECTOR = STAGE, INSPECTOR
    original.INSPECTOR_SHA, original.PACKAGES = INSPECTOR_SHA, PACKAGES
    original.__file__ = str(Path(__file__).resolve())
    result, code = original.run(args)
    return {**result, 'schema': 'nodia-ai-ai40-r07-image-ui-inspection-operator-v1',
            'inherited_read_only_protocol_sha256': BASE_SHA}, code


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--operator-sha256', required=True)
    args = parser.parse_args()
    try:
        result, code = run(args)
        print(json.dumps(result))
        sys.exit(code)
    except Exception as error:
        message = str(error)
        print(json.dumps({'schema': 'nodia-ai-ai40-r07-image-ui-inspection-operator-v1', 'status': 'operator_failed',
                          'error_code': message if re.fullmatch('[a-z][a-z0-9_]{1,95}', message) else None,
                          'error_class': type(error).__name__, 'private_details_emitted': False,
                          'provider_requests': 0, 'services_changed': False, 'configuration_changed': False}))
        sys.exit(1)
