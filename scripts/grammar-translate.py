#!/usr/bin/env python3
"""FB464: sentence translations for the grammar choice items (gap + mark).

The choice drill ("which word fits the blank", "tap the verb") shows a sentence but had no
translation of it, unlike the rewrite, why, spot, order and dictation items. This script adds
`tr: { en, es }` to every gap and mark item in data/games/grammar/<track>/*.json that
does not have one yet. The app shows it behind the F button (components/grammar/GrammarDrill.tsx).

Run it from YOUR OWN terminal, never from an agent session (LLM translation in a session is
forbidden; the key stays in your shell). From the repo root, PowerShell:

    $env:GEMINI_API_KEY = "<your key>"        # or already set in your profile
    python scripts/grammar-translate.py --dry-run          # no API call, no write: plan + integrity check
    python scripts/grammar-translate.py --limit 20         # first small batch, review the diff by eye
    python scripts/grammar-translate.py                    # everything pending (resumable)

What it does
  * Source sentence: gap = the sentence with the blank filled by the correct option, mark = the
    sentence as is (whitespace and punctuation spacing normalised, same rule as audit-games.mjs).
  * The learned-language side of `tr` (es on the es track, en on the en track) is that source
    sentence itself, set by the script, not by the model (like the why items: tr.es === es).
  * The other three languages come from Gemini (default gemini-2.5-flash, JSON mode). Spanish on
    the en track follows Mexican usage (ustedes, pretérito indefinido, carro / celular ...).
  * Resumable: items that already have `tr` are skipped, every batch is written to the file
    straight away, so a stop (quota, Ctrl+C, network) loses nothing; run the same command again.
  * Only the `tr` line is inserted into each item (text-level), the rest of the file is untouched
    (the files are not re-serialised, so no formatting churn); the result is parsed and compared
    with the original (everything but the new `tr` must be identical) before the file is written.
  * The key is read from $GEMINI_API_KEY only, sent in a header, never printed or logged.

Afterwards: `node scripts/audit-games.mjs` (P1 must be 0), then read the diff of a few files.
Free tier note (2026-10): ~10 requests/minute, ~250 requests/day for 2.5 Flash; the default
batch of 25 sentences and the 7 s pause stay inside it (about 2000 sentences = about 80 requests).
"""
import argparse
import copy
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GRAMMAR = ROOT / "data" / "games" / "grammar"
LANGS = ("en", "es")
TRACKS = ("es", "en")  # directory = the language being learned (es: Spanish sentences, en: English sentences)
DEFAULT_MODEL = "gemini-2.5-flash"
ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
LANG_NAMES = {"en": "English", "es": "Spanish (Mexican)"}
SOURCE_NAMES = {"es": "Spanish", "en": "English"}


# ---------------------------------------------------------------------------------------------
# Sentences

def norm_space(text):
    """Same normalisation as scripts/audit-games.mjs normFilled(): one space, none before closing
    punctuation, none after opening punctuation."""
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([.,;:!?»”)])", r"\1", text)
    text = re.sub(r"([¿¡(«“])\s+", r"\1", text)
    return text


def is_choice(item):
    return item.get("kind") in (None, "gap", "mark")


def filled_sentence(item):
    sentence = item.get("sentence", "")
    if item.get("kind") == "mark":
        return norm_space(sentence)
    options = item.get("options") or []
    correct = item.get("correct")
    if not isinstance(correct, int) or not 0 <= correct < len(options):
        return None
    return norm_space(sentence.replace("___", options[correct], 1))


# ---------------------------------------------------------------------------------------------
# Text-level insertion of the `tr` line (no re-serialisation of the file)

