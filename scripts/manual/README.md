# scripts/manual

Scripts you run by hand when needed. None of them is part of the build, the tests or the CI. Run each from the repo root.

- `sentence-qa.mjs`: lints the card sentences of `data/words-open` for the problem classes found in feedback rounds and prints a review list; run `node scripts/manual/sentence-qa.mjs [level ...]` (default `a0 a1 a2`).
- `sentence-specificity.mjs`: flags example sentences that stay true when the target word is swapped for a sibling (exit code 1 when there are findings); run `node scripts/manual/sentence-specificity.mjs [level ...] [--branch=es|en]`.
- `grammar-debt-fix.py`: clears the audit debt lists of `data/games/grammar` through the Gemini API (calls the network, writes lesson files); run it from your own terminal with `GEMINI_API_KEY` set, first `python scripts/manual/grammar-debt-fix.py --dry-run`, its tests: `python -m unittest scripts/test_grammar_debt_fix.py`.
