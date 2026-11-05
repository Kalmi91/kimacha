#!/usr/bin/env python
"""Kimacha word pack: pre-generated Kokoro audio for the spoken card words.

Run it with the venv that has kokoro-onnx + soundfile, always isolated:
  <venv>\\Scripts\\python.exe -I scripts\\tts-pack.py <command>

Commands (count, gen, verify, pack take --set words|sentences; words is the default and unchanged):
  selftest                      FNV-1a test vectors + the (g, key) rule of the sentence pack
  count                         unique keys per language, characters, collisions; writes keys.json
                                (--set sentences: per source and language entries, characters, estimated
                                audio minutes; writes keys-sentences.json)
  gen [--lang es|en] [--limit N] [--shard I/N] [--threads T] [--force] [--order]
                                synthesize the missing files (resumable: existing files are kept);
                                --order (sentences): sources by priority, deck-examples first, instead of by key
  verify [--n 20]               sample check: length > 0.2 s, peak > 0.05, file name = FNV-1a of the key
  migrate                       (words) copy the v1 recordings (work/<lang>/<hash>.mp3, the word's own hash voice) into
                                the v2 layout work/<lang>/<g>/<hash>.mp3; only the other person is then generated
  pack                          kimacha-tts-pack-v2.tar.bz2 with index.json
                                (--set sentences: kimacha-tts-sentences-v2.tar.bz2)

Contract (shared with lib/neuralTts.ts of the app):
  key   = text.trim().normalize('NFC')       (case and article stay: "el perro")
  hash  = FNV-1a 32 bit over the UTF-8 bytes of the key, 8 lowercase hex digits
  voice = hash % 2 === 0 -> voice 0, else voice 1
          es [ef_dora, em_alex], en [af_heart, am_michael]
  v2 (EJSZAKA E101): the word pack is keyed like the sentence pack, EVERY word in BOTH voices of the pair:
  index = { "version": 2, "engine": "kokoro-v1.0", "files": { "es": { "<g>|key": "es/<g>/<hash>.mp3" }, "en": {...} } }
  (v1 had the plain key and es/<hash>.mp3, the word's own hash voice only; the app still reads a v1 index.)

Which text the card reads aloud (checked in the app code):
  lib/learn/usePcicSession.ts speak(promptSource, ...) on a new card and speak(best, ...) /
  speakSequence([best, example]) on reveal. promptSource = item[sourceLang], best comes from
  gradePcicAnswer(typed, answerText) in lib/pcicMatch.ts: an alternative of the answer field
  (pcicAlternatives: " / " split, "(optional)" parts, "a/b" within a word) or the full field.
  The decks (data/pcic.ts): en->es = data/words-open (es, en); es->en = data/words/en (es, en);
  hu target = data/words/hu (es, en as prompts). So every es and en field of those files is spoken
  in some direction, and the pack keys are the full field AND its pcicAlternatives.
  Example sentences are NOT in the word pack (they go to the on-device engine, or to the sentence pack).

Sentence pack contract (PLAN-fb1102.md "Audio round B"; shared with the app, lib/neuralModels.ts / lib/speech.ts):
  separate archive kimacha-tts-sentences-v2.tar.bz2 (installs to the folder kimacha-tts-sentences-v2)
  v2 (EJSZAKA E101): every sentence in BOTH speakers (f and m), and the Speak tab's story lines (speech-stories)
  index = { "version": 2, "engine": "kokoro-v1.0",
            "files": { "es": { "<g>|<key>": "es/<g>/<hash>.mp3" }, "en": { ... } } }
  g     = f | m, the sex of the speaker (the app: explicit gender, or the speakSequence shared-speaker gender,
          else the text's own hash gender: FNV-1a(key) even -> f, odd -> m)
  key, hash, collision suffix, audio format, sample rate, trim and checks: as the word pack
  voice = g f/m -> es ef_dora / em_alex, en af_heart / am_michael
  The (g, key) pairs mirror what the screens speak (read from the app code, 2026-11-02): see collect_sentences().
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

AUDIO = OUT / "work"  # staging: work/es/<g>/<hash>.mp3, work/en/<g>/<hash>.mp3 (the archive paths; v1 files sit at work/es/<hash>.mp3)
PACK_FILE = OUT / "kimacha-tts-pack-v2.tar.bz2"

# --set sentences: the sentence pack (keys are "<g>|<text>", files es/<g>/<hash>.mp3), its own output folder.
SET = "words"
SENT_OUT = Path(os.environ.get("TTS_PACK_OUT_SENTENCES", r"C:\AI\_work\tts-sentences"))
SENT_PACK_NAME = "kimacha-tts-sentences-v2.tar.bz2"
PACK_VERSION = 2
SENT_MP3_LEVEL = 0.7  # libsndfile MP3 compression_level (VBR quality scale 0..1) of the sentence pack only
GRAMMAR_DIRS = ("es", "en", "hu")  # data/games/grammar/<dir>: the language the lessons teach

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


# ---- sentence pack: (g, key) -----------------------------------------------------------------------

def gender_of(key: str) -> str:
    """The text's own hash gender (lib/neuralVoices.ts voiceFor(...).gender): even -> f (voice 0), odd -> m."""
    return "f" if fnv1a(key) % 2 == 0 else "m"