def item_spans(raw):
    """{item id: (start, end)} of the objects in the root "items" array (end exclusive)."""
    spans = {}
    stack = []  # (char, start, key the container sits under)
    cur_key = {}
    in_str = False
    esc = False
    str_start = 0
    n = len(raw)
    for i in range(n):
        c = raw[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
                j = i + 1
                while j < n and raw[j] in " \t\r\n":
                    j += 1
                if j < n and raw[j] == ":":
                    cur_key[len(stack)] = raw[str_start + 1:i]
            continue
        if c == '"':
            in_str = True
            str_start = i
        elif c in "{[":
            stack.append((c, i, cur_key.get(len(stack))))
        elif c in "}]":
            ch, start, key = stack.pop()
            if ch == "{" and len(stack) == 2 and stack[1][0] == "[" and stack[1][2] == "items":
                obj = json.loads(raw[start:i + 1])
                if isinstance(obj, dict) and "id" in obj:
                    spans[obj["id"]] = (start, i + 1)
    return spans


def tr_literal(tr):
    return "{ " + ", ".join(f'"{lang}": {json.dumps(tr[lang], ensure_ascii=False)}' for lang in LANGS) + " }"


def insert_translations(raw, translations):
    """Insert `"tr": {...}` as the last property of each item in `translations` ({id: tr}). Returns the new text."""
    spans = item_spans(raw)
    missing = [i for i in translations if i not in spans]
    if missing:
        raise ValueError(f"items not found in the file: {missing[:3]}")
    out = raw
    for item_id in sorted(translations, key=lambda i: spans[i][0], reverse=True):
        start, end = spans[item_id]
        obj = out[start:end]
        close = end - 1  # the closing brace
        last = close
        while out[last - 1] in " \t\r\n":
            last -= 1
        if "\n" in obj:
            m = re.match(r"\{\s*\n([ \t]+)", obj)
            indent = m.group(1) if m else "      "
            addition = f',\n{indent}"tr": {tr_literal(translations[item_id])}'
        else:
            addition = f', "tr": {tr_literal(translations[item_id])}'
        out = out[:last] + addition + out[last:]
    return out


def verify_insertion(old_raw, new_raw, translations):
    """The parsed new file must equal the old one plus exactly the new `tr` fields."""
    old = json.loads(old_raw)
    new = json.loads(new_raw)
    expected = copy.deepcopy(old)
    for item in expected.get("items", []):
        if item.get("id") in translations:
            item["tr"] = translations[item["id"]]
    if new != expected:
        raise ValueError("integrity check failed: the new file differs from old + tr")
    if new_raw.count("\r\n") != old_raw.count("\r\n"):
        raise ValueError("integrity check failed: line endings changed")


# ---------------------------------------------------------------------------------------------
# Work list

def collect_work(tracks, topic_filter):
    """[(track, path, item id, source sentence)] for every choice item without `tr`, in file order."""
    work = []
    skipped_bad = []
    for track in tracks:
        for path in sorted((GRAMMAR / track).glob("*.json")):
            if topic_filter and path.stem != topic_filter:
                continue
            data = json.loads(path.read_text(encoding="utf-8"))
            for item in data.get("items", []):
                if not is_choice(item) or item.get("tr"):
                    continue
                sentence = filled_sentence(item)
                if not sentence:
                    skipped_bad.append(f"{track}/{path.name}:{item.get('id')}")
                    continue
                work.append((track, path, item["id"], sentence))
    return work, skipped_bad


# ---------------------------------------------------------------------------------------------
# Gemini

def build_prompt(track, batch):
    source = SOURCE_NAMES[track]
    targets = [lang for lang in LANGS if lang != track]
    names = ", ".join(f"{LANG_NAMES[lang]} (key \"{lang}\")" for lang in targets)
    lines = [
        f"You translate single {source} sentences from a language-learning grammar course.",
        f"For every item translate the sentence into: {names}.",
        "Rules: translate faithfully and naturally, keep the register and meaning, keep the sentence a complete",
        "sentence with its terminal punctuation, keep proper names, add nothing, explain nothing, never leave",
        "one target language inside another. Do not translate word by word; use the idiom a native speaker",
        "would use. Spanish output follows Mexican usage (ustedes, never vosotros; pretérito indefinido for",
        "completed past events; carro, celular, platicar where natural).",
        "Return a JSON array with one object per item: {\"id\": <the id you were given>, "
        + ", ".join(f'"{lang}": <translation>' for lang in targets) + "}.",
        "Items:",
        json.dumps([{"id": str(n), "sentence": sentence} for n, (_, _, _, sentence) in enumerate(batch)], ensure_ascii=False, indent=1),
    ]
    return "\n".join(lines)


def response_schema(track):
    targets = [lang for lang in LANGS if lang != track]
    props = {"id": {"type": "STRING"}}
    props.update({lang: {"type": "STRING"} for lang in targets})
    return {"type": "ARRAY", "items": {"type": "OBJECT", "properties": props, "required": ["id", *targets]}}


class Stop(Exception):
    pass


def short(msg, limit=100):
    msg = re.sub(r"\s+", " ", str(msg))
    return msg[:limit] + ("..." if len(msg) > limit else "")


def call_gemini(key, model, track, prompt, retries=5):
    body = json.dumps({
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
            "responseSchema": response_schema(track),
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT.format(model=model),
        data=body,
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
        method="POST",
    )
    wait = 30
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            parts = payload["candidates"][0]["content"]["parts"]
            return json.loads("".join(p.get("text", "") for p in parts))
        except urllib.error.HTTPError as err:
            if err.code in (429, 500, 502, 503, 504) and attempt < retries:
                print(f"    HTTP {err.code}, várok {wait} mp-et ({attempt + 1}/{retries})", flush=True)
                time.sleep(wait)
                wait = min(wait * 2, 240)
                continue
            if err.code in (429, 500, 502, 503, 504):
                raise Stop(f"HTTP {err.code}: kvóta vagy terhelés, futtasd újra később ugyanezt a parancsot")
            raise Stop(f"HTTP {err.code}: {short(err.read().decode('utf-8', 'replace'))}")
        except (urllib.error.URLError, TimeoutError) as err:
            if attempt < retries:
                print(f"    hálózati hiba ({short(err, 60)}), várok {wait} mp-et", flush=True)
                time.sleep(wait)
                wait = min(wait * 2, 240)
                continue
            raise Stop(f"hálózati hiba: {short(err)}")
        except (KeyError, IndexError, ValueError) as err:
            raise ValueError(f"unexpected response shape: {short(err)}")


def valid_translation(track, source, raw):
    """A clean {hu,en,es,de} (learned-language side = the source sentence) or None."""
    if not isinstance(raw, dict):
        return None
    tr = {}
    for lang in LANGS:
        if lang == track:
            tr[lang] = source
            continue
        value = raw.get(lang)
        if not isinstance(value, str):
            return None
        value = re.sub(r"\s+", " ", value).strip()
        if not value or "___" in value or len(value) > 4 * len(source) + 30 or len(value) * 4 + 30 < len(source):
            return None
        tr[lang] = value
    return tr


# ---------------------------------------------------------------------------------------------

def write_batch(done):
    """done: [(path, item id, tr)] -> writes each file once, with the integrity check."""
    by_path = {}
    for path, item_id, tr in done:
        by_path.setdefault(path, {})[item_id] = tr
    for path, translations in by_path.items():
        old_raw = path.read_text(encoding="utf-8", newline="")
        new_raw = insert_translations(old_raw, translations)
        verify_insertion(old_raw, new_raw, translations)
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(new_raw, encoding="utf-8", newline="")
        os.replace(tmp, path)


def dry_run(work, skipped_bad, batch_size, model):
    print(f"--dry-run: nincs API-hívás, nincs írás. Függő tétel: {len(work)} (modell: {model}, adag: {batch_size})")
    per = {}
    for track, path, _, _ in work:
        per.setdefault((track, path.name), 0)
        per[(track, path.name)] += 1
    for track in TRACKS:
        total = sum(n for (t, _), n in per.items() if t == track)
        files = sum(1 for (t, _) in per if t == track)
        print(f"  {track}: {total} tétel, {files} fájl")
    if skipped_bad:
        print(f"  figyelem: {len(skipped_bad)} tétel nem fordítható (hibás correct/options): {skipped_bad[:3]}")
    if not work:
        print("Nincs mit fordítani.")
        return 0
    # Integrity check on the real files with placeholder text: insert into memory, parse, compare. Nothing is written.
    bad = 0
    by_path = {}
    for track, path, item_id, sentence in work:
        by_path.setdefault((track, path), {})[item_id] = {lang: (sentence if lang == track else f"[{lang}] {sentence}") for lang in LANGS}
    for (track, path), translations in by_path.items():
        old_raw = path.read_text(encoding="utf-8", newline="")
        try:
            new_raw = insert_translations(old_raw, translations)
            verify_insertion(old_raw, new_raw, translations)
        except ValueError as err:
            bad += 1
            print(f"  HIBA {track}/{path.name}: {short(err)}")
    print(f"  beszúrás-ellenőrzés: {len(by_path)} fájl, {bad} hiba (a fájlok nem változtak)")
    first_track = work[0][0]
    first = [w for w in work if w[0] == first_track][:batch_size]
    print(f"\nAz első adag kérése ({first_track}, {len(first)} mondat), kulcs nélkül:\n")
    print(build_prompt(first_track, first)[:1800])
    return 1 if bad else 0


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--track", choices=("es", "en", "all"), default="all", help="which sentence language (default: es first, then en)")
    ap.add_argument("--topic", help="only this lesson file (name without .json)")
    ap.add_argument("--limit", type=int, default=0, help="translate at most N sentences in this run")
    ap.add_argument("--batch", type=int, default=25, help="sentences per request")
    ap.add_argument("--sleep", type=float, default=7.0, help="pause between requests, seconds")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--dry-run", action="store_true", help="no API call, no write: plan + insertion integrity check")
    args = ap.parse_args()

    tracks = TRACKS if args.track == "all" else (args.track,)
    work, skipped_bad = collect_work(tracks, args.topic)
    if args.limit:
        work = work[: args.limit]
    if args.dry_run:
        return dry_run(work, skipped_bad, args.batch, args.model)

    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        print('Nincs GEMINI_API_KEY. PowerShell: $env:GEMINI_API_KEY = "<kulcs>" (a kulcsot nem írja ki a script).')
        return 2
    if not work:
        print("Nincs mit fordítani: minden gap/mark tételnek van tr-je.")
        return 0

    print(f"Függő tétel: {len(work)}, adag: {args.batch}, modell: {args.model}", flush=True)
    done_total = 0
    failed = []
    # a batch never mixes tracks (the source language differs)
    batches = []
    for track in tracks:
        items = [w for w in work if w[0] == track]
        batches += [items[i:i + args.batch] for i in range(0, len(items), args.batch)]
    try:
        for number, batch in enumerate(batches, 1):
            track = batch[0][0]
            print(f"[{number}/{len(batches)}] {track}, {len(batch)} mondat ...", flush=True)
            results = None
            for attempt in range(2):
                try:
                    results = call_gemini(key, args.model, track, build_prompt(track, batch))
                    break
                except ValueError as err:
                    print(f"    érvénytelen válasz ({short(err, 70)}), újrapróbálom", flush=True)
            if results is None:
                failed += [f"{t}/{p.name}:{i}" for t, p, i, _ in batch]
                continue
            by_id = {str(r.get("id")): r for r in results if isinstance(r, dict)}
            done = []
            for n, (t, path, item_id, sentence) in enumerate(batch):
                tr = valid_translation(track, sentence, by_id.get(str(n)))
                if tr:
                    done.append((path, item_id, tr))
                else:
                    failed.append(f"{t}/{path.name}:{item_id}")
            if done:
                write_batch(done)
                done_total += len(done)
            print(f"    kész {len(done)}/{len(batch)}, összesen {done_total}", flush=True)
            if number < len(batches):
                time.sleep(args.sleep)
    except Stop as err:
        print(f"MEGÁLLT: {err}")
        print(f"Eddig kész: {done_total}. Ugyanaz a parancs onnan folytatja.")
        return 3
    except KeyboardInterrupt:
        print(f"\nMegszakítva. Eddig kész: {done_total}. Ugyanaz a parancs onnan folytatja.")
        return 130

    print(f"\nKész: {done_total} mondat fordítva, {len(failed)} kihagyva (a következő futás újra megpróbálja).")
    if failed:
        print("  kihagyott (első 5): " + ", ".join(failed[:5]))
    print("Következő: node scripts/audit-games.mjs (P1 = 0), aztán nézd át néhány fájl diffjét.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
