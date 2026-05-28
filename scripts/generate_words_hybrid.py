#!/usr/bin/env python3
"""Hybrid word generator: MyMemory API for translations + Gemini Flash for sentences.

Usage:
  python3 scripts/generate_words_hybrid.py --level B1 --count 50
  python3 scripts/generate_words_hybrid.py --level A2 --count 100 --dry-run
"""

import argparse, json, os, re, sys, time, urllib.request, urllib.parse

API_KEY = None

def load_api_key():
    global API_KEY
    env_file = os.path.expanduser("~/.config/personal-auto/gemini.env")
    with open(env_file) as f:
        for line in f:
            if line.startswith("GEMINI_API_KEY="):
                API_KEY = line.strip().split("=", 1)[1]

def get_max_id(data_dir):
    max_id = 0
    for fname in os.listdir(data_dir):
        if not fname.endswith(".json"):
            continue
        with open(os.path.join(data_dir, fname)) as f:
            for w in json.load(f):
                max_id = max(max_id, w["id"])
    return max_id

def get_existing_words(json_path):
    with open(json_path) as f:
        data = json.load(f)
    return data, {w["es"].lower() for w in data}

def get_todo_words(todo_path, count):
    with open(todo_path) as f:
        words = [line.strip() for line in f if line.strip()]
    # Filter obvious bad words: proper nouns (capitalized), very short
    filtered = []
    for w in words:
        if not w or w[0].isupper() or len(w) < 2:
            continue
        filtered.append(w)
        if len(filtered) >= count * 2:
            break
    return filtered

def translate_mymemory(word, src, tgt, retries=3):
    """Translate using MyMemory API (free, no key)."""
    encoded = urllib.parse.quote(word)
    url = f"https://api.mymemory.translated.net/get?q={encoded}&langpair={src}|{tgt}"
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=10) as resp:
                data = json.loads(resp.read())
            result = data["responseData"]["translatedText"]
            # MyMemory sometimes returns the input unchanged
            if result.lower().strip() == word.lower().strip():
                return None
            return result
        except Exception:
            if attempt < retries - 1:
                time.sleep(1)
    return None

def add_article(word):
    """Add article for Spanish nouns if missing."""
    w = word.strip()
    if w.startswith(("el ", "la ", "los ", "las ", "un ", "una ")):
        return w
    return w  # verbs/adjectives stay as-is

def batch_translate(words):
    """Translate a batch of Spanish words to en/hu/de using MyMemory."""
    results = []
    for i, es_word in enumerate(words):
        print(f"  Translating {i+1}/{len(words)}: {es_word}", end="")
        en = translate_mymemory(es_word, "es", "en")
        time.sleep(0.3)  # rate limit courtesy
        hu = translate_mymemory(es_word, "es", "hu")
        time.sleep(0.3)
        de = translate_mymemory(es_word, "es", "de")
        time.sleep(0.3)

        if not en or not hu:
            print(" — skipped (bad translation)")
            continue

        # Clean up translations
        en = en.lower().strip()
        hu = hu.lower().strip()
        de = (de or "").strip()
        # German: remove article if MyMemory added one
        for art in ["der ", "die ", "das ", "ein ", "eine "]:
            if de.lower().startswith(art):
                de = de[len(art):]
                break
        de = de.capitalize() if de else ""

        print(f" → en:{en} hu:{hu} de:{de or '?'}")
        results.append({
            "es": add_article(es_word),
            "en": en,
            "hu": hu,
            "de": de,
        })

    return results

def call_gemini(prompt, retries=5):
    if not API_KEY:
        return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={API_KEY}"
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 8192}
    }).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read())
            return result["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            wait = min(60, 10 * (2 ** attempt))
            if attempt < retries - 1:
                print(f"  Gemini retry {attempt+1}: {e} (waiting {wait}s)")
                time.sleep(wait)
            else:
                print(f"  Gemini failed after {retries} retries")
                return None

def build_sentence_prompt(entries, level):
    level_grammar = {
        "A0": "very simple 3-4 word sentences, present tense only",
        "A1": "basic 3-5 word sentences, present tense",
        "A2": "3-6 word sentences, present + basic past, comparatives",
        "B1": "4-8 word sentences, past tenses, subjunctive basics, conditionals",
        "B2": "5-10 word sentences, full subjunctive, conditional clauses",
        "C1": "6-12 word sentences, complex clauses, idiomatic",
        "C2": "6-15 word sentences, native-level complexity",
    }
    grammar = level_grammar.get(level, "natural sentences")

    word_list = "\n".join(
        f'{i+1}. es:"{e["es"]}" en:"{e["en"]}" hu:"{e["hu"]}" de:"{e["de"]}"'
        for i, e in enumerate(entries)
    )

    return f"""Generate example sentences for these words. {grammar}.

Words:
{word_list}

For each word (same order), output a JSON array of objects:
{{"i": <1-based index>, "sentence_es": "...", "sentence_hu": "...", "sentence_en": "...", "sentence_de": "..."}}

Rules:
- Hungarian: natural, NOT literal translation
- Sentences should be diverse structures
- Output ONLY the JSON array, no markdown"""

def parse_response(text):
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r'^```\w*\n?', '', text)
        text = re.sub(r'\n?```$', '', text)
    return json.loads(text)

