#!/usr/bin/env python3
"""Generate word entries for Kimacha using Gemini Flash API.

Usage:
  python3 scripts/generate_words.py --level B1 --count 50
  python3 scripts/generate_words.py --level A2 --count 100
  python3 scripts/generate_words.py --level B1 --count 50 --dry-run
"""

import argparse, json, os, re, sys, time

API_KEY = None

def load_api_key():
    global API_KEY
    env_file = os.path.expanduser("~/.config/personal-auto/gemini.env")
    with open(env_file) as f:
        for line in f:
            if line.startswith("GEMINI_API_KEY="):
                API_KEY = line.strip().split("=", 1)[1]
    if not API_KEY:
        sys.exit("No GEMINI_API_KEY found")

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
    return words[:count * 2]  # grab extra, some will be skipped

def call_gemini(prompt, retries=5):
    import urllib.request
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
                print(f"  Retry {attempt+1}: {e} (waiting {wait}s)")
                time.sleep(wait)
            else:
                raise

def build_prompt(words, level, start_id):
    level_grammar = {
        "A0": "present tense only, very simple 3-4 word sentences",
        "A1": "present tense, basic sentences 3-5 words",
        "A2": "present + basic past tense, 3-6 word sentences, comparatives, reflexives",
        "B1": "past tenses (indefinido/imperfecto), subjunctive basics, conditionals, 4-8 word sentences",
        "B2": "full subjunctive, conditional clauses, passive voice, 5-10 word sentences",
        "C1": "literary forms, complex clauses, idiomatic expressions, 6-12 word sentences",
        "C2": "native-level complexity, nuanced expressions, 6-15 word sentences",
    }
    grammar = level_grammar.get(level, "natural sentences")

    return f"""Generate JSON word entries for a language learning app.

INPUT WORDS (Spanish, pick the good ones — skip proper nouns, conjugated verb forms, gerunds, diminutives):
{', '.join(words)}

OUTPUT: JSON array. Each entry:
{{
  "id": <sequential from {start_id}>,
  "level": "{level}",
  "es": "<Spanish word — nouns MUST have article: el/la/los/las>",
  "hu": "<Hungarian translation — concise, 1-2 words>",
  "en": "<English translation — concise>",
  "sentence_es": "<Spanish example sentence — {grammar}>",
  "sentence_hu": "<Hungarian sentence — natural, NOT literal translation>",
  "sentence_en": "<English sentence — natural>",
  "de": "<German translation — nouns WITHOUT article>",
  "sentence_de": "<German sentence — natural>"
}}

RULES:
- Spanish nouns ALWAYS with article (el gato, la casa, los niños)
- German `de` field: noun WITHOUT article (Katze not die Katze). Article goes in sentence_de only.
- Hungarian must be natural Hungarian, not word-by-word translation
- Skip words that are proper nouns (María, Richard), conjugated forms (estén, ibas), gerunds (comiendo)
- For verbs use infinitive form (hablar, comer, vivir)
- Output ONLY the JSON array, no markdown, no explanation
- Sentences should be diverse — don't repeat the same structure"""

def parse_response(text):
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r'^```\w*\n?', '', text)
        text = re.sub(r'\n?```$', '', text)
    return json.loads(text)

def remove_used_from_todo(todo_path, used_es_words):
    used_lower = {w.lower().replace("el ", "").replace("la ", "").replace("los ", "").replace("las ", "") for w in used_es_words}
    with open(todo_path) as f:
        lines = [line for line in f if line.strip().lower() not in used_lower]
    with open(todo_path, "w") as f:
        f.writelines(lines)
    return len(lines)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--level", required=True, help="CEFR level: A0, A1, A2, B1, B2, C1, C2")
    parser.add_argument("--count", type=int, default=50, help="Words to generate (default 50)")
    parser.add_argument("--dry-run", action="store_true", help="Print prompt only")
    args = parser.parse_args()

    level = args.level.upper()
    data_dir = os.path.join(os.path.dirname(__file__), "..", "data", "words")
    data_dir = os.path.abspath(data_dir)
    json_path = os.path.join(data_dir, f"{level.lower()}.json")
    todo_path = os.path.join(os.path.dirname(__file__), "..", f"todo_{level.lower()}.txt")
    todo_path = os.path.abspath(todo_path)

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
    print(f"Existing: {len(existing_data)} words")
    print(f"Max ID: {max_id}, starting at: {start_id}")
    print(f"Todo candidates: {len(todo_words)}")
    print(f"Requesting: {args.count} words")

    # Process in chunks of 50 to stay within token limits
    chunk_size = min(50, args.count)
    total_added = 0
    todo_offset = 0

    while total_added < args.count and todo_offset < len(todo_words):
        batch_words = todo_words[todo_offset:todo_offset + chunk_size + 20]  # extra for skips
        todo_offset += chunk_size + 20

        prompt = build_prompt(batch_words, level, start_id + total_added)

        if args.dry_run:
            print(f"\n--- PROMPT (chunk {total_added // chunk_size + 1}) ---")
            print(prompt)
            return

        print(f"\nCalling Gemini Flash (chunk {total_added // chunk_size + 1})...")
        response = call_gemini(prompt)

        try:
            new_entries = parse_response(response)
        except json.JSONDecodeError:
            print(f"ERROR: Failed to parse response. Raw:\n{response[:500]}")
            continue

        # Fix IDs to be sequential
        for i, entry in enumerate(new_entries):
            entry["id"] = start_id + total_added + i
            entry["level"] = level

        # Dedupe against existing
        deduped = []
        for entry in new_entries:
            es_lower = entry["es"].lower()
            if es_lower not in existing_es:
                deduped.append(entry)
                existing_es.add(es_lower)

        if not deduped:
            print("  All duplicates, skipping chunk")
            continue

        # Append to JSON
        existing_data.extend(deduped)
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(existing_data, f, ensure_ascii=False, indent=2)

        # Remove from todo
        used_words = {e["es"] for e in deduped}
        remaining = remove_used_from_todo(todo_path, used_words)

        total_added += len(deduped)
        print(f"  +{len(deduped)} words (total: {len(existing_data)}), todo remaining: {remaining}")

        if total_added < args.count:
            time.sleep(1)

    print(f"\nDone! Added {total_added} words to {json_path}")

if __name__ == "__main__":
    main()
