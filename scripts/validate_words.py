#!/usr/bin/env python3
"""Validate and auto-fix word entries in Kimacha data files.

Usage:
  python3 scripts/validate_words.py                # check all levels
  python3 scripts/validate_words.py --level B1     # check one level
  python3 scripts/validate_words.py --fix          # auto-fix what's possible
"""

import argparse, json, os, re, sys, glob

REQUIRED_FIELDS = ["id", "level", "es", "hu", "en", "sentence_es", "sentence_hu", "sentence_en", "de", "sentence_de"]
DE_ARTICLES = ["der ", "die ", "das ", "ein ", "eine ", "einem ", "einer ", "eines "]
ES_ARTICLES = ["el ", "la ", "los ", "las ", "un ", "una "]
ES_VERBS_HINT = ["ar", "er", "ir", "ír"]  # infinitive endings

def validate_file(json_path, fix=False):
    with open(json_path) as f:
        data = json.load(f)

    level = os.path.basename(json_path).replace(".json", "").upper()
    errors = []
    warnings = []
    fixes_applied = 0

    # Duplicate check
    es_seen = {}
    for i, w in enumerate(data):
        es_lower = w["es"].lower()
        if es_lower in es_seen:
            errors.append(f'DUPE: "{w["es"]}" (id {w["id"]}) = same as id {es_seen[es_lower]}')
        else:
            es_seen[es_lower] = w["id"]

    # Per-entry checks
    for i, w in enumerate(data):
        wid = w.get("id", "?")
        prefix = f"[{level} id:{wid}]"

        # Missing fields
        for field in REQUIRED_FIELDS:
            if field not in w or not str(w[field]).strip():
                errors.append(f"{prefix} missing/empty field: {field}")

        # DE field has article
        de_val = str(w.get("de", ""))
        for art in DE_ARTICLES:
            if de_val.lower().startswith(art):
                errors.append(f'{prefix} DE has article: "{de_val}"')
                if fix:
                    w["de"] = de_val[len(art):].strip()
                    if w["de"]:
                        w["de"] = w["de"][0].upper() + w["de"][1:]
                    fixes_applied += 1
                break

        # ES noun without article (heuristic: if not a verb/adjective/adverb)
        es_val = str(w.get("es", ""))
        has_article = any(es_val.lower().startswith(a) for a in ES_ARTICLES)
        is_verb = any(es_val.endswith(s) for s in ["ar", "er", "ir", "ír", "arse", "erse", "irse"])
        is_adj_adv = any(es_val.endswith(s) for s in ["o", "a", "e", "mente", "ble", "al", "iz"])
        # If it looks like a noun (not verb, not adj) and no article → warning
        if not has_article and not is_verb and not is_adj_adv and len(es_val) > 3:
            warnings.append(f'{prefix} ES possibly missing article: "{es_val}"')

        # Sentence length checks
        for lang in ["es", "hu", "en", "de"]:
            sent = str(w.get(f"sentence_{lang}", ""))
            word_count = len(sent.split())
            if word_count < 2:
                errors.append(f'{prefix} sentence_{lang} too short ({word_count} words): "{sent}"')
            if word_count > 15:
                warnings.append(f'{prefix} sentence_{lang} very long ({word_count} words)')

        # Level mismatch
        if w.get("level", "").upper() != level:
            errors.append(f'{prefix} level mismatch: "{w.get("level")}" != "{level}"')
            if fix:
                w["level"] = level
                fixes_applied += 1

        # ID not integer
        if not isinstance(w.get("id"), int):
            errors.append(f'{prefix} id is not integer: {w.get("id")}')

    # Remove duplicates if fixing
    if fix:
        seen = {}
        deduped = []
        removed = 0
        for w in data:
            es_lower = w["es"].lower()
            if es_lower not in seen:
                seen[es_lower] = True
                deduped.append(w)
            else:
                removed += 1
        if removed > 0:
            data = deduped
            fixes_applied += removed
            print(f"  Removed {removed} duplicate(s)")

    # Write back if fixes applied
    if fix and fixes_applied > 0:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    return data, errors, warnings, fixes_applied

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--level", help="Check specific level (A0, A1, etc.)")
    parser.add_argument("--fix", action="store_true", help="Auto-fix what's possible")
    args = parser.parse_args()

    data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "words"))

    if args.level:
        files = [os.path.join(data_dir, f"{args.level.lower()}.json")]
    else:
        files = sorted(glob.glob(os.path.join(data_dir, "*.json")))

    total_errors = 0
    total_warnings = 0
    total_fixes = 0

    for json_path in files:
        if not os.path.exists(json_path):
            print(f"SKIP: {json_path} not found")
            continue

        level = os.path.basename(json_path).replace(".json", "").upper()
        data, errors, warnings, fixes = validate_file(json_path, fix=args.fix)

        print(f"\n{'='*50}")
        print(f"{level}: {len(data)} words")

        if errors:
            print(f"  ERRORS ({len(errors)}):")
            for e in errors:
                print(f"    ❌ {e}")
        if warnings:
            print(f"  WARNINGS ({len(warnings)}):")
            for w in warnings[:10]:
                print(f"    ⚠️  {w}")
            if len(warnings) > 10:
                print(f"    ... and {len(warnings)-10} more")
        if fixes:
            print(f"  FIXED: {fixes} issues")
        if not errors and not warnings:
            print(f"  ✓ All clean")

        total_errors += len(errors)
        total_warnings += len(warnings)
        total_fixes += fixes

    print(f"\n{'='*50}")
    print(f"TOTAL: {total_errors} errors, {total_warnings} warnings, {total_fixes} fixes applied")

if __name__ == "__main__":
    main()
