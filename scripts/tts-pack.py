#!/usr/bin/env python
"""Kimacha word pack: pre-generated Kokoro audio for the spoken card words.

Run it with the venv that has kokoro-onnx + soundfile, always isolated:
  <venv>\\Scripts\\python.exe -I scripts\\tts-pack.py <command>

Commands:
  selftest                      FNV-1a test vectors (the shared contract of PLAN-tts-1101)
  count                         unique keys per language, characters, collisions; writes keys.json
  gen [--lang es|en] [--limit N] [--shard I/N] [--threads T] [--force]
                                synthesize the missing files (resumable: existing files are kept)
  verify [--n 20]               sample check: length > 0.2 s, peak > 0.05, file name = FNV-1a of the key
  pack                          kimacha-tts-pack-v1.tar.bz2 with index.json

Contract (shared with lib/neuralTts.ts of the app):
  key   = text.trim().normalize('NFC')       (case and article stay: "el perro")
  hash  = FNV-1a 32 bit over the UTF-8 bytes of the key, 8 lowercase hex digits
  voice = hash % 2 === 0 -> voice 0, else voice 1
          es [ef_dora, em_alex], en [af_heart, am_michael]
  index = { "version": 1, "engine": "kokoro-v1.0", "files": { "es": { key: "es/<hash>.mp3" }, "en": {...} } }

Which text the card reads aloud (checked in the app code):
  lib/learn/usePcicSession.ts speak(promptSource, ...) on a new card and speak(best, ...) /
  speakSequence([best, example]) on reveal. promptSource = item[sourceLang], best comes from
  gradePcicAnswer(typed, answerText) in lib/pcicMatch.ts: an alternative of the answer field
  (pcicAlternatives: " / " split, "(optional)" parts, "a/b" within a word) or the full field.
  The decks (data/pcic.ts): en->es = data/words-open (es, en); es->en = data/words/en (es, en);
  hu target = data/words/hu (es, en as prompts). So every es and en field of those files is spoken
  in some direction, and the pack keys are the full field AND its pcicAlternatives.
  Example sentences are NOT in the pack (they go to the on-device engine).
"""
import argparse
import json
import os
import random
import re
import sys
import tarfile
import time
import unicodedata
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = Path(os.environ.get("TTS_PACK_OUT", r"C:\AI\_work\tts-pack"))
TTS_HOME = Path(
    os.environ.get(
        "TTS_PACK_HOME",
        r"C:\Users\kalma\AppData\Local\Temp\claude\C--AI\dbe13cea-450a-4505-98b4-57921173c2f3\scratchpad\tts",
    )
)
MODEL = TTS_HOME / "models" / "kokoro-v1.0.onnx"
VOICES_BIN = TTS_HOME / "models" / "voices-v1.0.bin"

FORMAT = os.environ.get("TTS_PACK_FORMAT", "mp3").lower()  # mp3 | ogg
EXT = FORMAT
SAMPLE_RATE = 24000
LANGS = ("es", "en")
VOICES = {"es": ("ef_dora", "em_alex"), "en": ("af_heart", "am_michael")}
LANG_CODE = {"es": "es-419", "en": "en-us"}
LIMIT_PER_LANG = 15000

# words-open: the en->es deck; words/en: the es->en deck; words/hu: the hu target deck (es, en prompts).
# words/*.json at the top level is listed because the plan names it (there are none today).
SOURCE_DIRS = ("data/words-open", "data/words/en", "data/words/hu", "data/words")
FIELD_LANG = {"es": "es", "en": "en"}

AUDIO = OUT / "work"  # staging: work/es/<hash>.mp3, work/en/<hash>.mp3 (the archive paths)
PACK_FILE = OUT / "kimacha-tts-pack-v1.tar.bz2"

JS_WS = set("\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff")


def stamp() -> str:
    return datetime.now().strftime("%H:%M:%S")


def js_trim(s: str) -> str:
    i, j = 0, len(s)
    while i < j and s[i] in JS_WS:
        i += 1
    while j > i and s[j - 1] in JS_WS:
        j -= 1
    return s[i:j]


def make_key(text: str) -> str:
    return unicodedata.normalize("NFC", js_trim(text))


def fnv1a(key: str) -> int:
    h = 0x811C9DC5
    for b in key.encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def hash_hex(key: str) -> str:
    return format(fnv1a(key), "08x")


def voice_for(lang: str, key: str) -> str:
    return VOICES[lang][fnv1a(key) % 2]


# ---- port of pcicAlternatives (lib/pcicMatch.ts) -------------------------------------------------

