"""Fresh R07 fixtures using the immutable, reviewed R06 raster generator."""
import hashlib
import importlib.util
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'docs/evidence/scripts/nodia-ai-ai40-r06-image-fixtures-r01.py'
BASE_SHA = '6bb80d040969cf1543c390b806f8c3be65a4033451086f7dfc89dd50e4c9f697'


def main():
    if not BASE.is_file() or hashlib.sha256(BASE.read_bytes()).hexdigest() != BASE_SHA:
        raise ValueError('immutable_fixture_generator_changed')
    spec = importlib.util.spec_from_file_location('immutable_r06_raster_generator', BASE)
    generator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(generator)
    generator.OUT = ROOT / '.tmp/ai40-r07-images-r01'
    generator.PRIVATE = generator.OUT / 'private-fixtures'
    generator.REMOTE = PurePosixPath('/opt/nodia/verification/ai40-r07-image-fixtures-r01')
    generator.__file__ = str(Path(__file__).resolve())
    generator.main()


if __name__ == '__main__':
    main()
