#!/usr/bin/env python3
"""FB465 + FB466: clears the two audit debts of data/games/grammar (the debt lists of scripts/audit-games.mjs).

  match      scripts/audit-games-match-debt.json     Spanish track: pairing items whose pairs are whole phrases
  match-en   scripts/audit-games-match-debt-en.json  English track: the same
  vosotros   scripts/audit-games-vosotros-debt.json  drill items that still name vosotros in a wrong option / note

match: every pair is cut down to the part the lesson is about ("tuve un problema" = "I had a problem" becomes
"tuve" = "I had"), the hand-made examples of FB441 (7b14e09) and FB465 (im-match-01). The learned-language side
must be a contiguous part of the ORIGINAL phrase (so the pairing itself cannot change), the gloss side comes
from Gemini. vosotros: the wrong option that names vosotros is replaced by another wrong option that fits the
lesson, and the explanations are rewritten in all four languages (Mexican norm: ustedes). The correct answer
of an item never changes (validated).

Run it from YOUR OWN terminal, never from an agent session (LLM text in a session is forbidden; the key stays
in your shell). From the repo root, PowerShell:

    Get-Content "$env:USERPROFILE\\.config\\personal-auto\\gemini.env" | ForEach-Object { if ($_ -match '^\\s*(?:export\\s+)?GEMINI_API_KEY\\s*=\\s*(.+?)\\s*$') { $env:GEMINI_API_KEY = $Matches[1].Trim('"').Trim("'") } }
    python scripts/grammar-debt-fix.py --dry-run                       # no API call, no write: plan + checks
    python scripts/grammar-debt-fix.py --only match --limit 6          # first small batch, read the diff
    python scripts/grammar-debt-fix.py --only match                    # all Spanish match items (resumable)
    python scripts/grammar-debt-fix.py --only match-en
    python scripts/grammar-debt-fix.py --only vosotros

What it does
  * Work list = the three debt lists. An item that is fixed is written to its lesson file (only that item's
    pairs / the item itself change, the rest of the file is untouched) and removed from its debt list straight
    away, so a stop (quota, Ctrl+C, network) loses nothing; run the same command again.
  * Every answer of the model is validated before anything is written (see validate_match / validate_vosotros);
    a bad answer is skipped and stays on the debt list for the next run. The new file is parsed and compared with
    the old one (only the intended items may differ) before it is saved.
  * The key is read from $GEMINI_API_KEY only, sent in a header, never printed or logged.
  * At the end it runs `node scripts/audit-games.mjs`; P1 must be 0.
Free tier note (2026-10): ~10 requests/minute, ~250 requests/day for 2.5 Flash; defaults (6 match items or 3
vosotros items per request, 7 s pause) stay inside it: 57 + 86 match items = about 24 requests, 13 vosotros items
= 5 requests.
"""
import argparse
import copy
import importlib.util
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GRAMMAR = ROOT / "data" / "games" / "grammar"
SCRIPTS = ROOT / "scripts"
LANGS = ("hu", "en", "es", "de")
DEFAULT_MODEL = "gemini-2.5-flash"
ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# kind -> (debt list file, track)
KINDS = {
    "match": ("audit-games-match-debt.json", "es"),
    "match-en": ("audit-games-match-debt-en.json", "en"),
    "vosotros": ("audit-games-vosotros-debt.json", "es"),
}
# keep in sync with MATCH_MAX_WORDS in scripts/audit-games.mjs: track -> side -> max words
MATCH_MAX = {"es": {"es": 3, "en": 4}, "en": {"es": 4, "en": 4}}
LEARNED = {"es": "es", "en": "en"}  # the learned-language side of a pair in each track
GLOSS = {"es": "en", "en": "es"}
LANG_NAMES = {"es": "Spanish", "en": "English"}