def sent_key(g: str, text: str) -> str:
    return f"{g}|{make_key(text)}"


def split_key(k: str):
    """(g, text) of a pack key "<g>|<text>" (both sets since v2)."""
    return (k[0], k[2:])


def voice_of(lang: str, k: str) -> str:
    g, text = split_key(k)
    return voice_for(lang, text) if g is None else VOICES[lang][0 if g == "f" else 1]


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


# ---- sentence pack collector -----------------------------------------------------------------------
# The (g, key) pairs, mirroring the callers (PLAN-fb1102.md "Audio round B", collector rules 1-4). Read from the
# app code 2026-11-02; a source is one place that speaks. Own hash gender = gender_of(key), what a plain speak() uses.
#   deck-examples      rule 1 (and rule 2 for the reading's example sentences): the card's example sentence once per
#                      distinct gender of its answer field's variants (components/learn/PcicRevealedAnswer.tsx,
#                      lib/learn/usePcicSession.ts speakRevealed; the reading speaks each sentence with its word's gender)
#   reading-stories    rule 2: data/practice/stories*.json, the target-language sentence with the gender of its word's
#                      full field (app/(tabs)/practice.tsx readAloud)
#   sentence-tab       the deck example sentences as the sentence cards speak them (TypedSentenceCard, EasySentenceCard:
#                      the ORIGINAL target sentence and the source-language sentence), with the gender of the card's
#                      word (the answer field's full-field word-pack voice, the reading's rule), not the sentence's own
#   sentence-chunks    rule 3: data/sentences/chunks.json (the shorter sentences of the tile steps, es target + en prompt)
#   situation          rule 3: the situation game (lines, pattern examples, words), es
#   speech-stories     the Speak tab (data/speech/stories.json, components/speech/*): her lines (turn), the "You can say"
#                      lines (branch say, the blank left out, lib/speech/stories.ts speakable), her reactions and ask-back
#                      answers (branch reply), the story words, and the bubble the app reads after a right answer: her
#                      reaction + " " + the next turn (bubbleOf). Intro, outro and scene are shown, never spoken.
#   grammar-read-aloud rule 3: a lesson's `speak` field as the read-aloud speaks it (lib/mixedSpeech.ts segments, one
#                      speaker per language of the sequence: the gender of the first segment of that language)
#   grammar-examples   rule 3: the lesson body's example sentences (components/grammar/LessonBody.tsx)
#   grammar-items      rule 3: the drills' sentences: gap (filled), mark, why, transform answer, spot (fixed), order,
#                      dictation, write (GrammarDrill, lessonTest `say`, WhyTransformItems, NewKinds)
#   grammar-forms      rule 3: form answers and the table deck's cells (MatchFormItems, app/grammar/deck)
# Priority order = what is heard most first (gen --order priority walks the keys in this order).
SENT_SOURCES = (
    "speech-stories",
    "deck-examples",
    "sentence-tab",
    "reading-stories",
    "sentence-chunks",
    "grammar-read-aloud",
    "grammar-items",
    "grammar-examples",
    "grammar-forms",
    "situation",
)
CHARS_PER_SEC = 14  # PLAN: estimated audio minutes = chars / 14 per second