def _expand_parens(s: str) -> list:
    m = re.search(r"\s*\(([^)]*)\)", s)
    if not m:
        return [s]
    before = s[: m.start()]
    after = s[m.end():]
    sp = " " if m.group(0).startswith(" ") else ""
    with_inner = re.sub(r"\s+", " ", f"{before}{sp}{m.group(1)}{after}").strip()
    without_inner = re.sub(r"\s+", " ", f"{before}{after}").strip()
    return [with_inner, without_inner]


def _expand_slashes(s: str) -> list:
    tokens = s.split(" ")
    idxs = [i for i, t in enumerate(tokens) if "/" in t]
    if not idxs:
        return [s]
    variants = [tokens]
    for idx in idxs:
        options = tokens[idx].split("/")
        variants = [v[:idx] + [opt] + v[idx + 1:] for v in variants for opt in options]
    return [" ".join(v) for v in variants]


def pcic_alternatives(answer: str) -> list:
    with_parens = [p for part in answer.split(" / ") for p in _expand_parens(part)]
    allv = [v.strip() for p in with_parens for v in _expand_slashes(p)]
    seen, out = set(), []
    for v in allv:
        if v not in seen:
            seen.add(v)
            out.append(v)
    return out


# ---- keys ----------------------------------------------------------------------------------------