def generate_simple_sentences(entries):
    """Fallback: generate minimal sentences without AI."""
    for e in entries:
        e["sentence_es"] = f"{e['es'].capitalize()} es importante."
        e["sentence_hu"] = f"{e['hu'].capitalize()} fontos."
        e["sentence_en"] = f"{e['en'].capitalize()} is important."
        e["sentence_de"] = f"{e['de']} ist wichtig." if e['de'] else "Das ist wichtig."
    return entries

def remove_used_from_todo(todo_path, used_words):
    used_lower = set()
    for w in used_words:
        clean = w.lower()
        for art in ["el ", "la ", "los ", "las "]:
            if clean.startswith(art):
                clean = clean[len(art):]
        used_lower.add(clean)

    with open(todo_path) as f:
        lines = [line for line in f if line.strip().lower() not in used_lower]
    with open(todo_path, "w") as f:
        f.writelines(lines)
    return len(lines)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--level", required=True)
    parser.add_argument("--count", type=int, default=50)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-gemini", action="store_true", help="Skip Gemini, use fallback sentences")
    args = parser.parse_args()

    level = args.level.upper()
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    data_dir = os.path.join(base, "data", "words")
    json_path = os.path.join(data_dir, f"{level.lower()}.json")
    todo_path = os.path.join(base, f"todo_{level.lower()}.txt")

    if not os.path.exists(json_path):
        sys.exit(f"No file: {json_path}")
    if not os.path.exists(todo_path):
        sys.exit(f"No todo: {todo_path}")

    load_api_key()

    existing_data, existing_es = get_existing_words(json_path)
    max_id = get_max_id(data_dir)
    start_id = max_id + 1

    todo_words = get_todo_words(todo_path, args.count)
    if not todo_words:
        sys.exit("Todo list empty")

    print(f"Level: {level}")
    print(f"Existing: {len(existing_data)} words, max ID: {max_id}")
    print(f"Todo candidates: {len(todo_words)}")
    print(f"\nPhase 1: MyMemory translations...")

    translated = batch_translate(todo_words[:args.count + 20])

    # Dedupe
    deduped = []
    for t in translated:
        if t["es"].lower() not in existing_es:
            deduped.append(t)
            existing_es.add(t["es"].lower())
        if len(deduped) >= args.count:
            break

    print(f"\nGot {len(deduped)} unique translations")

    if not deduped:
        sys.exit("No new words after dedup")

    if args.dry_run:
        for d in deduped[:5]:
            print(f"  {d}")
        print("  ...")
        return

    # Phase 2: sentences
    print(f"\nPhase 2: Generating sentences...")
    if not args.no_gemini and API_KEY:
        # Process in chunks of 25 for Gemini
        chunk_size = 25
        for chunk_start in range(0, len(deduped), chunk_size):
            chunk = deduped[chunk_start:chunk_start + chunk_size]
            prompt = build_sentence_prompt(chunk, level)
            print(f"  Gemini call for words {chunk_start+1}-{chunk_start+len(chunk)}...")
            response = call_gemini(prompt)

            if response:
                try:
                    sentences = parse_response(response)
                    sent_map = {s["i"]: s for s in sentences}
                    for j, entry in enumerate(chunk):
                        s = sent_map.get(j + 1, {})
                        entry["sentence_es"] = s.get("sentence_es", f"{entry['es'].capitalize()} es importante.")
                        entry["sentence_hu"] = s.get("sentence_hu", f"Ez {entry['hu']}.")
                        entry["sentence_en"] = s.get("sentence_en", f"This is {entry['en']}.")
                        entry["sentence_de"] = s.get("sentence_de", f"Das ist {entry['de'] or 'wichtig'}.")
                except (json.JSONDecodeError, KeyError) as e:
                    print(f"  Parse error: {e}, using fallback")
                    generate_simple_sentences(chunk)
            else:
                print("  Gemini unavailable, using fallback sentences")
                generate_simple_sentences(chunk)

            time.sleep(2)
    else:
        print("  Using fallback sentences (no Gemini)")
        generate_simple_sentences(deduped)

    # Phase 3: assign IDs and write
    print(f"\nPhase 3: Writing {len(deduped)} words...")
    for i, entry in enumerate(deduped):
        entry["id"] = start_id + i
        entry["level"] = level

    existing_data.extend(deduped)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(existing_data, f, ensure_ascii=False, indent=2)

    used = {e["es"] for e in deduped}
    remaining = remove_used_from_todo(todo_path, used)

    print(f"\nDone! {len(existing_data)} total words in {level}")
    print(f"Todo remaining: {remaining}")

if __name__ == "__main__":
    main()