def _load_translate_module():
    """scripts/grammar-translate.py (the FB464 script) owns the text-level item span finder."""
    spec = importlib.util.spec_from_file_location("grammar_translate", SCRIPTS / "grammar-translate.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


gt = _load_translate_module()


def short(msg, limit=100):
    msg = re.sub(r"\s+", " ", str(msg))
    return msg[:limit] + ("..." if len(msg) > limit else "")


# ---------------------------------------------------------------------------------------------
# vosotros detector (a port of VOSOTROS_WORD in scripts/audit-games.mjs; the audit stays the authority)

_L = r"[^\W\d_]"  # one letter
_VERB_ENDINGS = "áis|éis|abais|íais|asteis|isteis|arais|ierais|ríais|aseis|ieseis|areis|iereis"
_WORDS = (
    "vosotr[oa]s|vuestr[oa]s?|sois|vais|veis|dais|vivís|escribís|abrís|decís|salís|pedís|sentís|dormís|ofrecís|"
    "recibís|partís|hablad|comed|vivid|decid|haced|poned|venid|salid|tened|ved|estad|cantad|escuchad|abrid|"
    "escribid|mirad|tomad|bebed|leed|volved|pedid|seguid"
)
VOSOTROS_RE = re.compile(
    rf"(?<!{_L}|/)os(?!{_L}|/)|(?<!{_L})(?:{_WORDS}|(?!dieciséis|veintiséis){_L}+(?:{_VERB_ENDINGS}))(?!{_L})",
    re.IGNORECASE,
)


def find_vosotros(value):
    """First vosotros word found in any string (also dict keys) of a JSON value, or None."""
    if isinstance(value, str):
        m = VOSOTROS_RE.search(value)
        return m.group(0) if m else None
    if isinstance(value, list):
        for x in value:
            hit = find_vosotros(x)
            if hit:
                return hit
    elif isinstance(value, dict):
        for k, x in value.items():
            hit = find_vosotros(k) or find_vosotros(x)
            if hit:
                return hit
    return None


# ---------------------------------------------------------------------------------------------
# Debt lists and work items

def debt_path(kind):
    return SCRIPTS / KINDS[kind][0]


def read_debt(kind):
    return json.loads(debt_path(kind).read_text(encoding="utf-8"))


def remove_from_debt(kind, keys):
    left = [k for k in read_debt(kind) if k not in set(keys)]
    debt_path(kind).write_text(json.dumps(left, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def split_key(key):
    """'es/imperfecto.json#im-match-01' -> ('es', 'imperfecto.json', 'im-match-01')."""
    track, rest = key.split("/", 1)
    fname, item_id = rest.split("#", 1)
    return track, fname, item_id


def collect_work(kinds, topic_filter, grammar=None):
    """[dict(kind, key, path, id, item, title, topic, level)] in debt-list order, plus the keys that do not resolve."""
    grammar = grammar or GRAMMAR
    work, stale = [], []
    for kind in kinds:
        for key in read_debt(kind):
            track, fname, item_id = split_key(key)
            if topic_filter and Path(fname).stem != topic_filter:
                continue
            path = grammar / track / fname
            if not path.is_file():
                stale.append(key)
                continue
            data = json.loads(path.read_text(encoding="utf-8"))
            item = next((i for i in data.get("items", []) if i.get("id") == item_id), None)
            if item is None:
                stale.append(key)
                continue
            work.append({
                "kind": kind, "key": key, "path": path, "id": item_id, "item": item,
                "title": (data.get("title") or {}).get("en", data.get("topic", "")),
                "topic": data.get("topic", ""), "level": data.get("level", ""),
            })
    return work, stale


# ---------------------------------------------------------------------------------------------
# Match items

def words(text):
    return str(text).split()


def norm_tokens(text):
    return [re.sub(r"^[¿¡(«“\"']+|[.,;:!?»”)\"']+$", "", w).lower() for w in words(text)]


def is_part_of(part, original):
    """True when `part` is a contiguous run of words of `original` (case and edge punctuation ignored)."""
    p, o = norm_tokens(part), norm_tokens(original)
    if not p:
        return False
    return any(o[i:i + len(p)] == p for i in range(len(o) - len(p) + 1))


def clean_side(text):
    """One space, no sentence punctuation around a key part (a part of a sentence is not a sentence)."""
    text = re.sub(r"\s+", " ", str(text)).strip()
    text = re.sub(r"[.!?]+$", "", text)
    return re.sub(r"^[¿¡]+", "", text).strip()


def fit_newlines(raw, text):
    """The new text uses the same line ending as the file it goes into."""
    return text.replace("\r\n", "\n").replace("\n", "\r\n") if "\r\n" in raw else text


def validate_match(track, pairs, result):
    """(new pairs, None) or (None, reason). `result` = the model's pairs [{"i", "es", "en"}], same order and count."""
    if not isinstance(result, list) or len(result) != len(pairs):
        return None, "wrong number of pairs"
    by_index = {}
    for r in result:
        if not isinstance(r, dict) or not isinstance(r.get("i"), int):
            return None, "pair without index"
        by_index[r["i"]] = r
    if sorted(by_index) != list(range(len(pairs))):
        return None, "pair indices are not 0..n-1"
    learned, gloss, limit = LEARNED[track], GLOSS[track], MATCH_MAX[track]
    new = []
    for i, old in enumerate(pairs):
        r = by_index[i]
        l_side, g_side = r.get(learned), r.get(gloss)
        if not isinstance(l_side, str) or not isinstance(g_side, str):
            return None, f"pair {i}: missing text"
        l_side, g_side = clean_side(l_side), clean_side(g_side)
        if not l_side or not g_side:
            return None, f"pair {i}: empty side"
        if "___" in l_side or "___" in g_side:
            return None, f"pair {i}: blank in text"
        if not is_part_of(l_side, old[learned]):
            return None, f"pair {i}: '{l_side}' is not a part of the original '{old[learned]}'"
        if len(words(l_side)) > limit[learned] or len(words(g_side)) > limit[gloss]:
            return None, f"pair {i}: too long ('{l_side}' / '{g_side}')"
        if l_side.lower() == g_side.lower():
            return None, f"pair {i}: both sides identical"
        if find_vosotros(l_side) or find_vosotros(g_side):
            return None, f"pair {i}: vosotros"
        new.append({"es": l_side if learned == "es" else g_side, "en": l_side if learned == "en" else g_side})
    for side in ("es", "en"):
        seen = [p[side].lower() for p in new]
        if len(set(seen)) != len(seen):
            return None, f"duplicate {side} side"
    return new, None


def _array_span(text, key):
    """(start, end) of the `[...]` after `"key":` inside `text` (string aware), or None."""
    m = re.search(rf'"{key}"\s*:\s*\[', text)
    if not m:
        return None
    start = m.end() - 1
    depth, in_str, esc = 0, False, False
    for i in range(start, len(text)):
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
        elif c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                return start, i + 1
    return None


def render_pairs(old_array_text, pairs):
    """The new `[...]` text for `pairs`, in the layout of the old one (one pair per line, or one object per pair)."""
    m = re.match(r"\[\s*\n([ \t]*)\{", old_array_text)
    if not m:
        raise ValueError("unexpected pairs layout")
    indent = m.group(1)
    close = re.search(r"\n([ \t]*)\]$", old_array_text)
    close_indent = close.group(1) if close else ""
    first_obj = re.search(r"\{[^}]*\}", old_array_text).group(0)
    def lit(p):
        return json.dumps(p["es"], ensure_ascii=False), json.dumps(p["en"], ensure_ascii=False)

    if "\n" in first_obj:
        inner = indent + "  "
        chunks = [
            "{\n" + inner + f'"es": {lit(p)[0]},\n' + inner + f'"en": {lit(p)[1]}\n' + indent + "}" for p in pairs
        ]
    else:
        chunks = ["{ " + f'"es": {lit(p)[0]}, "en": {lit(p)[1]}' + " }" for p in pairs]
    return "[\n" + indent + (",\n" + indent).join(chunks) + "\n" + close_indent + "]"


def apply_match(raw, replacements):
    """raw lesson text + {item id: new pairs} -> new text (only those `pairs` arrays change)."""
    spans = gt.item_spans(raw)
    missing = [i for i in replacements if i not in spans]
    if missing:
        raise ValueError(f"items not found in the file: {missing[:3]}")
    out = raw
    for item_id in sorted(replacements, key=lambda i: spans[i][0], reverse=True):
        start, end = spans[item_id]
        text = out[start:end]
        arr = _array_span(text, "pairs")
        if not arr:
            raise ValueError(f"{item_id}: no pairs array")
        rendered = render_pairs(text[arr[0]:arr[1]].replace("\r\n", "\n"), replacements[item_id])
        new_text = text[:arr[0]] + fit_newlines(raw, rendered) + text[arr[1]:]
        out = out[:start] + new_text + out[end:]
    return out


def verify_replacement(old_raw, new_raw, expected_items):
    """The parsed new file must equal the old one with exactly the `expected_items` ({id: item}) swapped in."""
    old = json.loads(old_raw)
    new = json.loads(new_raw)
    expected = copy.deepcopy(old)
    for n, item in enumerate(expected.get("items", [])):
        if item.get("id") in expected_items:
            expected["items"][n] = expected_items[item["id"]]
    if new != expected:
        raise ValueError("integrity check failed: the new file differs from old + the intended changes")
    if new_raw.count("\r\n") != old_raw.count("\r\n"):
        raise ValueError("integrity check failed: line endings changed")


def with_pairs(item, pairs):
    new = copy.deepcopy(item)
    new["pairs"] = pairs
    return new


# ---------------------------------------------------------------------------------------------
# Vosotros items (kind why / gap): the whole item is rewritten, serialised in the file's style

def dump_value(v, pad, inline_lists):
    if isinstance(v, dict):
        if not v:
            return "{}"
        inner = pad + 2
        body = ",\n".join(" " * inner + json.dumps(k, ensure_ascii=False) + ": " + dump_value(x, inner, inline_lists) for k, x in v.items())
        return "{\n" + body + "\n" + " " * pad + "}"
    if isinstance(v, list):
        if not v:
            return "[]"
        if inline_lists and all(isinstance(x, (str, int, float)) and not isinstance(x, bool) for x in v):
            return "[" + ", ".join(json.dumps(x, ensure_ascii=False) for x in v) + "]"
        inner = pad + 2
        return "[\n" + ",\n".join(" " * inner + dump_value(x, inner, inline_lists) for x in v) + "\n" + " " * pad + "]"
    return json.dumps(v, ensure_ascii=False)


def dump_item(item, pad, inline_lists):
    return dump_value(item, pad, inline_lists)


def apply_items(raw, replacements):
    """raw lesson text + {item id: new item} -> new text (those items are re-serialised in place)."""
    spans = gt.item_spans(raw)
    missing = [i for i in replacements if i not in spans]
    if missing:
        raise ValueError(f"items not found in the file: {missing[:3]}")
    out = raw
    for item_id in sorted(replacements, key=lambda i: spans[i][0], reverse=True):
        start, end = spans[item_id]
        line_start = out.rfind("\n", 0, start) + 1
        pad = start - line_start
        inline = bool(re.search(r'\["', out[start:end]))
        out = out[:start] + fit_newlines(raw, dump_item(replacements[item_id], pad, inline)) + out[end:]
    return out


WRONG_MIN = 25


def _lang4(value):
    return isinstance(value, dict) and all(isinstance(value.get(l), str) and value[l].strip() for l in LANGS)


def validate_vosotros(old, new):
    """(new item, None) or (None, reason). The correct answer and everything outside options/wrong/why must stay."""
    if not isinstance(new, dict):
        return None, "not an object"
    if set(new) != set(old):
        return None, "the keys of the item changed"
    frozen = [k for k in old if k not in ("options", "wrong", "why")]
    for k in frozen:
        if new[k] != old[k]:
            return None, f"'{k}' must not change"
        if find_vosotros(old[k]):
            return None, f"vosotros in '{k}': needs a hand edit"
    if old.get("kind") == "why":
        o_opts, n_opts = old["options"], new["options"]
        if not isinstance(n_opts, list) or len(n_opts) != 3:
            return None, "a why item needs exactly 3 options"
        c = old["correctIndex"]
        if n_opts[c] != o_opts[c]:
            return None, "the correct option changed"
        if find_vosotros(o_opts[c]):
            return None, "vosotros in the correct option: needs a hand edit"
        for n, opt in enumerate(n_opts):
            if not isinstance(opt, dict) or not _lang4(opt.get("text")):
                return None, f"option {n}: text must have 4 languages"
            if n != c and (not _lang4(opt.get("wrong")) or any(len(opt["wrong"][l].strip()) < WRONG_MIN for l in LANGS)):
                return None, f"option {n}: wrong explanation must have 4 real sentences"
            if n == c and "wrong" in opt:
                return None, "the correct option has no wrong explanation"
        if len({o["text"]["hu"].strip().lower() for o in n_opts}) != 3:
            return None, "option texts are not unique (hu)"
        for n, opt in enumerate(n_opts):
            if n != c and opt["wrong"] == o_opts[n].get("wrong") and find_vosotros(o_opts[n]):
                return None, f"option {n}: still the old text"
    else:
        o_opts, n_opts = old["options"], new["options"]
        c = old["correct"]
        if not isinstance(n_opts, list) or len(n_opts) != len(o_opts) or not all(isinstance(x, str) and x.strip() for x in n_opts):
            return None, "options must be a list of the same size"
        if n_opts[c] != o_opts[c]:
            return None, "the correct option changed"
        if len(set(n_opts)) != len(n_opts):
            return None, "duplicate options"
        wrong = new.get("wrong")
        wrong_keys = {o for i, o in enumerate(n_opts) if i != c}
        if not isinstance(wrong, dict) or set(wrong) != wrong_keys:
            return None, "wrong must have one entry per wrong option"
        for key, expl in wrong.items():
            if not _lang4(expl) or any(len(expl[l].strip()) <= 40 for l in LANGS):
                return None, f"wrong '{key}': 4 sentences of more than 40 characters needed"
        if not _lang4(new.get("why")):
            return None, "why must have 4 languages"
    hit = find_vosotros(new)
    if hit:
        return None, f"vosotros left ('{hit}')"
    return copy.deepcopy(new), None


# ---------------------------------------------------------------------------------------------
# Gemini

def build_match_prompt(track, batch):
    learned, gloss = LEARNED[track], GLOSS[track]
    lim = MATCH_MAX[track]
    lines = [
        "You fix pairing exercises of a language-learning grammar course (Mexican Spanish and English, four UI languages).",
        f"In a pairing exercise the learner matches each {LANG_NAMES[learned]} part with its {LANG_NAMES[gloss]} meaning.",
        "The pairs are currently whole phrases or sentences. The exercise must pair ONLY THE WORD OR SHORT FORM THE LESSON",
        "IS ABOUT (in a tense lesson the verb form; otherwise the pronoun, connector or word that varies), like these",
        "hand-made examples: " + ('"tuve" = "I had", "fuimos" = "we went", "dijo" = "she said", "era" = "I was", '
                                  '"vivíamos" = "we used to live", "iba" = "I used to go".' if track == "es" else
                                  '"I had" = "tuve", "we went" = "fuimos", "she said" = "dijo", "I was" = "era", '
                                  '"we used to live" = "vivíamos", "I used to go" = "iba".'),
        "For every item you get the lesson title, topic, level and the current pairs (index i, es, en).",
        "For every pair return its key part:",
        f'- "{learned}": the shortest contiguous part of the ORIGINAL {LANG_NAMES[learned]} text of THAT pair that carries the',
        f"  lesson's point. Copy the words exactly as they stand in the original, add no words, at most {lim[learned]} words.",
        f'- "{gloss}": a short {LANG_NAMES[gloss]} gloss of exactly that part (with the subject pronoun or auxiliary a learner',
        f'  needs, e.g. "I had", "we used to live"), at most {lim[gloss]} words, no final period.',
        "Rules: keep the pair order and the pair count; the key parts must all differ from each other, and so must the",
        "glosses (if two phrases share the key word, take a slightly longer contiguous part that tells them apart, still",
        "within the word limit); the two sides must not be identical; no vosotros forms; Spanish follows Mexican usage",
        "(ustedes, pretérito indefinido for completed past events; carro, celular where natural).",
        'Return a JSON array with one object per item: {"id": <the item number you were given>, "pairs": [{"i": 0, "es": ..., "en": ...}, ...]}.',
        "Items:",
        json.dumps(
            [
                {"id": str(n), "lesson": w["title"], "topic": w["topic"], "level": w["level"],
                 "pairs": [{"i": i, "es": p["es"], "en": p["en"]} for i, p in enumerate(w["item"]["pairs"])]}
                for n, w in enumerate(batch)
            ],
            ensure_ascii=False, indent=1,
        ),
    ]
    return "\n".join(lines)


def match_schema():
    pair = {"type": "OBJECT", "properties": {"i": {"type": "INTEGER"}, "es": {"type": "STRING"}, "en": {"type": "STRING"}},
            "required": ["i", "es", "en"]}
    item = {"type": "OBJECT", "properties": {"id": {"type": "STRING"}, "pairs": {"type": "ARRAY", "items": pair}},
            "required": ["id", "pairs"]}
    return {"type": "ARRAY", "items": item}


def build_vosotros_prompt(batch):
    lines = [
        "You fix drill items of a Spanish grammar course (Mexican Spanish; UI languages hu, en, es, de).",
        "Mexican norm: the course never uses vosotros. NO item may contain vosotros, vosotras, vuestro/a/os/as, the",
        'pronoun "os", or any vosotros verb form (-áis, -éis, -ís, -asteis, -isteis, -abais, -íais, -aréis, vais, sois,',
        "veis, hablad, comed ...), in ANY language field, and not as an option either. ustedes is the plural 'you'.",
        "Each item below still names vosotros in a WRONG option or in an explanation. Rewrite it:",
        "- Keep every key, the id, the kind, the sentence, the target, tr, the correct answer (correct / correctIndex and",
        "  the correct option exactly as it is), examples and tense EXACTLY unchanged. Change only wrong options, their",
        "  explanations (`wrong`) and, for gap items, the `why` note.",
        "- A wrong option that is a vosotros form or pronoun is replaced by another plausible WRONG option that fits the",
        "  point of the lesson and the sentence (a why item: another person such as ellos/ustedes; a gap item: another real",
        "  but wrong form, never vosotros), different from the other options. Its explanation says concretely, in all",
        "  four languages, why it does not fit here and names the right form (at least one full sentence each).",
        "- A sentence that only mentions vosotros in passing is rewritten without it, same meaning.",
        "- why items keep exactly 3 options; every option has `text` in hu/en/es/de; the hu texts differ; only the wrong",
        "  options have `wrong` (hu/en/es/de). gap items keep the same number of options; `wrong` is an object keyed by",
        "  each wrong option string, each with hu/en/es/de explanations.",
        "- Write natural Hungarian, English, Spanish (Mexican) and German; no machine-translation word salad.",
        'Return a JSON array with one object per item: {"id": <the item number you were given>, "item": <the complete rewritten item>}.',
        "Items:",
        json.dumps([{"id": str(n), "item": w["item"]} for n, w in enumerate(batch)], ensure_ascii=False, indent=1),
    ]
    return "\n".join(lines)


class Stop(Exception):
    pass


def call_gemini(key, model, prompt, schema=None, retries=5):
    config = {"temperature": 0.2, "responseMimeType": "application/json", "thinkingConfig": {"thinkingBudget": 0}}
    if schema:
        config["responseSchema"] = schema
    body = json.dumps({"contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": config}).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT.format(model=model), data=body,
        headers={"Content-Type": "application/json", "x-goog-api-key": key}, method="POST",
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


# ---------------------------------------------------------------------------------------------
# One batch: validate, write, update the debt list

def process_batch(kind, batch, results):
    """Validate the model's `results` (a list as returned by Gemini) and write the good items.
    Returns (fixed keys, [(key, reason)]). Nothing is written for a bad item."""
    track = KINDS[kind][1]
    by_id = {str(r.get("id")): r for r in results if isinstance(r, dict)} if isinstance(results, list) else {}
    good, failed = [], []
    for n, w in enumerate(batch):
        r = by_id.get(str(n))
        if r is None:
            failed.append((w["key"], "no answer"))
            continue
        if kind == "vosotros":
            new_item, err = validate_vosotros(w["item"], r.get("item"))
            if err:
                failed.append((w["key"], err))
            else:
                good.append((w, new_item))
        else:
            pairs, err = validate_match(track, w["item"]["pairs"], r.get("pairs"))
            if err:
                failed.append((w["key"], err))
            else:
                good.append((w, with_pairs(w["item"], pairs)))
    by_path = {}
    for w, new_item in good:
        by_path.setdefault(w["path"], []).append((w, new_item))
    fixed = []
    for path, entries in by_path.items():
        old_raw = path.read_text(encoding="utf-8", newline="")
        expected = {w["id"]: new_item for w, new_item in entries}
        try:
            if kind == "vosotros":
                new_raw = apply_items(old_raw, expected)
            else:
                new_raw = apply_match(old_raw, {i: it["pairs"] for i, it in expected.items()})
            verify_replacement(old_raw, new_raw, expected)
        except ValueError as err:
            failed += [(w["key"], f"write check: {short(err, 60)}") for w, _ in entries]
            continue
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(new_raw, encoding="utf-8", newline="")
        os.replace(tmp, path)
        fixed += [w["key"] for w, _ in entries]
    if fixed:
        remove_from_debt(kind, fixed)
    return fixed, failed


# ---------------------------------------------------------------------------------------------

def prompt_for(kind, batch):
    return build_vosotros_prompt(batch) if kind == "vosotros" else build_match_prompt(KINDS[kind][1], batch)


def dry_run(kinds, work, stale, sizes, model):
    print(f"--dry-run: nincs API-hívás, nincs írás, nem kell kulcs (modell: {model}).")
    for kind in kinds:
        w = [x for x in work if x["kind"] == kind]
        files = len({x["path"] for x in w})
        pairs = sum(len(x["item"].get("pairs", [])) for x in w) if kind != "vosotros" else 0
        extra = f", {pairs} pár" if pairs else ""
        print(f"  {kind}: {len(w)} tétel, {files} fájl{extra}, adag: {sizes[kind]} tétel/kérés")
    if stale:
        print(f"  FIGYELEM: {len(stale)} adósság-kulcs nem található a fájlokban: {stale[:3]}")
    bad = len(stale)
    # integrity check on the real files: the writers must reproduce each file when fed the items unchanged
    by_path = {}
    for w in work:
        by_path.setdefault((w["kind"], w["path"]), []).append(w)
    for (kind, path), entries in by_path.items():
        old_raw = path.read_text(encoding="utf-8", newline="")
        expected = {w["id"]: w["item"] for w in entries}
        try:
            if kind == "vosotros":
                new_raw = apply_items(old_raw, expected)
            else:
                new_raw = apply_match(old_raw, {w["id"]: w["item"]["pairs"] for w in entries})
            verify_replacement(old_raw, new_raw, expected)
        except ValueError as err:
            bad += 1
            print(f"  HIBA {kind} {path.name}: {short(err)}")
    print(f"  beszúrás-ellenőrzés: {len(by_path)} fájl, {bad} hiba (a fájlok nem változtak)")
    for kind in kinds:
        w = [x for x in work if x["kind"] == kind][: sizes[kind]]
        if w:
            print(f"\nAz első adag kérése ({kind}, {len(w)} tétel), kulcs nélkül:\n")
            print(prompt_for(kind, w)[:1800])
    return 1 if bad else 0


def run_audit():
    print("\nnode scripts/audit-games.mjs:")
    try:
        res = subprocess.run(["node", "scripts/audit-games.mjs"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    except OSError as err:
        print(f"  nem futtatható ({short(err)}), futtasd kézzel: node scripts/audit-games.mjs")
        return 1
    lines = (res.stdout or "").splitlines()
    print("\n".join(lines[:12]))
    return res.returncode


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--only", choices=("match", "match-en", "vosotros", "all"), default="all", help="which debt (default: all)")
    ap.add_argument("--topic", help="only this lesson file (name without .json)")
    ap.add_argument("--limit", type=int, default=0, help="fix at most N items in this run")
    ap.add_argument("--batch", type=int, default=0, help="items per request (default 6 for match, 3 for vosotros)")
    ap.add_argument("--sleep", type=float, default=7.0, help="pause between requests, seconds")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--dry-run", action="store_true", help="no API call, no write: plan + integrity check")
    args = ap.parse_args()

    kinds = tuple(KINDS) if args.only == "all" else (args.only,)
    work, stale = collect_work(kinds, args.topic)
    if args.limit:
        work = work[: args.limit]
    sizes = {k: args.batch or (3 if k == "vosotros" else 6) for k in KINDS}
    if args.dry_run:
        return dry_run(kinds, work, stale, sizes, args.model)

    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        print('Nincs GEMINI_API_KEY. PowerShell: $env:GEMINI_API_KEY = "<kulcs>" (a kulcsot nem írja ki a script).')
        return 2
    if not work:
        print("Nincs mit javítani: az adósság-listák üresek.")
        return 0

    batches = []
    for kind in kinds:
        items = [w for w in work if w["kind"] == kind]
        batches += [(kind, items[i:i + sizes[kind]]) for i in range(0, len(items), sizes[kind])]
    print(f"Függő tétel: {len(work)}, kérés: {len(batches)}, modell: {args.model}", flush=True)
    fixed_total, failed = 0, []
    try:
        for number, (kind, batch) in enumerate(batches, 1):
            print(f"[{number}/{len(batches)}] {kind}, {len(batch)} tétel ...", flush=True)
            results = None
            for attempt in range(2):
                try:
                    schema = None if kind == "vosotros" else match_schema()
                    results = call_gemini(key, args.model, prompt_for(kind, batch), schema)
                    break
                except ValueError as err:
                    print(f"    érvénytelen válasz ({short(err, 70)}), újrapróbálom", flush=True)
            if results is None:
                failed += [(w["key"], "no valid response") for w in batch]
                continue
            fixed, bad = process_batch(kind, batch, results)
            fixed_total += len(fixed)
            failed += bad
            print(f"    kész {len(fixed)}/{len(batch)}, összesen {fixed_total}", flush=True)
            if number < len(batches):
                time.sleep(args.sleep)
    except Stop as err:
        print(f"MEGÁLLT: {err}")
        print(f"Eddig kész: {fixed_total}. Ugyanaz a parancs onnan folytatja.")
        return 3
    except KeyboardInterrupt:
        print(f"\nMegszakítva. Eddig kész: {fixed_total}. Ugyanaz a parancs onnan folytatja.")
        return 130

    print(f"\nKész: {fixed_total} tétel javítva, {len(failed)} kihagyva (a következő futás újra megpróbálja).")
    for k, reason in failed[:8]:
        print(f"  kihagyva: {k}: {short(reason, 90)}")
    code = run_audit()
    print("Következő: nézd át néhány fájl diffjét (git diff), aztán szólj, mehet a commit.")
    return code


if __name__ == "__main__":
    sys.exit(main())