PERSON_LABELS = {
    "yo", "tú", "usted", "ustedes", "él/ella", "él/ella/usted", "nosotros", "nosotros/nosotras",
    "vosotros", "vosotros/vosotras", "ellos/ellas", "ellos/ellas/ustedes",
}
VOSOTROS_PERSONS = {"vosotros", "vosotros/vosotras"}
INFINITIVE_RE = re.compile(r"^[a-zàáâäèéêëìíîïòóôöùúûüñç]*(ar|er|ir)(se)?$", re.I)
PUNCT_TAIL_RE = re.compile(r"[.,;:!?¡¿]+$")


def read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def deck_files(rel: str):
    d = ROOT / rel
    if not d.is_dir():
        return []
    return [c for c in (load_cards(f) for f in sorted(d.glob("*.json"))) if c]


def word_genders(answer) -> set:
    """Genders of the voices that can speak an answer field: the full field and each pcicAlternatives variant."""
    if not isinstance(answer, str):
        return set()
    out = set()
    full = make_key(answer)
    if full:
        out.add(gender_of(full))
    for alt in pcic_alternatives(answer):
        ak = make_key(alt)
        if ak:
            out.add(gender_of(ak))
    return out


def split_by_markers(text: str, learned: str, native: str) -> list:
    """Port of lib/mixedSpeech.ts splitByMarkers: [(text, lang)], the «...» stretches in the learned language."""
    segs, i = [], 0
    while i < len(text):
        op = text.find("«", i)
        if op == -1:
            rest = js_trim(text[i:])
            if rest:
                segs.append((rest, native))
            break
        before = js_trim(text[i:op])
        if before:
            segs.append((before, native))
        cl = text.find("»", op + 1)
        if cl == -1:
            rest = js_trim(text[op + 1:])
            if rest:
                segs.append((rest, native))
            break
        inside = js_trim(text[op + 1:cl])
        if inside:
            segs.append((inside, learned))
        i = cl + 1
    return segs


def split_punct(token: str):
    m = PUNCT_TAIL_RE.search(token)
    return (token[: -len(m.group(0))], m.group(0)) if m else (token, "")


def fixed_sentence(es: str, wrong_index: int, fix: str) -> str:
    """Port of components/grammar/NewKinds.tsx fixedSentence."""
    words = [w for w in re.split(r"\s+", es) if w]
    wrong = words[wrong_index] if 0 <= wrong_index < len(words) else ""
    _, tail = split_punct(wrong)
    if fix == "":
        rest = [w for i, w in enumerate(words) if i != wrong_index]
        if tail and rest:
            at = min(wrong_index, len(rest)) - 1
            if at >= 0:
                rest[at] = split_punct(rest[at])[0] + tail
        return " ".join(rest)
    if 0 <= wrong_index < len(words):
        words[wrong_index] = fix + tail
    return " ".join(words)


