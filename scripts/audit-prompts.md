# Prompt policy audit (PROMPT-POLICY 1 + 9)

Generated: 2026-09-17T07:46:35.806Z

Ez a riport a PROMPT-POLICY 9.1 "egyszeri korpusz-menet" bemenete: minden
sor egy szó, ami egy másik szóval megosztja a promptját (egy szinten belül).
A `[exact]` a teljesen azonos promptot jelöli, a `[partial: <sense>]` a
részleges átfedést és annak okát (a közös, normalizált sense).

## es sáv

- headword mező: `es`, prompt mező: `en`
- spec-elvárás: 17 exact + 179 partial

## hu sáv

- headword mező: `hu`, prompt mező: `en`
- spec-elvárás: 24 exact + 19 partial

## en sáv

- headword mező: `en`, prompt mező: `hu`
- spec-elvárás: 11 exact + 26 partial

## Summary

- es: 0 exact, 0 partial (OK)
- hu: 0 exact, 0 partial (OK)
- en: 0 exact, 0 partial (OK)