def load_cards(path: Path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(data, list) or not data or not all(isinstance(x, dict) for x in data):
        return None
    return data


def collect_keys():
    """Returns (keys {lang: sorted list}, stats). Keys are the full field plus its alternatives."""
    full = {l: set() for l in LANGS}
    extra = {l: set() for l in LANGS}
    per_file = []
    empty = 0
    for rel in SOURCE_DIRS:
        d = ROOT / rel
        if not d.is_dir():
            continue
        for f in sorted(d.glob("*.json")):  # not recursive: gloss-hu/ has no es/en fields
            cards = load_cards(f)
            if cards is None:
                continue
            counts = {}
            for c in cards:
                if rel == "data/words/en" and c.get("vosotros"):
                    continue  # data/pcic.ts itemsFromWords drops them from the deck
                for field, lang in FIELD_LANG.items():
                    v = c.get(field)
                    if not isinstance(v, str):
                        continue
                    k = make_key(v)
                    if not k:
                        empty += 1
                        continue
                    full[lang].add(k)
                    counts[field] = counts.get(field, 0) + 1
                    for alt in pcic_alternatives(v):
                        ak = make_key(alt)
                        if ak and ak != k:
                            extra[lang].add(ak)
            if counts:
                per_file.append((f"{rel}/{f.name}", counts))
    keys = {l: sorted(full[l] | extra[l]) for l in LANGS}
    stats = {
        "per_file": per_file,
        "full": {l: len(full[l]) for l in LANGS},
        "alt_only": {l: len(extra[l] - full[l]) for l in LANGS},
        "total": {l: len(keys[l]) for l in LANGS},
        "chars": {l: sum(len(k) for k in keys[l]) for l in LANGS},
        "empty_skipped": empty,
    }
    return keys, stats


def assign_files(keys: dict) -> dict:
    """{lang: {key: 'es/<hash>.mp3'}}; a 32-bit hash collision gets a '-2' suffix (deterministic)."""
    out = {}
    collisions = 0
    for lang in LANGS:
        used, m = set(), {}
        for k in keys[lang]:
            h = hash_hex(k)
            name = h
            n = 2
            while name in used:
                collisions += 1 if n == 2 else 0
                name = f"{h}-{n}"
                n += 1
            used.add(name)
            m[k] = f"{lang}/{name}.{EXT}"
        out[lang] = m
    out["_collisions"] = collisions
    return out


def keys_path() -> Path:
    return OUT / "keys.json"


def log_line(name: str, msg: str):
    OUT.mkdir(parents=True, exist_ok=True)
    line = f"{stamp()} {msg}"
    with open(OUT / name, "a", encoding="utf-8") as f:
        f.write(line + "\n")
    print(line, flush=True)


# ---- commands ------------------------------------------------------------------------------------

def cmd_selftest(_args) -> int:
    vectors = {"": "811c9dc5", "a": "e40c292c", "foobar": "bf9cf968"}
    ok = True
    for text, want in vectors.items():
        got = hash_hex(make_key(text))
        flag = "ok" if got == want else "FAIL"
        ok &= got == want
        print(f"fnv1a({text!r}) = {got} want {want} {flag}")
    # NFC: decomposed n + combining tilde must key like the precomposed form
    ok &= make_key("  man\u0303ana ") == make_key("mañana") == "mañana"
    print("nfc/trim ok" if ok else "nfc/trim FAIL")
    return 0 if ok else 1


def cmd_count(_args) -> int:
    keys, st = collect_keys()
    OUT.mkdir(parents=True, exist_ok=True)
    files = assign_files(keys)
    for rel, counts in st["per_file"]:
        print(f"  {rel}: {counts}")
    for lang in LANGS:
        print(
            f"{lang}: unique keys {st['total'][lang]} (field texts {st['full'][lang]} + alternative-only {st['alt_only'][lang]}), "
            f"chars {st['chars'][lang]}"
        )
    print(f"empty fields skipped {st['empty_skipped']}, hash collisions {files['_collisions']}")
    keys_path().write_text(json.dumps(keys, ensure_ascii=False), encoding="utf-8")
    over = [l for l in LANGS if st["total"][l] > LIMIT_PER_LANG]
    if over:
        print(f"STOP: over {LIMIT_PER_LANG} unique keys for {over}; report before generating.")
        return 2
    return 0


def trim_silence(a, thr=0.004, pad_ms=25):
    import numpy as np

    idx = np.flatnonzero(np.abs(a) > thr)
    if idx.size == 0:
        return a
    pad = int(SAMPLE_RATE * pad_ms / 1000)
    return a[max(int(idx[0]) - pad, 0): min(int(idx[-1]) + pad + 1, len(a))]


def write_audio(path: Path, samples):
    import soundfile as sf

    tmp = path.with_name(path.name + ".part")
    if FORMAT == "mp3":
        sf.write(str(tmp), samples, SAMPLE_RATE, format="MP3", subtype="MPEG_LAYER_III")
    else:
        sf.write(str(tmp), samples, SAMPLE_RATE, format="OGG", subtype="VORBIS")
    os.replace(tmp, path)


def make_kokoro(threads: int):
    from kokoro_onnx import Kokoro

    if threads > 0:
        import onnxruntime as rt

        so = rt.SessionOptions()
        so.intra_op_num_threads = threads
        sess = rt.InferenceSession(str(MODEL), sess_options=so, providers=["CPUExecutionProvider"])
        sess._model_path = str(MODEL)
        return Kokoro.from_session(sess, str(VOICES_BIN))
    return Kokoro(str(MODEL), str(VOICES_BIN))


def cmd_gen(args) -> int:
    import numpy as np  # noqa: F401  (fail early if missing)

    keys, st = collect_keys()
    over = [l for l in LANGS if st["total"][l] > LIMIT_PER_LANG]
    if over and not args.force:
        print(f"STOP: over {LIMIT_PER_LANG} unique keys for {over}; use --force after the report.")
        return 2
    files = assign_files(keys)
    OUT.mkdir(parents=True, exist_ok=True)
    keys_path().write_text(json.dumps(keys, ensure_ascii=False), encoding="utf-8")
    shard_i, shard_n = 0, 1
    if args.shard:
        shard_i, shard_n = (int(x) for x in args.shard.split("/"))
    tag = f"s{shard_i}of{shard_n}"
    logname = f"progress-{tag}.log"
    k = make_kokoro(args.threads)
    codes = dict(LANG_CODE)
    try:
        k.create("hola", voice=VOICES["es"][0], lang=codes["es"])
    except Exception as e:  # noqa: BLE001
        log_line(logname, f"es-419 failed ({str(e)[:80]}), falling back to es")
        codes["es"] = "es"
    meta = {"es_lang": codes["es"], "en_lang": codes["en"], "format": EXT, "sample_rate": SAMPLE_RATE}
    (OUT / "gen-meta.json").write_text(json.dumps(meta), encoding="utf-8")
    langs = [args.lang] if args.lang else list(LANGS)
    t0 = time.time()
    done = made = failed = 0
    total = sum(len([1 for i, _ in enumerate(keys[l]) if i % shard_n == shard_i]) for l in langs)
    if args.limit:
        total = min(total, args.limit * len(langs))
    log_line(logname, f"start {tag} langs={langs} total={total} es={codes['es']} format={EXT} threads={args.threads}")
    for lang in langs:
        taken = 0
        for i, key in enumerate(keys[lang]):
            if i % shard_n != shard_i:
                continue
            if args.limit and taken >= args.limit:
                break
            taken += 1
            done += 1
            path = AUDIO / files[lang][key]
            if path.exists() and path.stat().st_size > 0:
                continue
            path.parent.mkdir(parents=True, exist_ok=True)
            try:
                samples, sr = k.create(key, voice=voice_for(lang, key), speed=1.0, lang=codes[lang])
                if sr != SAMPLE_RATE:
                    raise ValueError(f"sample rate {sr}")
                samples = trim_silence(samples)
                if len(samples) < int(0.05 * SAMPLE_RATE):
                    raise ValueError("audio shorter than 50 ms")
                write_audio(path, samples)
                made += 1
            except Exception as e:  # noqa: BLE001
                failed += 1
                with open(OUT / f"failed-{tag}.jsonl", "a", encoding="utf-8") as f:
                    f.write(json.dumps({"lang": lang, "key": key, "error": str(e)[:120]}, ensure_ascii=False) + "\n")
            if done % 200 == 0:
                el = time.time() - t0
                rate = made / el if el > 0 else 0
                eta = (total - done) / rate / 60 if rate > 0 else -1
                log_line(logname, f"{lang} {done}/{total} new={made} failed={failed} {rate:.1f}/s eta {eta:.0f} min")
    el = time.time() - t0
    log_line(logname, f"DONE {tag} seen={done} new={made} failed={failed} elapsed {el:.0f}s")
    return 0


def read_audio(path: Path):
    import soundfile as sf

    data, sr = sf.read(str(path), dtype="float32", always_2d=False)
    if getattr(data, "ndim", 1) > 1:
        data = data.mean(axis=1)
    return data, sr


def present(keys: dict, files: dict):
    """{lang: [keys with a non-empty file on disk]}"""
    return {
        l: [k for k in keys[l] if (AUDIO / files[l][k]).exists() and (AUDIO / files[l][k]).stat().st_size > 0]
        for l in LANGS
    }


def load_keys():
    p = keys_path()
    if not p.exists():
        print("keys.json missing: run count first")
        sys.exit(1)
    return json.loads(p.read_text(encoding="utf-8"))


def cmd_verify(args) -> int:
    if cmd_selftest(args) != 0:
        return 1
    keys = load_keys()
    files = assign_files(keys)
    have = present(keys, files)
    rng = random.Random(1101)
    sample = []
    for lang in LANGS:
        pool = have[lang]
        sample += [(lang, k) for k in rng.sample(pool, min(args.n // 2, len(pool)))]
    bad = 0
    for lang, key in sample:
        rel = files[lang][key]
        data, sr = read_audio(AUDIO / rel)
        dur = len(data) / sr
        peak = float(abs(data).max()) if len(data) else 0.0
        stem = Path(rel).stem
        hash_ok = stem == hash_hex(key) or stem.startswith(hash_hex(key) + "-")
        ok = dur > 0.2 and peak > 0.05 and hash_ok and sr == SAMPLE_RATE
        bad += 0 if ok else 1
        print(f"{'ok  ' if ok else 'FAIL'} {lang} {key!r} {voice_for(lang, key)} {dur:.2f}s peak {peak:.2f} sr {sr} {rel}")
    print(f"sample {len(sample)}: {len(sample) - bad} ok, {bad} bad")
    return 0 if bad == 0 and sample else 1


def cmd_pack(_args) -> int:
    keys = load_keys()
    files = assign_files(keys)
    have = present(keys, files)
    index = {"version": 1, "engine": "kokoro-v1.0", "files": {l: {k: files[l][k] for k in have[l]} for l in LANGS}}
    idx_path = OUT / "index.json"
    idx_path.write_text(json.dumps(index, ensure_ascii=False, indent=0), encoding="utf-8")
    t0 = time.time()
    tmp = PACK_FILE.with_name(PACK_FILE.name + ".part")
    with tarfile.open(tmp, "w:bz2", compresslevel=9) as tar:
        tar.add(idx_path, arcname="index.json")
        for l in LANGS:
            for k in have[l]:
                tar.add(AUDIO / files[l][k], arcname=files[l][k])
    os.replace(tmp, PACK_FILE)
    missing = {l: len(keys[l]) - len(have[l]) for l in LANGS}
    size_mb = PACK_FILE.stat().st_size / 1e6
    print(f"pack {PACK_FILE} {size_mb:.1f} MB, files {({l: len(have[l]) for l in LANGS})}, missing {missing}, {time.time() - t0:.0f}s")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Kimacha Kokoro word pack")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("selftest")
    sub.add_parser("count")
    g = sub.add_parser("gen")
    g.add_argument("--lang", choices=LANGS)
    g.add_argument("--limit", type=int, default=0)
    g.add_argument("--shard", help="I/N: only keys whose position % N == I")
    g.add_argument("--threads", type=int, default=0)
    g.add_argument("--force", action="store_true")
    v = sub.add_parser("verify")
    v.add_argument("--n", type=int, default=20)
    sub.add_parser("pack")
    args = ap.parse_args()
    return {"selftest": cmd_selftest, "count": cmd_count, "gen": cmd_gen, "verify": cmd_verify, "pack": cmd_pack}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