def table_cells(body: list) -> list:
    """Port of lib/grammar/tableDeck.ts tableCellsForLesson (+ lib/grammar/tableShape.ts): the answers of the cell cards."""
    def person(label) -> bool:
        return isinstance(label, str) and label.strip().lower() in PERSON_LABELS

    def conj(header, rows) -> bool:
        if len(header) < 2 or not rows:
            return False
        return all(INFINITIVE_RE.match(str(h.get("es", "")).strip()) for h in header[1:]) and all(person(r[0] if r else None) for r in rows)

    out = []
    for b in body:
        if not isinstance(b, dict) or b.get("kind") != "table" or b.get("noTableDeck"):
            continue
        header, rows = b.get("header") or [], b.get("rows") or []
        if not all(isinstance(h, dict) for h in header) or not all(isinstance(r, list) for r in rows):
            continue
        is_conj = conj(header, rows)
        is_person = len(header) >= 2 and bool(rows) and not is_conj and all(person(r[0] if r else None) for r in rows)
        is_meaning = len(header) >= 2 and bool(rows) and not is_conj and str(header[0].get("en", "")).strip().lower() == "meaning"
        if is_conj or is_person:
            for r in rows:
                if r[0].strip().lower() in VOSOTROS_PERSONS:
                    continue
                out += [c for c in r[1:len(header)] if isinstance(c, str) and c]
        elif is_meaning:
            out += [r[1] for r in rows if len(r) > 1 and r[0] and isinstance(r[1], str) and r[1]]
    return out


