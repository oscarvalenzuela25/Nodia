"""CurrentUser DPAPI pipe only. Never write or log unwrapped key bytes."""
import ctypes
from ctypes import wintypes
import sys


class Blob(ctypes.Structure):
    _fields_ = [("size", wintypes.DWORD), ("data", ctypes.POINTER(ctypes.c_ubyte))]


def main():
    if sys.platform != "win32" or sys.argv[1:] not in (["wrap"], ["unwrap"]):
        raise ValueError("unsupported_operation")
    raw = sys.stdin.buffer.read(32769)
    if not 1 <= len(raw) <= 32768:
        raise ValueError("invalid_key_input")
    source = (ctypes.c_ubyte * len(raw)).from_buffer_copy(raw)
    entropy_bytes = b"Nodia/Teacher/VM/private-volumes/v1"
    entropy_buffer = (ctypes.c_ubyte * len(entropy_bytes)).from_buffer_copy(entropy_bytes)
    source_blob = Blob(len(raw), source)
    entropy = Blob(len(entropy_bytes), entropy_buffer)
    output = Blob()
    crypt = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    if sys.argv[1] == "wrap":
        operation = crypt.CryptProtectData
        operation.argtypes = [ctypes.POINTER(Blob), wintypes.LPCWSTR, ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
        ok = operation(ctypes.byref(source_blob), "Teacher private volume key", ctypes.byref(entropy), None, None, 1, ctypes.byref(output))
    else:
        operation = crypt.CryptUnprotectData
        operation.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
        ok = operation(ctypes.byref(source_blob), None, ctypes.byref(entropy), None, None, 1, ctypes.byref(output))
    if not ok:
        raise ValueError("dpapi_operation_failed")
    try:
        sys.stdout.buffer.write(ctypes.string_at(output.data, output.size))
        sys.stdout.buffer.flush()
    finally:
        ctypes.memset(output.data, 0, output.size)
        kernel.LocalFree(output.data)
        ctypes.memset(source, 0, len(raw))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        sys.stderr.write("dpapi_operation_failed\n")
        sys.exit(1)
