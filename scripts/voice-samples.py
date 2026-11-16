"""Voice samples for Settings > Voice (EJSZAKA E109): one short sentence per (language, engine, person),
12 mono MP3 in assets/voice-samples/<lang>-<engine>-<f|m>.mp3, shipped inside the app so a voice can be
heard before anything is downloaded.

Commands (always run isolated, `python -I`):
  gen --engine kokoro   Kokoro voices (es, en). Venv with kokoro_onnx + soundfile (C:\\Users\\kalma\\tools\\kokoro\\.venv).
  gen --engine piper    Piper voices (es, en, hu, de) through sherpa-onnx. Venv outside the repo with sherpa-onnx +
                        soundfile (C:\\AI\\_work\\voice-samples\\.venv), pinned sherpa-onnx==1.13.8 and numpy==2.5.4
                        (sherpa-onnx 2.0.1 makes no Piper sound here, numpy 2.5.5 is blocked by the Application
                        Control policy). The models are not in the repo: the script looks
                        for vits-piper-<key>-int8/ under VOICE_SAMPLES_MODELS (default C:\\AI\\_work\\voice-samples\\models).
  verify                Every file exists and passes the tts-pack.py threshold: length > 0.2 s, peak > 0.05.

Voices, sentences and file names follow lib/neuralVoices.ts (KOKORO_VOICES, PIPER_VOICES) and lib/voiceSample.ts.
"""
import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "voice-samples"
MODELS = Path(os.environ.get("VOICE_SAMPLES_MODELS", r"C:\AI\_work\voice-samples\models"))
KOKORO_HOME = Path(os.environ.get("VOICE_SAMPLES_KOKORO", r"C:\Users\kalma\tools\kokoro\model"))

SENTENCES = {
    "es": "Hoy quiero aprender palabras nuevas.",
    "en": "Today I want to learn new words.",
    "hu": "Ma új szavakat szeretnék tanulni.",
    "de": "Heute möchte ich neue Wörter lernen.",
}
KOKORO = {  # lang -> (f voice, m voice, espeak tag)
    "es": ("ef_dora", "em_alex", "es-419"),
    "en": ("af_heart", "am_michael", "en-us"),
}
PIPER = {  # lang -> (f model, m model)
    "es": ("es_MX-claude-high", "es_MX-ald-medium"),
    "en": ("en_US-kristin-medium", "en_US-john-medium"),
    "hu": ("hu_HU-berta-medium", "hu_HU-imre-medium"),
    "de": ("de_DE-kerstin-low", "de_DE-thorsten-medium"),
}


def trim(a, sr, thr=0.004, pad_ms=40):
    import numpy as np

    idx = np.flatnonzero(np.abs(a) > thr)
    if idx.size == 0:
        return a
    pad = int(sr * pad_ms / 1000)
    return a[max(int(idx[0]) - pad, 0): min(int(idx[-1]) + pad + 1, len(a))]


def write_mp3(path: Path, samples, sr: int):
    import numpy as np
    import soundfile as sf

    a = np.asarray(samples, dtype="float32").reshape(-1)
    a = trim(a, sr)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".part")
    sr = int(sr)
    sf.write(str(tmp), a, sr, format="MP3", subtype="MPEG_LAYER_III", compression_level=0.7, bitrate_mode="VARIABLE")
    os.replace(tmp, path)
    print(f"wrote {path.name} {len(a) / sr:.2f}s")


def gen_kokoro(langs) -> int:
    from kokoro_onnx import Kokoro

    k = Kokoro(str(KOKORO_HOME / "kokoro-v1.0.fp16.onnx"), str(KOKORO_HOME / "voices-v1.0.bin"))
    for lang in langs:
        if lang not in KOKORO:
            continue
        f, m, tag = KOKORO[lang]
        for g, voice in (("f", f), ("m", m)):
            samples, sr = k.create(SENTENCES[lang], voice=voice, speed=1.0, lang=tag)
            write_mp3(OUT / f"{lang}-kokoro-{g}.mp3", samples, sr)
    return 0


def piper_tts(key: str):
    import sherpa_onnx

    d = MODELS / f"vits-piper-{key}-int8"
    if not d.is_dir():
        d = MODELS / f"vits-piper-{key}"
    onnx = next(d.glob("*.onnx"))
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=str(onnx), tokens=str(d / "tokens.txt"), data_dir=str(d / "espeak-ng-data")
            ),
            num_threads=2,
            provider="cpu",
        )
    )
    return sherpa_onnx.OfflineTts(cfg)


def gen_piper(langs) -> int:
    for lang in langs:
        for g, key in zip(("f", "m"), PIPER[lang]):
            tts = piper_tts(key)
            audio = tts.generate(SENTENCES[lang], sid=0, speed=1.0)
            write_mp3(OUT / f"{lang}-piper-{g}.mp3", audio.samples, audio.sample_rate)
    return 0


def cmd_verify() -> int:
    import soundfile as sf

    bad = 0
    n = 0
    total = 0
    for lang in SENTENCES:
        for engine in ("kokoro", "piper"):
            if engine == "kokoro" and lang not in KOKORO:
                continue
            for g in ("f", "m"):
                p = OUT / f"{lang}-{engine}-{g}.mp3"
                n += 1
                if not p.exists():
                    print(f"FAIL missing {p.name}")
                    bad += 1
                    continue
                data, sr = sf.read(str(p), dtype="float32", always_2d=False)
                if getattr(data, "ndim", 1) > 1:
                    data = data.mean(axis=1)
                dur = len(data) / sr
                peak = float(abs(data).max()) if len(data) else 0.0
                size = p.stat().st_size
                total += size
                ok = dur > 0.2 and peak > 0.05
                bad += 0 if ok else 1
                print(f"{'ok  ' if ok else 'FAIL'} {p.name} {dur:.2f}s peak {peak:.2f} {size} B")
    print(f"files {n}: {n - bad} ok, {bad} bad, total {total} B")
    return 0 if bad == 0 and n == 12 and total <= 1_000_000 else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("gen")
    g.add_argument("--engine", choices=("kokoro", "piper"), required=True)
    g.add_argument("--lang", nargs="*", default=list(SENTENCES))
    sub.add_parser("verify")
    args = ap.parse_args()
    if args.cmd == "verify":
        return cmd_verify()
    return gen_kokoro(args.lang) if args.engine == "kokoro" else gen_piper(args.lang)


if __name__ == "__main__":
    sys.exit(main())