def collect_sentences():
    """Returns (keys {lang: ordered list of "<g>|<text>"}, stats). Order = source priority, then file order."""
    src = {s: {l: {} for l in LANGS} for s in SENT_SOURCES}
    notes = {"story_unresolved": 0}

    def add(source: str, lang: str, g: str, text):
        # a segment of punctuation only ("." between two «...» stretches) has nothing to say
        # v2: both people of the pair for every line (the learner may have chosen either), whatever g the caller worked out
        if lang in LANGS and isinstance(text, str) and any(ch.isalnum() for ch in text):
            for gg in ("f", "m"):
                src[source][lang][sent_key(gg, text)] = True

    def add_story(lang: str, text):
        if isinstance(text, str) and make_key(text):
            add("speech-stories", lang, "f", text)

    def add_own(source: str, lang: str, text):
        if isinstance(text, str) and make_key(text):
            add(source, lang, gender_of(make_key(text)), text)

    # rule 1 / 2 (deck-examples) and the sentence cards (sentence-tab): same files and vosotros rule as the word pack
    for rel, tl, tfield, sl, sfield in (
        ("data/words-open", "es", "sentence_es", "en", "sentence_en"),
        ("data/words/en", "en", "sentence_en", "es", "sentence_es"),
    ):
        for cards in deck_files(rel):
            for c in cards:
                if rel == "data/words/en" and c.get("vosotros"):
                    continue
                for g in sorted(word_genders(c.get(tl))):
                    add("deck-examples", tl, g, c.get(tfield))
                # the sentence cards speak both sides with the card word's gender (full field), the original text
                word = c.get(tl)
                if isinstance(word, str) and make_key(word):
                    add("sentence-tab", tl, gender_of(make_key(word)), c.get(tfield))
                    add("sentence-tab", sl, gender_of(make_key(word)), c.get(sfield))

    # rule 2: the reading's stories, each sentence with the gender of its word's full field
    open_es = {f"o{c['order']}": c.get("es") for cards in deck_files("data/words-open") for c in cards if "order" in c}
    en_en = {f"e{c['id']}": c.get("en") for cards in deck_files("data/words/en") for c in cards if "id" in c}
    for fname, lang, words in (("stories.json", "es", open_es), ("stories-en.json", "en", en_en)):
        for story in read_json(DATA / "practice" / fname) or []:
            for s in story.get("sentences", []):
                word = words.get(s.get("word"))
                if not (isinstance(word, str) and make_key(word)):
                    notes["story_unresolved"] += 1
                    continue
                add("reading-stories", lang, gender_of(make_key(word)), s.get(lang))

    # the Speak tab's stories (data/speech/stories.json): every line the screens speak, see SENT_SOURCES
    turns_by_story = 0
    for story in read_json(DATA / "speech" / "stories.json") or []:
        lang = story.get("target")
        if lang not in LANGS:
            continue
        turns_by_story += 1
        turns = {t.get("id"): t for t in story.get("turns", [])}
        for w in story.get("words", []):
            add_story(lang, w.get(lang))
        for t in turns.values():
            add_story(lang, t.get(lang))
            for b in t.get("branches", []):
                for x in b.get("say", []):
                    if isinstance(x.get(lang), str):
                        add_story(lang, re.sub(r"_{3}", "", x[lang]).strip())
                reply = (b.get("reply") or {}).get(lang)
                add_story(lang, reply)
                nxt = turns.get(b.get("next"))
                if reply and nxt and not b.get("back") and not nxt.get("recall"):
                    add_story(lang, f"{reply} {nxt.get(lang)}")
    notes["story_lines"] = turns_by_story

    # rule 3: sentence cards' chunk steps
    for parts in (read_json(DATA / "sentences" / "chunks.json") or {}).values():
        for p in parts:
            for lang in LANGS:
                add_own("sentence-chunks", lang, p.get(lang))

    # rule 3: the situation game (es)
    for sit in read_json(DATA / "practice" / "situations.json") or []:
        for text in [l.get("es") for l in sit.get("lines", [])] + [p.get("example") for p in sit.get("patterns", [])] + [w.get("es") for w in sit.get("words", [])]:
            add_own("situation", "es", text)

    # rule 3: grammar (lessons teaching es / en; hu lessons only through their es / en read-aloud stretches)
    for d in GRAMMAR_DIRS:
        for f in sorted((DATA / "games" / "grammar" / d).glob("*.json")):
            lesson = read_json(f)
            if not isinstance(lesson, dict):
                continue
            speak = lesson.get("speak")
            if isinstance(speak, dict):
                for content in ("en", "es", "hu"):
                    if content == d:
                        continue
                    own = speak.get(content)
                    first = {}
                    for text, lang in split_by_markers(own if own is not None else (speak.get("en") or ""), d, content if own is not None else "en"):
                        if lang in LANGS:  # one speaker per language of the sequence (lib/speech.ts withSharedSpeaker)
                            first.setdefault(lang, gender_of(make_key(text)))
                            add("grammar-read-aloud", lang, first[lang], text)
            if d not in LANGS:
                continue
            for b in lesson.get("body") or []:
                if not isinstance(b, dict):
                    continue
                groups = {"list": "items", "usage": "points", "contrast": "pairs"}.get(b.get("kind"))
                for entry in (b.get(groups) or []) if groups else []:
                    for ex in entry.get("examples") or []:
                        add_own("grammar-examples", d, ex.get("es"))
            for text in table_cells(lesson.get("body") or []):
                add_own("grammar-forms", d, text)
            for it in lesson.get("items") or []:
                if not isinstance(it, dict):
                    continue
                kind = it.get("kind")
                if kind in (None, "gap") and isinstance(it.get("sentence"), str):
                    opts, ci, s = it.get("options"), it.get("correct"), it["sentence"]
                    if isinstance(opts, list) and isinstance(ci, int) and 0 <= ci < len(opts) and isinstance(opts[ci], str):
                        s = s.replace("___", opts[ci], 1)
                    add_own("grammar-items", d, s)
                elif kind == "mark":
                    add_own("grammar-items", d, it.get("sentence"))
                elif kind in ("why", "order", "dictation", "write"):
                    add_own("grammar-items", d, it.get("es"))
                elif kind == "transform":
                    add_own("grammar-items", d, it.get("answer"))
                elif kind == "spot":
                    opts, ci, wi = it.get("options"), it.get("correctIndex"), it.get("wrongIndex")
                    if isinstance(it.get("es"), str) and isinstance(opts, list) and isinstance(ci, int) and isinstance(wi, int) and 0 <= ci < len(opts):
                        add_own("grammar-items", d, fixed_sentence(it["es"], wi, opts[ci]))
                elif kind == "form":
                    add_own("grammar-forms", d, it.get("answer"))

    keys = {l: list(dict.fromkeys(k for s in SENT_SOURCES for k in src[s][l])) for l in LANGS}
    stats = {
        "sources": {s: {l: list(src[s][l]) for l in LANGS} for s in SENT_SOURCES},
        "total": {l: len(keys[l]) for l in LANGS},
        "chars": {l: sum(len(k) - 2 for k in keys[l]) for l in LANGS},
        "notes": notes,
    }
    return keys, stats


