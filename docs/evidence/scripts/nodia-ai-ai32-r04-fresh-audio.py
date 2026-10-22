"""Create one fresh synthetic Spanish phrase and three offline fixture formats.

This is evidence tooling, never a user-audio conversion path. Windows SAPI
produces a new WAV; local PyAV encodes its WebM/Ogg Opus fixtures without network
or provider access. The separate oracle must never be placed in a model prompt.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import secrets
import subprocess
import unicodedata
import wave
from pathlib import Path

import av


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-prefix", type=Path, required=True)
    parser.add_argument("--oracle", type=Path, required=True)
    parser.add_argument("--metadata", type=Path, required=True)
    args = parser.parse_args()
    paths = {kind: Path(str(args.output_prefix) + "." + kind) for kind in ("wav", "webm", "ogg")}
    if any(path.exists() for path in (*paths.values(), args.oracle, args.metadata)):
        parser.error("output exists; preserve the previously generated fixture")
    if "libopus" not in av.codecs_available:
        parser.error("installed local PyAV does not expose the Opus encoder")
    # Grammar: feminine singular subject/adjective; masculine plural object.
    text = ("La " + secrets.choice(("torre", "nube", "barca", "senda", "casa", "puerta", "plaza", "luna"))
        + " " + secrets.choice(("verde", "azul", "violeta", "blanca", "dorada", "plateada"))
        + " guarda " + secrets.choice(("bosques", "jardines", "senderos", "caminos", "recuerdos", "secretos", "tesoros", "paisajes"))
        + " " + secrets.choice(("tranquilos", "callados", "serenos", "antiguos", "lejanos", "dorados")) + ".")
    script = r'''
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Speech
$data = [Console]::In.ReadToEnd() | ConvertFrom-Json
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $voices = @($synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Name -eq 'Microsoft Sabina Desktop' -and $_.VoiceInfo.Culture.Name -eq 'es-MX' })
    if ($voices.Count -ne 1) { throw 'Required installed Spanish voice unavailable' }
    $synth.SelectVoice($voices[0].VoiceInfo.Name)
    $synth.Rate = -1
    $synth.SetOutputToWaveFile($data.output)
    $synth.Speak($data.text)
    $synth.SetOutputToNull()
    @{ engine='Windows SAPI/System.Speech'; name=$voices[0].VoiceInfo.Name; culture=$voices[0].VoiceInfo.Culture.Name; installed_and_enabled_observed=$true; synthesis_rate=-1 } | ConvertTo-Json -Compress
} finally { $synth.Dispose() }
'''
    process = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script],
        input=json.dumps({"text": text, "output": str(paths["wav"].resolve())}).encode("utf-8"),
        capture_output=True, timeout=30, check=False)
    if process.returncode:
        raise RuntimeError("offline_synthetic_speech_failed")
    voice = json.loads(process.stdout.decode("utf-8-sig"))
    source = paths["wav"].read_bytes()
    if len(source) > 20 * 1024 * 1024:
        raise RuntimeError("synthetic_fixture_exceeds_bound")
    with wave.open(io.BytesIO(source), "rb") as original:
        wave_shape = {"sample_rate": original.getframerate(), "channels": original.getnchannels(),
            "sample_width_bytes": original.getsampwidth(), "frames": original.getnframes(),
            "duration_seconds": round(original.getnframes() / original.getframerate(), 6)}
    formats = {"wav": {"bytes":len(source), "sha256":hashlib.sha256(source).hexdigest(),
        "duration_seconds":wave_shape["duration_seconds"], "codec":"pcm_s16le", "wave":wave_shape}}
    for kind in ("webm", "ogg"):
        destination = io.BytesIO()
        with av.open(io.BytesIO(source), "r") as original:
            with av.open(destination, "w", format=kind) as encoded:
                stream = encoded.add_stream("libopus", rate=48000)
                stream.layout = "mono"
                resampler = av.AudioResampler(format="s16", layout="mono", rate=48000)
                for frame in original.decode(audio=0):
                    for converted in resampler.resample(frame):
                        for packet in stream.encode(converted):
                            encoded.mux(packet)
                for converted in resampler.resample(None):
                    for packet in stream.encode(converted):
                        encoded.mux(packet)
                for packet in stream.encode(None):
                    encoded.mux(packet)
        content = destination.getvalue()
        with av.open(io.BytesIO(content), "r") as decoded:
            frames = list(decoded.decode(audio=0))
            duration = sum(frame.samples / frame.sample_rate for frame in frames)
        if not frames or not 0 < duration <= 300:
            raise RuntimeError("synthetic_fixture_decode_failed")
        paths[kind].write_bytes(content)
        formats[kind] = {"bytes":len(content), "sha256":hashlib.sha256(content).hexdigest(),
            "duration_seconds":round(duration, 6), "decoded_frames":len(frames), "codec":"opus"}
    normalized = " ".join(re.findall(r"[a-z0-9]+", unicodedata.normalize("NFC", text).casefold()))
    report = {"stage":"AI-32-R04", "scope":"offline_fresh_synthetic_spanish_voice_provenance",
        "generator_sha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "voice":voice, "pyav_version":av.__version__, "format_source":"one_fresh_SAPI_WAV",
        "speech_words_v1_sha256":hashlib.sha256(normalized.encode()).hexdigest(), "formats":formats,
        "phrase_selection":"one secrets.choice sample from bounded grammatical Spanish vocabularies",
        "provider_calls":0, "physical_microphone_recording":False, "private_user_audio_used":False,
        "expected_text_sent_to_provider_prompt":False, "user_audio_conversion_path_modified":False}
    args.oracle.write_text(text + "\n", encoding="utf-8")
    args.metadata.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"metadata":str(args.metadata), "formats":formats,
        "speech_words_v1_sha256":report["speech_words_v1_sha256"]}))


if __name__ == "__main__":
    main()
