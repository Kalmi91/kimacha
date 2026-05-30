#!/usr/bin/env python3
"""
Generate B2 vocabulary entries for Kimacha from batch files.
Lemmatizes, deduplicates, and creates JSON entries.
"""

import json
import re

# ── Lemmatizer: maps conjugated/inflected forms → dictionary lemma ──────────
# Returns (lemma, article_or_None)
def lemmatize(word):
    """Return (canonical_lemma, article) for a Spanish word."""
    w = word.lower().strip()

    # Verb conjugation rules → infinitive
    # Past participles / conjugated → infinitive
    verb_map = {
        # matarte, dejarte, pedirle, etc. → strip clitic pronoun endings
        # handled below
    }

    # Strip clitic pronouns from verbs (me, te, se, le, nos, os, les, lo, la, los, las)
    clitic_pattern = re.compile(
        r'^(.+?)(me|te|se|le|nos|os|les|lo|la|los|las|melo|telo|selo|nolo|nola|noles|noos)$'
    )

    return (w, None)  # basic passthrough; detailed map below

# Manual processing: we'll do this entry by entry with our knowledge
# This is the full entry generator

ENTRIES = {}  # lemma -> entry dict

EXISTING_LEMMAS = set([
    'abordar', 'agradecer', 'alcanzar', 'aportar', 'aprovechar', 'arrepentirse',
    'asequible', 'asumir', 'atreverse', 'brecha', 'compromiso', 'concatenar',
    'concurrencia', 'contrapartida', 'convencer', 'convivencia', 'cotidiano',
    'criterio', 'cúpula', 'desafío', 'descartable', 'desempeñar', 'desenlace',
    'desgaste', 'despreciar', 'destacar', 'desvirtuar', 'deterioro', 'dictamen',
    'discrepancia', 'disertación', 'disyuntiva', 'dotación', 'emprender', 'envidia',
    'estirpe', 'exigir', 'falencia', 'fiscalización', 'fomentar', 'gestión',
    'hallazgo', 'idiosincrasia', 'imprescindible', 'imprevisto', 'injerencia',
    'inversión', 'involucrar', 'jerarquía', 'matiz', 'merma', 'paliar', 'paulatino',
    'pauta', 'percibir', 'plantear', 'plazo', 'premisa', 'presupuesto', 'prevenir',
    'propiciar', 'proporcionar', 'pugna', 'quehacer', 'reconocer', 'rendimiento',
    'renovar', 'rentable', 'respaldar', 'restringir', 'rezago', 'soberbia',
    'solvencia', 'sostener', 'superar', 'surgimiento', 'surgir', 'tender',
    'trasladar', 'umbral', 'vigencia', 'vigente', 'vincular', 'ámbito'
])

# Read all batches
all_input = []
for i in range(10):
    with open(f'/home/kalmi/ai/kimacha/word_batches/b2_batch{i}.txt') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split(None, 1)
            if len(parts) == 2:
                all_input.append((int(parts[0]), parts[1].lower().strip()))
            elif len(parts) == 1:
                # no rank number
                all_input.append((0, parts[0].lower().strip()))

print(f"Total raw input lines: {len(all_input)}")

# Print unique words for inspection
words = [w for _, w in all_input]
print(f"Unique words: {len(set(words))}")
print("First 20:", words[:20])