def collect_all():
    if SET == "sentences":
        return collect_sentences()
    keys, st = collect_keys()  # v2: every word in both voices of the pair
    return {l: [f"{g}|{k}" for k in keys[l] for g in ("f", "m")] for l in LANGS}, st


def assign_files(keys: dict) -> dict:
    """{lang: {key: 'es/<hash>.mp3'}}; a 32-bit hash collision gets a '-2' suffix (deterministic).
    Sentence set: key "<g>|<text>" -> 'es/<g>/<hash of text>.mp3', collisions counted per (lang, g)."""
    out = {}
    collisions = 0
    for lang in LANGS:
        used, m = set(), {}
        for k in sorted(keys[lang]):  # sorted: the same names whatever order the caller walks the keys in
            g, text = split_key(k)
            h = hash_hex(text)
            name = h
            n = 2
            while (g, name) in used:
                collisions += 1 if n == 2 else 0
                name = f"{h}-{n}"
                n += 1
            used.add((g, name))
            m[k] = f"{lang}/{g + '/' if g else ''}{name}.{EXT}"
        out[lang] = m
    out["_collisions"] = collisions
    return out


def keys_path() -> Path:
    return OUT / ("keys-sentences.json" if SET == "sentences" else "keys.json")


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
    # sentence pack (g, key) rule: key, hash, own hash gender, voice, file path. Hashes and genders were computed
    # with the app's own algorithm (lib/neuralVoices.ts fnv1a over packKey, even -> f, odd -> m).
    global SET
    saved, SET = SET, "sentences"
    try:
        sent_cases = (
            # lang, g (None = the text's own hash gender), raw text, key, hash, expected g, voice, path
            ("es", "f", "  ¿Dónde está el baño?\n", "¿Dónde está el baño?", "5382b1ed", "f", "ef_dora", "es/f/5382b1ed"),
            ("en", None, "I'm hungry.", "I'm hungry.", "b889eaa9", "m", "am_michael", "en/m/b889eaa9"),
            ("es", None, unicodedata.normalize("NFD", "Mañana voy al médico. "), "Mañana voy al médico.", "8de73d02", "f", "ef_dora", "es/f/8de73d02"),
        )
        for lang, g, raw, key, want_hash, want_g, want_voice, want_path in sent_cases:
            k = make_key(raw)
            g_used = g or gender_of(k)
            sk = sent_key(g_used, raw)
            files = assign_files({"es": [sk] if lang == "es" else [], "en": [sk] if lang == "en" else []})
            good = (
                k == key
                and hash_hex(k) == want_hash
                and g_used == want_g
                and split_key(sk) == (want_g, key)
                and voice_of(lang, sk) == want_voice
                and files[lang][sk] == f"{want_path}.{EXT}"
            )
            ok &= good
            print(f"sentence ({lang}, {g_used}, {key!r}) -> {files[lang][sk]} {voice_of(lang, sk)} {'ok' if good else 'FAIL'}")
    finally:
        SET = saved
    return 0 if ok else 1


