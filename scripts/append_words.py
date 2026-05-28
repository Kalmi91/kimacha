#!/usr/bin/env python3
"""Safely append new words from a temp JSON file to a level file.

Usage:
  python3 scripts/append_words.py --level B1 --input /tmp/new_b1_words.json

Reads new entries from input, assigns sequential IDs, deduplicates,
validates, and appends to the level JSON. Never overwrites existing data.
"""

import argparse, json, os, sys, glob

DE_ARTICLES = ["der ", "die ", "das ", "ein ", "eine "]

def get_max_id(data_dir):
    max_id = 0
    for f in glob.glob(os.path.join(data_dir, "*.json")):
        if "backup" in f:
            continue
        for w in json.load(open(f)):
            max_id = max(max_id, w["id"])
    return max_id

def validate_entry(w, idx):
    issues = []
    for field in ["es", "hu", "en", "de", "sentence_es", "sentence_hu", "sentence_en", "sentence_de"]:
        if not w.get(field, "").strip():
            issues.append(f"empty {field}")
    de = w.get("de", "")
    for art in DE_ARTICLES:
        if de.lower().startswith(art):
            w["de"] = de[len(art):].strip()
            if w["de"]:
                w["de"] = w["de"][0].upper() + w["de"][1:]
            issues.append(f"fixed DE article: {de} → {w['de']}")
            break
    return issues

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--level", required=True)
    parser.add_argument("--input", required=True, help="Path to temp JSON with new words")
    args = parser.parse_args()

    level = args.level.upper()
    data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "words"))
    json_path = os.path.join(data_dir, f"{level.lower()}.json")

    with open(json_path) as f:
        existing = json.load(f)
    existing_es = {w["es"].lower() for w in existing}

    with open(args.input) as f:
        new_words = json.load(f)

    max_id = get_max_id(data_dir)
    next_id = max_id + 1

    added = []
    skipped = 0
    for w in new_words:
        es_lower = w.get("es", "").lower()
        if es_lower in existing_es:
            print(f"  SKIP dupe: {w.get('es')}")
            skipped += 1
            continue
        issues = validate_entry(w, len(added))
        w["id"] = next_id
        w["level"] = level
        next_id += 1
        added.append(w)
        existing_es.add(es_lower)
        if issues:
            print(f"  WARN {w['es']}: {', '.join(issues)}")

    if not added:
        print("Nothing to add.")
        return

    existing.extend(added)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    print(f"\nDone: +{len(added)} words (skipped {skipped} dupes)")
    print(f"Total: {len(existing)} words in {level}")
    print(f"IDs: {added[0]['id']} - {added[-1]['id']}")

if __name__ == "__main__":
    main()