def count_sentences() -> int:
    keys, st = collect_sentences()
    OUT.mkdir(parents=True, exist_ok=True)
    files = assign_files(keys)
    print(f"{'source':<20} {'lang':<4} {'entries':>8} {'chars':>9} {'est. min':>9}")
    for s in SENT_SOURCES:
        for lang in LANGS:
            ks = st["sources"][s][lang]
            chars = sum(len(k) - 2 for k in ks)
            print(f"{s:<20} {lang:<4} {len(ks):>8} {chars:>9} {chars / CHARS_PER_SEC / 60:>9.0f}")
    for lang in LANGS:
        chars = st["chars"][lang]
        print(f"{'UNION (distinct)':<20} {lang:<4} {st['total'][lang]:>8} {chars:>9} {chars / CHARS_PER_SEC / 60:>9.0f}")
    print(f"story sentences without a resolvable word {st['notes']['story_unresolved']}, speech stories read {st['notes']['story_lines']}, hash collisions {files['_collisions']}")
    done = sum(1 for lang in LANGS for k in keys[lang] if (AUDIO / files[lang][k]).exists() and (AUDIO / files[lang][k]).stat().st_size > 0)
    print(f"entries with (g, text) {sum(len(keys[l]) for l in LANGS)}, already recorded {done}, missing {sum(len(keys[l]) for l in LANGS) - done}")
    keys_path().write_text(json.dumps(keys, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {keys_path()}")
    return 0


def cmd_count(_args) -> int:
    if SET == "sentences":
        return count_sentences()
    keys, st = collect_keys()
    OUT.mkdir(parents=True, exist_ok=True)
    files = assign_files({l: [f"{g}|{k}" for k in keys[l] for g in ("f", "m")] for l in LANGS})
    for rel, counts in st["per_file"]:
        print(f"  {rel}: {counts}")
    for lang in LANGS:
        print(
            f"{lang}: unique keys {st['total'][lang]} (field texts {st['full'][lang]} + alternative-only {st['alt_only'][lang]}), "
            f"chars {st['chars'][lang]}"
        )
    print(f"empty fields skipped {st['empty_skipped']}, hash collisions {files['_collisions']}")
    gkeys = {l: [f"{g}|{k}" for k in keys[l] for g in ("f", "m")] for l in LANGS}
    done = sum(1 for lang in LANGS for k in gkeys[lang] if (AUDIO / files[lang][k]).exists() and (AUDIO / files[lang][k]).stat().st_size > 0)
    print(f"v2 recordings (both voices): {sum(len(gkeys[l]) for l in LANGS)}, already there {done}, missing {sum(len(gkeys[l]) for l in LANGS) - done}")
    keys_path().write_text(json.dumps(gkeys, ensure_ascii=False), encoding="utf-8")
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
        # the sentence pack is VBR (smaller files); the word pack keeps the default encoding, byte for byte
        vbr = {"compression_level": SENT_MP3_LEVEL, "bitrate_mode": "VARIABLE"} if SET == "sentences" else {}
        sf.write(str(tmp), samples, SAMPLE_RATE, format="MP3", subtype="MPEG_LAYER_III", **vbr)
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

    keys, st = collect_all()
    # the word set stops when it is over the plan's size; the sentence set has no ceiling, count's table is read first
    over = [] if SET == "sentences" else [l for l in LANGS if st["total"][l] > LIMIT_PER_LANG]
    if over and not args.force:
        print(f"STOP: over {LIMIT_PER_LANG} unique keys for {over}; use --force after the report.")
        return 2
    files = assign_files(keys)
    OUT.mkdir(parents=True, exist_ok=True)
    keys_path().write_text(json.dumps(keys, ensure_ascii=False), encoding="utf-8")
    if SET == "sentences" and args.order != "priority":
        keys = {l: sorted(keys[l]) for l in LANGS}  # collect_sentences walks the sources in priority order
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
    if SET == "sentences" and FORMAT == "mp3":
        meta.update({"compression_level": SENT_MP3_LEVEL, "bitrate_mode": "VARIABLE"})
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
                samples, sr = k.create(split_key(key)[1], voice=voice_of(lang, key), speed=1.0, lang=codes[lang])
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
        g, text = split_key(key)
        hash_ok = (stem == hash_hex(text) or stem.startswith(hash_hex(text) + "-")) and (g is None or Path(rel).parent.name == g)
        ok = dur > 0.2 and peak > 0.05 and hash_ok and sr == SAMPLE_RATE
        bad += 0 if ok else 1
        print(f"{'ok  ' if ok else 'FAIL'} {lang} {key!r} {voice_of(lang, key)} {dur:.2f}s peak {peak:.2f} sr {sr} {rel}")
    print(f"sample {len(sample)}: {len(sample) - bad} ok, {bad} bad")
    return 0 if bad == 0 and sample else 1


def cmd_migrate(_args) -> int:
    """words: v1 recordings (work/<lang>/<hash[-n]>.mp3 = the word's own hash voice) -> v2 path of that voice. Copies, keeps v1."""
    import shutil

    if SET != "words":
        print("migrate is for the word set")
        return 1
    plain, _ = collect_keys()
    old = {}
    for lang in LANGS:  # the v1 names: collisions counted per language, no g
        used, m = set(), {}
        for k in sorted(plain[lang]):
            h = hash_hex(k)
            name, n = h, 2
            while name in used:
                name = f"{h}-{n}"
                n += 1
            used.add(name)
            m[k] = f"{lang}/{name}.{EXT}"
        old[lang] = m
    new = assign_files({l: [f"{g}|{k}" for k in plain[l] for g in ("f", "m")] for l in LANGS})
    copied = kept = missing = 0
    for lang in LANGS:
        for k in plain[lang]:
            src = AUDIO / old[lang][k]
            dst = AUDIO / new[lang][f"{gender_of(k)}|{k}"]
            if dst.exists() and dst.stat().st_size > 0:
                kept += 1
            elif src.exists() and src.stat().st_size > 0:
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)
                copied += 1
            else:
                missing += 1
    print(f"migrate: copied {copied}, already in v2 {kept}, no v1 file {missing}")
    return 0


def cmd_pack(_args) -> int:
    keys = load_keys()
    files = assign_files(keys)
    have = present(keys, files)
    index = {"version": PACK_VERSION, "engine": "kokoro-v1.0", "files": {l: {k: files[l][k] for k in have[l]} for l in LANGS}}
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

    def with_set(p):
        p.add_argument("--set", choices=("words", "sentences"), default="words", help="words (default) or the sentence pack")
        return p

    sub.add_parser("selftest")
    with_set(sub.add_parser("count"))
    g = with_set(sub.add_parser("gen"))
    g.add_argument("--lang", choices=LANGS)
    g.add_argument("--limit", type=int, default=0)
    g.add_argument("--shard", help="I/N: only keys whose position % N == I")
    g.add_argument("--threads", type=int, default=0)
    g.add_argument("--force", action="store_true")
    g.add_argument(
        "--order",
        nargs="?",
        const="priority",
        default="sorted",
        choices=("priority", "sorted"),
        help="sentences set: --order walks the sources by priority (what is heard most first); default sorted by key. Use the same value in every shard.",
    )
    v = with_set(sub.add_parser("verify"))
    v.add_argument("--n", type=int, default=20)
    with_set(sub.add_parser("pack"))
    with_set(sub.add_parser("migrate"))
    args = ap.parse_args()
    if getattr(args, "set", "words") == "sentences":
        global SET, OUT, AUDIO, PACK_FILE
        SET, OUT = "sentences", SENT_OUT
        AUDIO, PACK_FILE = OUT / "work", OUT / SENT_PACK_NAME
    return {"selftest": cmd_selftest, "count": cmd_count, "gen": cmd_gen, "verify": cmd_verify, "pack": cmd_pack, "migrate": cmd_migrate}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
